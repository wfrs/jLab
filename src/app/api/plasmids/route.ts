/**
 * Plasmid API Routes
 * GET: List plasmids (with filtering, search, pagination)
 * POST: Create a new plasmid
 * Follows ADR-0008 (API response envelopes), ADR-0007 (Zod at API boundary)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlasmidService } from '@/services/plasmid.service';
import { Logger } from '@/infrastructure/logger';
import { ApiError } from '@/shared/api-types';
import {
  createSuccessEnvelope,
  createErrorEnvelope,
  statusForErrorEnvelope,
} from '@/shared/api-envelope';
import { createPlasmidSchema } from '@/shared/validation/plasmid-schemas';
import { stripUndefined } from '@/shared/validation/strip-undefined';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/shared/pagination';
import { randomUUID } from 'crypto';

const logger = new Logger();
const plasmidService = new PlasmidService(logger);

/**
 * GET /api/plasmids
 * List plasmids with optional filtering
 */
export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const projectId = searchParams.get('projectId');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE)),
      MAX_PAGE_SIZE
    );
    const offset = parseInt(searchParams.get('offset') || '0');

    logger.info('GET /api/plasmids', {
      correlationId,
      search,
      projectId,
      limit,
      offset,
    });

    let paginatedData;

    // Apply filters based on query parameters
    if (search) {
      const plasmids = await plasmidService.searchPlasmids(search);
      paginatedData = {
        data: plasmids.slice(offset, offset + limit),
        total: plasmids.length,
        limit,
        offset,
      };
    } else if (projectId) {
      const plasmids = await plasmidService.listProjectPlasmids(projectId);
      paginatedData = {
        data: plasmids.slice(offset, offset + limit),
        total: plasmids.length,
        limit,
        offset,
      };
    } else {
      paginatedData = { ...(await plasmidService.listPlasmids(limit, offset)), limit, offset };
    }

    return NextResponse.json(createSuccessEnvelope(paginatedData, correlationId), { status: 200 });
  } catch (error) {
    logger.error('GET /api/plasmids failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}

/**
 * POST /api/plasmids
 * Create a new plasmid
 */
export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || randomUUID();

  try {
    const body = await request.json().catch(() => {
      throw new ApiError('INVALID_JSON', 'VALIDATION', 'Request body must be valid JSON');
    });

    const input = createPlasmidSchema.parse(body);

    logger.info('POST /api/plasmids', {
      correlationId,
      plasmidName: input.name,
    });

    const plasmid = await plasmidService.createPlasmid(
      stripUndefined({
        ...input,
        id: input.id || randomUUID(),
      })
    );

    logger.info('Plasmid created successfully', {
      correlationId,
      plasmidId: plasmid.id,
    });

    return NextResponse.json(createSuccessEnvelope(plasmid, correlationId), { status: 201 });
  } catch (error) {
    logger.error('POST /api/plasmids failed', error as Error, { correlationId });
    const envelope = createErrorEnvelope(error, correlationId);
    return NextResponse.json(envelope, { status: statusForErrorEnvelope(envelope) });
  }
}
