/**
 * SpreadsheetImportService
 * Imports the lab's own plasmid workbook (plasmids_JM_expanded.xlsx).
 *
 * The workbook is the authoritative record — richer and newer than the GMOCU
 * database export, and the source every printed label was typed from. Three
 * sheets:
 *   'plasmids + E.coli glycerol'  one row per plasmid, carrying its prep and
 *                                 its E. coli glycerol stock inline
 *   'Glycerol Agro'               Agrobacterium stocks, numbered separately
 *   'parts'                       a Golden Gate calculator — not imported
 *
 * Normalization happens here rather than in the file (see
 * docs/plans/label-printing.md): a hand-cleaned sheet does not stay clean, and
 * editing it would destroy the reference copy this importer is verified
 * against.
 *
 * Deliberate rules:
 * - Rows with an ID but no construct name are numbers reserved ahead of use
 *   (pJM0391-pJM0405) and are skipped.
 * - A prep row is created only when a date or a concentration is present, so
 *   "planned but not designed yet" (pJM0355, pJM0356) stays derivable: a
 *   plasmid with no prep does not physically exist.
 * - A glycerol stock with no date is imported with madeOn unset — the number
 *   is reserved, the stock was never made.
 * - Values are never read back from the printed label documents. Those are
 *   partial print output, and pJM0021's label carries a concentration for a
 *   construct that no longer holds that number.
 * - Column1, Column2 and comment3 are ignored at the lab's request.
 */

import ExcelJS from 'exceljs';
import { randomUUID } from 'crypto';
import {
  blankToNull,
  derivedStockId,
  parseAliquot,
  parseDecimalCell,
  parseIntegerCell,
  parseMarkers,
  parseSheetDate,
} from '@domain/lab-normalization';
import { DomainError, GlycerolStock, PlasmidPrep } from '@domain/types';
import { Logger } from '@infrastructure/logger';
import { getQueryBuilder } from '@infrastructure/query-builder';

/** Sheet names, with a header sniff as fallback if they are renamed */
const PLASMID_SHEET = 'plasmids + E.coli glycerol';
const AGRO_SHEET = 'Glycerol Agro';
const PLASMID_SHEET_HEADER = 'glycerol stock id';
const AGRO_SHEET_HEADER = 'construct name';

/**
 * Unnamed overflow columns on the plasmid sheet, holding stray sequencing
 * verdicts. The lab asked for them to be dropped.
 *
 * Sheet-specific on purpose: the Agrobacterium sheet has its own `Column1`
 * carrying real provenance ('from Tübingen'), which reaches the printed label
 * as '(Tübingen; #1)'. Dropping that would lose label content.
 */
const PLASMID_IGNORED_COLUMNS = new Set(['column1', 'column2', 'comment3']);
const AGRO_IGNORED_COLUMNS = new Set<string>();

export interface SheetCounts {
  added: number;
  updated: number;
  /** Numbers reserved ahead of use — an ID with no name */
  skippedReserved: number;
  /** Rows with no usable identifier at all */
  skippedBlank: number;
}

export interface SpreadsheetImportResult {
  sheetsRead: string[];
  plasmids: SheetCounts;
  preps: { added: number };
  stocks: SheetCounts & { agrobacterium: number };
  /**
   * Stock IDs whose number does not match the plasmid they sit on. Expected to
   * be empty; a non-empty list means the lab's numbering convention changed
   * and the derivation used elsewhere can no longer be trusted.
   */
  stockIdMismatches: string[];
  /** Agrobacterium rows naming a person instead of a plasmid, e.g. 'Tobi' */
  externalStocks: string[];
  /** Agrobacterium plasmid references that match no known accession */
  unresolvedPlasmidRefs: string[];
}

export interface SpreadsheetInspection {
  sheets: string[];
  plasmidRows: number;
  namedPlasmids: number;
  agroRows: number;
}

/** Header text -> normalized key */
function headerKey(value: ExcelJS.CellValue): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Read a cell by header, falling back to a prefix match.
 *
 * Several headers carry characters that are easy to get wrong on a future
 * export — 'concentration [ng/µL]' can use either the micro sign or Greek mu,
 * and 'Sequencing? (ONT/Sanger?)' is punctuation-heavy. Matching the stable
 * leading word keeps those working.
 */
