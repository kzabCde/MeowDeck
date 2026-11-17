/** Injectable unbiased integer source, [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('maxExclusive must be an integer between 1 and 2^32');
  }
  if (maxExclusive === 1) return 0;
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure WebCrypto randomness is required in production');
  }
  const span = 0x100000000;
  const limit = Math.floor(span / maxExclusive) * maxExclusive;
  const bytes = new Uint32Array(1);
  let value: number;
  do { crypto.getRandomValues(bytes); value = bytes[0]!; } while (value >= limit);
  return value % maxExclusive;
}

export function randomIndex(rng: RandomInt, maxExclusive: number): number {
  const result = rng(maxExclusive);
  if (!Number.isInteger(result) || result < 0 || result >= maxExclusive) {
    throw new RangeError(`Injected RNG must return an integer within [0, ${maxExclusive})`);
  }
  return result;
}
