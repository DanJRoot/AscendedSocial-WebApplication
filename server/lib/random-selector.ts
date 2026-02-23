// Random Selector using cryptographic randomness
// Ensures true randomness for Oracle page (no bias toward trending/recent)

export function secureRandomInt(max: number): number {
  // Use crypto.getRandomValues for true randomness
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function secureRandomChoice<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("Cannot select from empty array");
  }
  return items[secureRandomInt(items.length)];
}

export function secureRandomBoolean(): boolean {
  return secureRandomInt(2) === 0;
}
