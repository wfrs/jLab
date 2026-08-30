/**
 * Golden Gate part data
 * GET /api/tools/golden-gate?ids=a,b,c
 *
 * The sizes and concentrations the calculator needs, joined from each plasmid
 * and its newest prep — the two columns the `parts` sheet asks you to retype.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlasmidRepository } from '@/services/plasmid.repository';
import { PlasmidPrepRepository } from '@/services/plasmid-prep.repository';
import { Logger } from '@/infrastructure/logger';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { labelIdsQuerySchema } from '@/shared/validation/label-schemas';
import { DomainError } from '@/domain/types';
import { randomUUID } from 'crypto';

const logger = new Logger();

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const ids = labelIdsQuerySchema.parse(searchParams.get('ids') ?? '');

    logger.info('GET /api/tools/golden-gate', { correlationId, count: ids.length });

    const plasmids = await new PlasmidRepository(logger).listByIds(ids);
    const found = new Set(plasmids.map((plasmid) => plasmid.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new DomainError('NOT_FOUND', `Unknown plasmid(s): ${missing.join(', ')}`, {
        plasmidIds: missing,
      });
    }

    const preps = await new PlasmidPrepRepository(logger).latestForPlasmids(ids);

    const parts = plasmids.map((plasmid) => ({
      id: plasmid.id,
      name: plasmid.name,
      constructName: plasmid.constructName ?? null,
      sizeBp: plasmid.sizeBp ?? null,
      concentrationNgUl: preps.get(plasmid.id)?.concentrationNgUl ?? null,
    }));

    return NextResponse.json(createSuccessEnvelope({ parts }, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/tools/golden-gate failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
