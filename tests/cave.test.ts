import { generateCave, isWalkable, validateCave } from '../src/world/cave';

const MATERIALS = new Set(['limestone', 'basalt', 'violet_slate']);

describe('cave generation', () => {
  it('is deterministic for the same seed', () => {
    const left = generateCave(123_456);
    const right = generateCave(123_456);
    expect(left.start).toEqual(right.start);
    expect(left.tiles).toEqual(right.tiles);
  });

  it('validates 200 consecutive seeds', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const world = generateCave(seed);
      expect(validateCave(world), `seed ${seed}`).toBe(true);
      expect(isWalkable(world, world.start.x, world.start.y), `start seed ${seed}`).toBe(true);
      for (const tile of world.tiles) {
        expect(MATERIALS.has(tile.materialId), `material seed ${seed}`).toBe(true);
        if (tile.structure === 'floor') expect(tile.regionId, `region seed ${seed}`).toBe(0);
        else expect(tile.regionId, `wall region seed ${seed}`).toBe(-1);
      }
    }
  });
});
