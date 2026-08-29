/**
 * Database seed script
 * Populates development data
 *
 * Usage: npm run db:seed
 */

import knex from 'knex';
import { Logger } from '../src/infrastructure/logger';

// UUID generation helper
function generateUUID(): string {
  return crypto
    .getRandomValues(new Uint8Array(16))
    .reduce((a, b) => a + ('0' + b.toString(16)).slice(-2), '');
}

const logger = new Logger({ operation: 'db-seed' });
const dbPath = process.env.DATABASE_URL || './jlab.db';

async function seedDatabase() {
  try {
    logger.info('Seeding database with development data', { dbPath });

    const db = knex({
      client: 'sqlite3',
      connection: { filename: dbPath },
      useNullAsDefault: true,
    });

    // Clear existing data (development only)
    if (process.env.NODE_ENV === 'development') {
      logger.info('Clearing existing data');
      await db('integrations').del();
      await db('project_plasmids').del();
      await db('features').del();
      await db('primers').del();
      await db('cassettes').del();
      await db('projects').del();
      await db('plasmids').del();
    }

    const now = new Date().toISOString();

    // Sample project
    const projectId = generateUUID();
    await db('projects').insert({
      id: projectId,
      name: 'Sample Project',
      description: 'Example project for testing',
      status: 'active',
      created_at: now,
      updated_at: now,
    });

    logger.info('Sample project created', { projectId });

    // Sample plasmid (pGFP expressing vector)
    const plasmidId = generateUUID();
    const gfpSequence =
      'ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCCGTGGAGAGGGTGAAGGTGATGCTACAAACGGAAAACTCACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCCCGTTATCCGGATCATATGAAACGGCATGACTTTTTCAAGAGTGCCATGCCCGAAGGTTATGTACAGGAA';

    await db('plasmids').insert({
      id: plasmidId,
      name: 'pGFP-Test',
      description: 'GFP expressing plasmid for testing',
      size_bp: gfpSequence.length,
      status: 'validated',
      created_at: now,
      updated_at: now,
    });

    logger.info('Sample plasmid created', { plasmidId });

    // Add plasmid to project
    await db('project_plasmids').insert({
      project_id: projectId,
      plasmid_id: plasmidId,
      added_at: now,
    });

    // Sample cassettes
    const cassettes = [
      { name: 'T7 Promoter', type: 'promoter', position: 0 },
      { name: 'GFP', type: 'marker', position: 1 },
      { name: 'rrnB Terminator', type: 'terminator', position: 2 },
      { name: 'ColE1 Origin', type: 'origin', position: 3 },
      { name: 'Ampicillin Resistance', type: 'resistance', position: 4 },
    ];

    for (const cassette of cassettes) {
      await db('cassettes').insert({
        id: generateUUID(),
        plasmid_id: plasmidId,
        name: cassette.name,
        type: cassette.type,
        position: cassette.position,
        sequence: gfpSequence.substring(cassette.position * 100, (cassette.position + 1) * 100),
        created_at: now,
        updated_at: now,
      });
    }

    logger.info('Sample cassettes created', { count: cassettes.length });

    // Sample primers
    const primers = [
      {
        name: 'pGFP-Fwd',
        sequence: 'ATGAGTAAAGGAGAAGAACTTTTCACTG',
        tm_celsius: 58.5,
        gc_percent: 48.3,
      },
      {
        name: 'pGFP-Rev',
        sequence: 'TTACTTGTACAGCTCGTCCATGCC',
        tm_celsius: 56.2,
        gc_percent: 52.0,
      },
    ];

    for (const primer of primers) {
      await db('primers').insert({
        id: generateUUID(),
        plasmid_id: plasmidId,
        ...primer,
        created_at: now,
        updated_at: now,
      });
    }

    logger.info('Sample primers created', { count: primers.length });

    // Sample features
    const features = [
      { name: 'T7 Promoter', type: 'promoter', start: 1, end: 35, strand: '+' },
      { name: 'GFP Gene', type: 'gene', start: 50, end: 728, strand: '+' },
      { name: 'His-Tag', type: 'his_tag', start: 729, end: 737, strand: '+' },
      { name: 'Stop Codon', type: 'other', start: 738, end: 740, strand: '+' },
    ];

    for (const feature of features) {
      await db('features').insert({
        id: generateUUID(),
        plasmid_id: plasmidId,
        name: feature.name,
        type: feature.type,
        start_pos: feature.start,
        end_pos: feature.end,
        strand: feature.strand,
        created_at: now,
        updated_at: now,
      });
    }

    logger.info('Sample features created', { count: features.length });

    await db.destroy();
    logger.info('Database seeding complete');
  } catch (error) {
    logger.error('Database seeding failed', error as Error);
    process.exit(1);
  }
}

seedDatabase();
