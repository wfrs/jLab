/**
 * XLSX workbook builders for regulatory reports (legacy GMOCU parity)
 *
 * Legacy formatting (gmocu.py -FORMBLATT- handler, xlsxwriter):
 * landscape A4, fit to 1 page wide, repeated header row, footer with
 * institution, bold/wrapped/centered header cells on #D3D3D3, all cells
 * wrapped with thin borders, fixed column widths.
 */

import ExcelJS from 'exceljs';
import { FormblattZRow, PlasmidListRow } from './report.service';

export type FormblattLanguage = 'de' | 'en';

const FORMBLATT_HEADERS: Record<FormblattLanguage, string[]> = {
  de: [
    'Nr.',
    'Spender Bezeichnung',
    'Spender RG',
    'Empfänger Bezeichnung',
    'Empfänger RG',
    'Ausgangsvektor Bezeichnung',
    'Übertragene Nukleinsäure Bezeichnung',
    'Übertragene Nukleinsäure Gefährdungspotential',
    'GVO Bezeichnung',
    'GVO RG',
    'GVO Zulassung',
    'GVO erzeugt/erhalten am',
    'GVO entsorgt am',
    'Datum des Eintrags',
  ],
  en: [
    'No',
    'Donor designation',
    'Donor RG',
    'Recipient designation',
    'Recipient RG',
    'Source vector designation',
    'Transferred nucleic acid designation',
    'Transferred nucleic acid risk potential',
    'GMO name',
    'GMO RG',
    'GMO approval',
    'GMO generated',
    'GMO disposal',
    'Entry date',
  ],
};

/** Legacy column widths (xlsxwriter set_column calls) */
const FORMBLATT_COLUMN_WIDTHS = [4, 30, 12, 16, 9, 13, 28, 25, 15, 5, 9, 15, 13, 10];

const PLASMID_LIST_HEADERS = [
  'No.',
  'Plasmid name',
  'Description',
  'Original vector',
  'Size (bp)',
  'Status',
  'Entry date',
];

const PLASMID_LIST_COLUMN_WIDTHS = [5, 22, 45, 15, 10, 12, 12];

/** A4 (xlsxwriter set_paper(9)) */
const PAPER_SIZE_A4 = 9;

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD3D3D3' },
};

function addFormattedSheet(
  workbook: ExcelJS.Workbook,
  headers: string[],
  widths: number[],
  rows: string[][],
  footer: string
): void {
  const sheet = workbook.addWorksheet('Sheet1', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: PAPER_SIZE_A4,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '1:1',
    },
    headerFooter: { oddFooter: footer },
  });

  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    cell.border = THIN_BORDER;
    cell.fill = HEADER_FILL;
  });

  for (const values of rows) {
    const row = sheet.addRow(values);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = THIN_BORDER;
    });
  }
}

/**
 * Build the Formblatt-Z workbook and return it as a Buffer
 */
export async function buildFormblattZWorkbook(
  rows: FormblattZRow[],
  lang: FormblattLanguage,
  institution: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const footer = institution ? `Formblatt Z, ${institution}` : 'Formblatt Z';

  addFormattedSheet(
    workbook,
    FORMBLATT_HEADERS[lang],
    FORMBLATT_COLUMN_WIDTHS,
    rows.map((row) => [
      row.no,
      row.donor,
      row.donorRg,
      row.recipient,
      row.recipientRg,
      row.vector,
      row.dna,
      row.dnaRisk,
      row.gmoName,
      row.gmoRg,
      row.gmoApproval,
      row.dateGenerated,
      row.dateDestroyed,
      row.entryDate,
    ]),
    footer
  );

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/**
 * Build the plasmid list workbook and return it as a Buffer
 */
export async function buildPlasmidListWorkbook(
  rows: PlasmidListRow[],
  dateStamp: string,
  initials = ''
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Legacy footer: "{initials} Plasmidlist, date: {date}"
  const footerPrefix = initials ? `${initials} ` : '';

  addFormattedSheet(
    workbook,
    PLASMID_LIST_HEADERS,
    PLASMID_LIST_COLUMN_WIDTHS,
    rows.map((row) => [
      String(row.no),
      row.name,
      row.description,
      row.backboneVector,
      row.sizeBp,
      row.status,
      row.entryDate,
    ]),
    `${footerPrefix}Plasmidlist, date: ${dateStamp}`
  );

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
