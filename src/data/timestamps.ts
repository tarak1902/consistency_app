/**
 * Parse a Postgres/PostgREST timestamptz string to epoch ms. Normalises the
 * forms Hermes' Date.parse is strict about: microseconds, a space separator,
 * and short "+00" offsets.
 */
export function parseTimestamp(value: string): number {
  let s = value.trim().replace(' ', 'T');
  s = s.replace(/(\.\d{3})\d+/, '$1');
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) throw new Error(`Bad timestamp: ${value}`);
  return ms;
}
