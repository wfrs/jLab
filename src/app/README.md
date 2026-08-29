# /src/app

Next.js route handlers and pages (ADR-0001).

## Structure

```
app/
  layout.tsx             — Root layout
  page.tsx               — Home page (UI)
  api/
    plasmids/
      route.ts           — GET /api/plasmids, POST /api/plasmids
      [id]/
        route.ts         — GET /api/plasmids/:id, PATCH, DELETE
    cassettes/
      route.ts
      [id]/
        route.ts
    projects/
      route.ts
      [id]/
        route.ts
    integrations/
      route.ts
      [id]/
        route.ts
```

## Route Handler Pattern (ADR-0001, ADR-0008)

Every route handler:

1. **Extract & validate input** (ADR-0007 layer 1)
2. **Call service** (ADR-0002)
3. **Return standard envelope** (ADR-0008)
4. **Log with correlation ID** (ADR-0008)
5. **Handle errors** (ApiError → error envelope)

Example:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ApiErrorEnvelope, ApiSuccessEnvelope, ApiError } from '@shared/api-types';
import { createRequestLogger } from '@infrastructure/logger';

export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  const logger = createRequestLogger(correlationId);

  try {
    const input = await req.json();
    const service = new PlasmidService();
    const plasmid = await service.create(input);

    const response: ApiSuccessEnvelope<typeof plasmid> = {
      data: plasmid,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const errorResponse: ApiErrorEnvelope = {
      code: 'INTERNAL_ERROR',
      category: 'INTERNAL',
      message: error instanceof Error ? error.message : 'Unknown error',
      correlationId,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
```

## Extraction Criteria (ADR-0001)

When route handlers become complex, extract to dedicated backend service if:

- > 8 handlers with duplication
- Avg file >250 LOC
- p95 latency exceeds 1s
- Independent scaling needed
- Changes span 3+ modules

Until then, keep all logic in route handlers for simplicity.
