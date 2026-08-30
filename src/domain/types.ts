/**
 * Domain entity types for jlab
 * Strict typing for all domain models (ADR-0007)
 */

/**
 * Plasmid - Core entity for genetic construct storage
 */
export interface Plasmid {
  id: string;
  /** Accession number, e.g. 'pJM0001'. The lab's permanent identifier. */
  name: string;
  /**
   * Everyday construct name, e.g. 'pMiso000' (legacy `alias`, spreadsheet
   * `name`). Line 2 of both label types.
   */
  constructName?: string;
  description?: string;
  sizeBp?: number;
  parentId?: string;
  /** Original/backbone vector (legacy backbone_vector; Formblatt-Z "Ausgangsvektor") */
  backboneVector?: string;
  status: 'draft' | 'validated' | 'archived';

  /** What was cloned in ('insert' is SQL-reserved, hence the suffix) */
  insertName?: string;
  insertSizeBp?: number;
  /** EV | cassette | CDS | promoter | c-tag | terminator | binary | t-arm | addgene | … */
  category?: string;
  /** Normalized antibiotic resistance, e.g. 'Kan' or 'Gen + Rif' */
  bacterialResistance?: string;
  plantResistance?: string;
  /** Freezer box number */
  box?: number;
  /** Free-text sequencing verdict and method, e.g. 'good; ONT' */
  sequencingResult?: string;
  /** ISO date */
  sequencingDate?: string;
  /** The lab's own note on the row */
  comment?: string;
  /** Secondary note column ('other comment' in the spreadsheet) */
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * PlasmidPrep - One preparation of a plasmid: when, by whom, at what
 * concentration. A plasmid is re-prepped when its tube runs empty, so the
 * newest prep is the current one and older rows are the audit trail.
 *
 * Recording the three values together is the point: the spreadsheet keeps one
 * of each per plasmid and updating them by hand is three separate edits, which
 * left pJM0055 holding an old date beside a new concentration.
 */
export interface PlasmidPrep {
  id: string;
  plasmidId: string;
  /** ISO date the prep was made */
  preppedOn: string;
  /** Who made it — 'JM', 'INA', 'LN' */
  operatorInitials: string;
  /** Absent when prepped but not yet measured */
  concentrationNgUl?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GlycerolStock - A frozen bacterial stock.
 *
 * E. coli stocks mirror plasmids one-to-one, with an ID derived from the
 * plasmid number ('pJM0001' -> 'CJM1'). Agrobacterium stocks are numbered
 * independently ('AJM1'), may carry no plasmid at all, and may be parallel
 * aliquots of another stock ('AJM5.1'). Remaking a stock overwrites `madeOn`,
 * matching how the lab keeps it.
 */
export interface GlycerolStock {
  id: string;
  /** Lab identifier: 'CJM1', 'AJM5.1' */
  stockId: string;
  /** Absent for strain-only stocks and those obtained from other people */
  plasmidId?: string;
  /** 'E. coli' | 'A. tumefaciens' | 'A. rhizogenes' */
  organism: string;
  /** 'TOP10' | 'GV3101 pMP90 (Goldbio)' — the source stays inside the string */
  strain: string;
  /** Construct name when no plasmid record backs the stock */
  constructLabel?: string;
  /** ISO date; absent means the number is reserved but the stock was never made */
  madeOn?: string;
  operatorInitials?: string;
  /** Multi-valued for Agrobacterium, whose strains carry resistance already */
  bacterialResistance?: string;
  /** Set when the stock came from someone else, e.g. 'Tobi' */
  externalSource?: string;
  /**
   * Where the strain itself came from, e.g. 'from Tübingen'. Printed on the
   * label in place of a construct when the stock carries no plasmid.
   */
  sourceNote?: string;
  /** 'AJM5.1' -> 'AJM5' */
  parentStockId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LabelPrint - Record of a label sheet jlab generated. The manual Word
 * workflow kept no reliable record of what had been printed.
 */
export interface LabelPrint {
  id: string;
  kind: 'plasmid' | 'glycerol';
  /** Plasmid id or glycerol stock id */
  targetId: string;
  /** ISO timestamp */
  printedAt: string;
  createdAt: Date;
}

/**
 * Cassette - Genetic parts/modules within a plasmid
 */
export interface Cassette {
  id: string;
  plasmidId: string;
  name: string;
  sequence?: string;
  type: 'promoter' | 'terminator' | 'marker' | 'origin' | 'resistance' | 'other';
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Primer - PCR primer for plasmid verification
 */
export interface Primer {
  id: string;
  plasmidId: string;
  name: string;
  sequence: string;
  tmCelsius?: number;
  gcPercent?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Feature - Annotated region within plasmid sequence
 */
export interface Feature {
  id: string;
  plasmidId: string;
  name: string;
  type: 'gene' | 'promoter' | 'terminator' | 'rbs' | 'his_tag' | 'flag_tag' | 'other';
  startPos: number;
  endPos: number;
  strand: '+' | '-';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GlossaryFeature - Controlled vocabulary entry for cassette composition
 * (legacy GMOCU "Nucleic acids" glossary / Features table)
 * `annotation` is the token referenced in cassette content strings.
 */
export interface GlossaryFeature {
  id: string;
  /** Token name; normalized: no '-', '[', ']', or spaces */
  annotation: string;
  /** Human-readable name */
  alias?: string;
  risk: string;
  /** Source organism (free text; links to organism glossary later) */
  organism?: string;
  /** Sync identity for online glossary flows (legacy uid) */
  uid: string;
  synced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Organism - Controlled vocabulary entry for GMO generation
 * (legacy GMOCU "Organisms" glossary)
 */
export interface Organism {
  id: string;
  /** Full species name, unique (legacy full_name) */
  fullName: string;
  shortName?: string;
  /** Risk group (legacy RG; free text like "1", "2") */
  riskGroup: string;
  /** Sync identity for online glossary flows (legacy uid) */
  uid: string;
  synced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Gmo - Generated genetically modified organism record linked to a plasmid
 * (legacy GMOCU GMOs table). The display summary is derived from these
 * fields at render time (legacy stored it denormalized as GMO_summary).
 */
export interface Gmo {
  id: string;
  plasmidId: string;
  /** Organism full name (legacy links by name, not id) */
  organismName: string;
  /** Approval reference; legacy default '-' */
  approval: string;
  /** Target risk group (legacy target_RG) */
  targetRiskGroup: number;
  /** ISO date (YYYY-MM-DD) */
  dateGenerated: string;
  /** ISO date; null while the GMO still exists (legacy 'tbd') */
  dateDestroyed?: string | null;
  /** ISO date the record was entered */
  entryDate: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attachment - Arbitrary file stored on a plasmid (legacy Attachments table:
 * file BLOB + Filename + plasmid_id). Binary content lives in the database,
 * matching the legacy single-file .db distribution model.
 */
export interface Attachment {
  id: string;
  plasmidId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

/** Attachment without the binary payload (list responses) */
export type AttachmentMeta = Omit<Attachment, 'data'>;

/**
 * GenbankFile - The plasmid's GenBank record, at most one per plasmid.
 * Legacy stored this as Plasmids.genebank/gb_name columns (with a derived
 * '•' marker in Plasmids.gb); v2 normalizes it into its own table so list
 * responses don't carry full sequence files.
 */
export interface GenbankFile {
  /** Owning plasmid (primary key — one GenBank file per plasmid) */
  plasmidId: string;
  /** Original filename (legacy gb_name); must end in .gb or .gbk */
  filename: string;
  /** Full GenBank file text (legacy genebank) */
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/** GenbankFile without the content (metadata responses) */
export type GenbankMeta = Omit<GenbankFile, 'content'> & { sizeBytes: number };

/**
 * Project - Container for organizing plasmids
 */
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ProjectPlasmid - M2M relationship between projects and plasmids
 */
export interface ProjectPlasmid {
  projectId: string;
  plasmidId: string;
  addedAt: Date;
}

/**
 * User - Local phase 1 (single-user, no multi-user auth yet)
 */
export interface User {
  id: string;
  name: string;
  email?: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Integration - External sync state for adapters (ADR-0006)
 */
export interface Integration {
  id: string;
  plasmidId: string;
  type: 'google_drive' | 'google_sheets' | 'genbank' | 'ice' | 'filebrowser';
  externalId: string;
  lastSync?: Date;
  syncStatus: 'pending' | 'synced' | 'error';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Settings - Single-row application/user configuration (legacy Settings table).
 * v2 carries the web-relevant subset; integration credentials arrive with the
 * integrations milestone, PySimpleGUI display fields (scale/font/style) are N/A.
 */
export interface Settings {
  /** Singleton row id ('default') */
  id: string;
  /** User name (legacy Settings.name; used in report filenames) */
  name: string;
  /** User initials (legacy Settings.initials; used in file naming and list footers) */
  initials: string;
  email: string;
  /** Institution string printed in the Formblatt-Z footer */
  institution: string;
  /** Duplicate GMO records when duplicating a plasmid (legacy duplicate_gmos) */
  duplicateGmos: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validation error type for three-layer validation (ADR-0007)
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Domain invariant errors (ADR-0007)
 * These represent business logic violations
 */
export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
