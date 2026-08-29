/**
 * Remove keys whose value is `undefined`.
 * Required because tsconfig uses exactOptionalPropertyTypes: a parsed zod
 * partial has `field?: T | undefined`, but service inputs declare `field?: T`.
 * Explicit `null` values are preserved (they mean "clear this column").
 */
export function stripUndefined<T extends Record<string, unknown>>(
  obj: T
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const result = {} as { [K in keyof T]: Exclude<T[K], undefined> };
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