function cell(row: Record<string, ExcelJS.CellValue>, ...keys: string[]): ExcelJS.CellValue {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }
  for (const key of keys) {
    const match = Object.keys(row).find((header) => header.startsWith(key));
    if (match) {
      return row[match];
    }
  }
  return null;
}

/** Read a worksheet as objects keyed by normalized header */
function readRows(
  sheet: ExcelJS.Worksheet,
  ignored: Set<string>
): Array<Record<string, ExcelJS.CellValue>> {
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
    headers[index] = headerKey(cell.value);
  });

  const rows: Array<Record<string, ExcelJS.CellValue>> = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const record: Record<string, ExcelJS.CellValue> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      const key = headers[index];
      if (!key || ignored.has(key)) {
        return;
      }
      const value = cell.value;
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        record[key] = value;
        hasValue = true;
      }
    });
    if (hasValue) {
      rows.push(record);
    }
  }
  return rows;
}

/** Locate a sheet by name, falling back to a header sniff */
function findSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headerHint: string
): ExcelJS.Worksheet | null {
  const byName = workbook.worksheets.find(
    (sheet) => sheet.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (byName) {
    return byName;
  }
  return (
    workbook.worksheets.find((sheet) => {
      const headers: string[] = [];
      sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, index) => {
        headers[index] = headerKey(cell.value);
      });
      return headers.includes(headerHint);
    }) ?? null
  );
}

async function loadWorkbook(data: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data as unknown as ArrayBuffer);
  } catch {
    throw new DomainError('VALIDATION', 'File is not a readable .xlsx workbook');
  }
  return workbook;
}

function emptyCounts(): SheetCounts {
  return { added: 0, updated: 0, skippedReserved: 0, skippedBlank: 0 };
}

export class SpreadsheetImportService {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  /** Summarize a workbook without writing anything */
  async inspectWorkbook(data: Buffer): Promise<SpreadsheetInspection> {
    const workbook = await loadWorkbook(data);
    const plasmidSheet = findSheet(workbook, PLASMID_SHEET, PLASMID_SHEET_HEADER);
    const agroSheet = findSheet(workbook, AGRO_SHEET, AGRO_SHEET_HEADER);

    if (!plasmidSheet) {
      throw new DomainError(
        'VALIDATION',
        `Workbook has no '${PLASMID_SHEET}' sheet (and none with a '${PLASMID_SHEET_HEADER}' column)`
      );
    }

    const plasmidRows = readRows(plasmidSheet, PLASMID_IGNORED_COLUMNS);
    return {
      sheets: workbook.worksheets.map((sheet) => sheet.name),
      plasmidRows: plasmidRows.length,
      namedPlasmids: plasmidRows.filter((row) => blankToNull(row['name'])).length,
      agroRows: agroSheet ? readRows(agroSheet, AGRO_IGNORED_COLUMNS).length : 0,
    };
  }

