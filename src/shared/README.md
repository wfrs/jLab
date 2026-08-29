# /src/shared

Shared utilities and types used across layers.

## Modules

- **api-types.ts** — Standard error/success envelopes (ADR-0008)
- **constants.ts** — Shared constants (status enums, error codes, etc.)
- **utils.ts** — Common utility functions (ID generation, formatting, etc.)
- **validation-schemas.ts** — Reusable Zod schemas (ADR-0007)

## API Types (ADR-0008)

All API responses use standard envelopes:

```typescript
// Success
{
  data: T,
  correlationId: string,
  timestamp: string
}

// Error
{
  code: string,
  category: 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'INTEGRATION' | 'INTERNAL' | 'UNAUTHORIZED',
  message: string,
  correlationId: string,
  details?: Record<string, unknown>,
  timestamp: string
}
```

## Error Codes

Standard error codes (must align across ADR-0006, ADR-0007, ADR-0008):

- `VALIDATION_ERROR` — Invalid input (category: VALIDATION)
- `NOT_FOUND` — Resource doesn't exist (category: NOT_FOUND)
- `CONFLICT` — Duplicate or incompatible state (category: CONFLICT)
- `INTEGRATION_ERROR` — External service failed (category: INTEGRATION)
- `INTERNAL_ERROR` — Unexpected server error (category: INTERNAL)
- `UNAUTHORIZED` — Missing/invalid auth (category: UNAUTHORIZED)

## Validation Schemas (ADR-0007)

Import and compose schemas from here:

```typescript
import { PlasmidInput, CassetteInput } from '@shared/validation-schemas';

const result = PlasmidInput.parse(data); // Throws ZodError
```
