export class SeededRandom {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashString(seed);
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty array.');
    return items[this.int(0, items.length - 1)] as T;
  }
}

export function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function hashNumbers(...values: number[]): number {
  let hash = 2_166_136_261;
  for (const value of values) {
    hash ^= value >>> 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function hash01(...values: number[]): number {
  return hashNumbers(...values) / 0xffff_ffff;
}
