/**
 * Convert a UUID to a human-friendly feedback reference number.
 *
 * Examples:
 *   "0193a7b2-c3d4-7e8f-9a0b-1c2d3e4f5a6b" → "FB-93A7B2"
 *   "a1b2c3d4-e5f6-7890-abcd-ef1234567890" → "FB-A1B2C3"
 *
 * The reference number is derived from the first 6 hex chars after
 * stripping the leading version/variant bits, giving ~16 million
 * unique short codes — more than enough for a feedback system.
 *
 * The full UUID is still used for routing and API calls;
 * this is purely a display convenience for end users.
 */
export function formatRefNumber(uuid: string): string {
  // Strip hyphens and take chars 4–10 (skip the UUIDv7 timestamp prefix
  // which is often similar for threads created close together)
  const hex = uuid.replace(/-/g, '');
  const segment = hex.slice(4, 10).toUpperCase();
  return `FB-${segment}`;
}