  /**
   * Import the workbook in one transaction: either everything lands or
   * nothing does. Re-importing matches plasmids on their accession and
   * updates in place, so running it twice is safe.
   *
   * `operatorInitials` attributes the imported preps. The spreadsheet has no
   * operator column — it belongs to one person, and the few preps her students
   * made are noted only in prose ("midi prepped by INA"), which is preserved
   * in `notes`. Preps recorded in jlab from here on carry their own operator.
   */
  async importWorkbook(
    data: Buffer,
    options: { operatorInitials?: string } = {}
  ): Promise<SpreadsheetImportResult> {
    this.logger.info('SpreadsheetImportService.importWorkbook');

    const operatorInitials = blankToNull(options.operatorInitials) ?? 'unknown';

    const workbook = await loadWorkbook(data);
    const plasmidSheet = findSheet(workbook, PLASMID_SHEET, PLASMID_SHEET_HEADER);
    if (!plasmidSheet) {
      throw new DomainError(
        'VALIDATION',
        `Workbook has no '${PLASMID_SHEET}' sheet (and none with a '${PLASMID_SHEET_HEADER}' column)`
      );
    }
    const agroSheet = findSheet(workbook, AGRO_SHEET, AGRO_SHEET_HEADER);

    const result: SpreadsheetImportResult = {
      sheetsRead: [plasmidSheet.name, ...(agroSheet ? [agroSheet.name] : [])],
      plasmids: emptyCounts(),
      preps: { added: 0 },
      stocks: { ...emptyCounts(), agrobacterium: 0 },
      stockIdMismatches: [],
      externalStocks: [],
      unresolvedPlasmidRefs: [],
    };

    const db = getQueryBuilder();

    await db.transaction(async (trx) => {
      const now = new Date();
      const nowIso = now.toISOString();

      const existingPlasmids = (await trx('plasmids').select('id', 'name')) as Array<{
        id: string;
        name: string;
      }>;
      const idByAccession = new Map(existingPlasmids.map((row) => [row.name, row.id]));

      const existingStockRows = (await trx('glycerol_stocks').select('stockId')) as Array<{
        stockId: string;
      }>;
      const existingStockIds = new Set(existingStockRows.map((row) => row.stockId));

      // Preloaded so re-import stays one query rather than one per row.
      const existingPrepRows = (await trx('plasmid_preps').select(
        'plasmidId',
        'preppedOn'
      )) as Array<{ plasmidId: string; preppedOn: string }>;
      const existingPrepKeys = new Set(
        existingPrepRows.map((row) => `${row.plasmidId}|${row.preppedOn}`)
      );

      const newPlasmids: Array<Record<string, unknown>> = [];
      const newPreps: PlasmidPrep[] = [];
      const newStocks: GlycerolStock[] = [];

      // ---- Sheet 1: plasmids, their current prep, and their E. coli stock ----
      for (const row of readRows(plasmidSheet, PLASMID_IGNORED_COLUMNS)) {
        const accession = blankToNull(row['id']);
        if (!accession) {
          result.plasmids.skippedBlank++;
          continue;
        }

        const constructName = blankToNull(row['name']);
        if (!constructName) {
          // An ID reserved ahead of use — pJM0391 onwards.
          result.plasmids.skippedReserved++;
          continue;
        }

        const markers = parseMarkers(cell(row, 'markers'));
        const fields = {
          constructName,
          description: blankToNull(cell(row, 'details')),
          insertName: blankToNull(cell(row, 'insert')),
          insertSizeBp: parseIntegerCell(cell(row, 'insert size')),
          sizeBp: parseIntegerCell(cell(row, 'total size')),
          category: blankToNull(cell(row, 'category')),
          bacterialResistance: markers.bacterial,
          plantResistance: markers.plant,
          box: parseIntegerCell(cell(row, 'box')),
          sequencingResult: blankToNull(cell(row, 'sequencing')),
          sequencingDate: parseSheetDate(cell(row, 'date sequencing')),
          comment: blankToNull(cell(row, 'comment')),
          notes: blankToNull(cell(row, 'other comment')),
          updatedAt: nowIso,
        };

        let plasmidId = idByAccession.get(accession);
        if (plasmidId) {
          await trx('plasmids').where('id', plasmidId).update(fields);
          result.plasmids.updated++;
        } else {
          plasmidId = randomUUID();
          idByAccession.set(accession, plasmidId);
          newPlasmids.push({
            id: plasmidId,
            name: accession,
            status: 'validated',
            ...fields,
            createdAt: nowIso,
          });
          result.plasmids.added++;
        }

        // The prep: one row when a date or a concentration exists. A plasmid
        // with no prep has not physically been made — that is how "planned but
        // not designed yet" (pJM0355, pJM0356) stays derivable.
        const preppedOn = parseSheetDate(cell(row, 'date plasmid'));
        const concentration = parseDecimalCell(cell(row, 'concentration'));
        if (preppedOn || concentration !== null) {
          const prepKey = `${plasmidId}|${preppedOn ?? ''}`;
          if (!existingPrepKeys.has(prepKey)) {
            existingPrepKeys.add(prepKey);
            newPreps.push({
              id: randomUUID(),
              plasmidId,
              preppedOn: preppedOn ?? nowIso.slice(0, 10),
              operatorInitials,
              ...(concentration !== null && { concentrationNgUl: concentration }),
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        // The E. coli glycerol stock carried on the same row.
        const stockId = blankToNull(cell(row, 'glycerol stock id'));
        if (stockId) {
          const expected = derivedStockId(accession);
          if (expected && expected !== stockId) {
            result.stockIdMismatches.push(`${accession} -> ${stockId} (expected ${expected})`);
          }

          if (existingStockIds.has(stockId)) {
            await trx('glycerol_stocks')
              .where('stockId', stockId)
              .update({
                plasmidId,
                organism: blankToNull(row['organism']) ?? 'E. coli',
                strain: blankToNull(row['strain']) ?? '',
                madeOn: parseSheetDate(row['date glycerol stock']),
                updatedAt: nowIso,
              });
            result.stocks.updated++;
          } else {
            existingStockIds.add(stockId);
            newStocks.push({
              id: randomUUID(),
              stockId,
              plasmidId,
              organism: blankToNull(row['organism']) ?? 'E. coli',
              strain: blankToNull(row['strain']) ?? '',
              ...(parseSheetDate(row['date glycerol stock']) && {
                madeOn: parseSheetDate(row['date glycerol stock'])!,
              }),
              createdAt: now,
              updatedAt: now,
            });
            result.stocks.added++;
          }
        }
      }

      if (newPlasmids.length > 0) {
        await trx('plasmids').insert(newPlasmids);
      }

      // ---- Sheet 2: Agrobacterium stocks ----
      if (agroSheet) {
        for (const row of readRows(agroSheet, AGRO_IGNORED_COLUMNS)) {
          const stockId = blankToNull(row['id']);
          if (!stockId) {
            result.stocks.skippedBlank++;
            continue;
          }

          const organism = blankToNull(cell(row, 'organism'));
          const strain = blankToNull(cell(row, 'strain'));
          if (!organism && !strain) {
            // An AJM number reserved ahead of use.
            result.stocks.skippedReserved++;
            continue;
          }

          const plasmidRef = blankToNull(cell(row, 'plasmid'));
          let plasmidId: string | undefined;
          let externalSource: string | undefined;

          if (plasmidRef) {
            const resolved = idByAccession.get(plasmidRef);
            if (resolved) {
              plasmidId = resolved;
            } else if (/^p[A-Z]{2,4}\d+$/.test(plasmidRef)) {
              result.unresolvedPlasmidRefs.push(`${stockId} -> ${plasmidRef}`);
            } else {
              // A person's name: the stock came from someone else and is not
              // in this lab's plasmid list.
              externalSource = plasmidRef;
              result.externalStocks.push(`${stockId} -> ${plasmidRef}`);
            }
          }

          const aliquot = parseAliquot(stockId);
          const stock: GlycerolStock = {
            id: randomUUID(),
            stockId,
            ...(plasmidId && { plasmidId }),
            organism: organism ?? '',
            strain: strain ?? '',
            ...(blankToNull(row['construct name']) && {
              constructLabel: blankToNull(row['construct name'])!,
            }),
            ...(parseSheetDate(row['date']) && { madeOn: parseSheetDate(row['date'])! }),
            ...(parseMarkers(row['antibiotic resistance']).bacterial && {
              bacterialResistance: parseMarkers(row['antibiotic resistance']).bacterial!,
            }),
            ...(externalSource && { externalSource }),
            ...(blankToNull(cell(row, 'column1')) && {
              sourceNote: blankToNull(cell(row, 'column1'))!,
            }),
            ...(aliquot && { parentStockId: aliquot.parentStockId }),
            createdAt: now,
            updatedAt: now,
          };

          if (existingStockIds.has(stockId)) {
            const updatable: Record<string, unknown> = { ...stock, updatedAt: nowIso };
            delete updatable.id;
            delete updatable.createdAt;
            await trx('glycerol_stocks').where('stockId', stockId).update(updatable);
            result.stocks.updated++;
          } else {
            existingStockIds.add(stockId);
            newStocks.push(stock);
            result.stocks.added++;
          }
          result.stocks.agrobacterium++;
        }
      }

      if (newStocks.length > 0) {
        await trx('glycerol_stocks').insert(
          newStocks.map((stock) => ({
            ...stock,
            createdAt: nowIso,
            updatedAt: nowIso,
          }))
        );
      }

      if (newPreps.length > 0) {
        await trx('plasmid_preps').insert(
          newPreps.map((prep) => ({ ...prep, createdAt: nowIso, updatedAt: nowIso }))
        );
        result.preps.added = newPreps.length;
      }
    });

    this.logger.info('SpreadsheetImportService.importWorkbook complete', {
      plasmidsAdded: result.plasmids.added,
      plasmidsUpdated: result.plasmids.updated,
      preps: result.preps.added,
      stocksAdded: result.stocks.added,
      mismatches: result.stockIdMismatches.length,
    });

    return result;
  }
}
