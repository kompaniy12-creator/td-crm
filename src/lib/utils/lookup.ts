/**
 * URL params used to be UUIDs (`?id=8ba8...`), now we navigate using the
 * short numeric `number` instead (`?id=20001`). Detail pages call this
 * helper to figure out which DB column to filter on.
 *
 * If the value is purely digits → look up by `number`.
 * Otherwise (UUID-shaped) → look up by `id` for backwards compatibility.
 */
export function lookupColumn(value: string): 'id' | 'number' {
  return /^\d+$/.test(value.trim()) ? 'number' : 'id'
}

export function lookupValue(value: string): string | number {
  return /^\d+$/.test(value.trim()) ? Number(value) : value
}
