import { minimumPairDistance, resolveSpawnFormation } from '../src/creatures/SpawnFormationResolver';
import { generateCave, isWalkable } from '../src/world/cave';

describe('spawn formation', () => {
  it('places six deterministic goblins on distinct walkable tiles', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const world = generateCave(seed);
      const request = { centerTile: world.start, unitCount: 6, minimumTileDistance: 2, maximumRadius: 12 };
      const first = resolveSpawnFormation(world, request);
      const second = resolveSpawnFormation(world, request);
      expect(first, `determinism seed ${seed}`).toEqual(second);
      expect(first, `count seed ${seed}`).toHaveLength(6);
      expect(new Set(first.map((point) => `${point.x},${point.y}`)).size, `unique seed ${seed}`).toBe(6);
      expect(minimumPairDistance(first), `spacing seed ${seed}`).toBeGreaterThanOrEqual(1.99);
      for (const point of first) expect(isWalkable(world, point.x, point.y), `walkable seed ${seed}`).toBe(true);
    }
  });
});
