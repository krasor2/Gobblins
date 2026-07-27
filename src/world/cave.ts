import { hashNumbers, SeededRandom } from '../core/random';
import type { CaveTile, CaveWorld, Chamber, GridPoint, MaterialId } from '../game/types';

export const TILE_SIZE = 16;
export const MAP_WIDTH = 96;
export const MAP_HEIGHT = 64;
const MATERIALS: readonly MaterialId[] = ['limestone', 'basalt', 'violet_slate'];

export function tileIndex(x: number, y: number, width = MAP_WIDTH): number {
  return y * width + x;
}

export function inBounds(x: number, y: number, width = MAP_WIDTH, height = MAP_HEIGHT): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function getTile(world: CaveWorld, x: number, y: number): CaveTile | undefined {
  return inBounds(x, y, world.width, world.height)
    ? world.tiles[tileIndex(x, y, world.width)]
    : undefined;
}

export function isWalkable(world: CaveWorld, x: number, y: number): boolean {
  return getTile(world, x, y)?.structure === 'floor';
}

export function generateCave(seed: number, width = MAP_WIDTH, height = MAP_HEIGHT): CaveWorld {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const attemptSeed = hashNumbers(seed, attempt * 0x9e37_79b9);
    const result = generateAttempt(attemptSeed, seed, width, height);
    if (validateCave(result)) return result;
  }
  return generateFallback(seed, width, height);
}

function generateAttempt(attemptSeed: number, publicSeed: number, width: number, height: number): CaveWorld {
  const rng = new SeededRandom(attemptSeed);
  const tiles = createWallGrid(width, height);
  const chambers: Chamber[] = [];
  const targetCount = rng.int(9, 14);
  const start: Chamber = {
    id: 0,
    x: Math.floor(width / 2),
    y: Math.floor(height / 2),
    rx: rng.int(9, 12),
    ry: rng.int(7, 9),
  };

  chambers.push(start);
  carveEllipse(tiles, width, height, start);

  for (let tries = 0; tries < 260 && chambers.length < targetCount; tries += 1) {
    const candidate: Chamber = {
      id: chambers.length,
      x: rng.int(8, width - 9),
      y: rng.int(7, height - 8),
      rx: rng.int(4, 9),
      ry: rng.int(4, 7),
    };
    const clear = chambers.every((room) => {
      const dx = candidate.x - room.x;
      const dy = candidate.y - room.y;
      const minX = candidate.rx + room.rx + 3;
      const minY = candidate.ry + room.ry + 3;
      return (dx * dx) / (minX * minX) + (dy * dy) / (minY * minY) > 1;
    });
    if (!clear) continue;
    chambers.push(candidate);
    carveEllipse(tiles, width, height, candidate);
  }

  connectAllChambers(tiles, width, height, chambers, rng);
  addExtraConnections(tiles, width, height, chambers, rng);
  cleanupWalls(tiles, width, height);
  assignMaterials(tiles, width, height, publicSeed);
  applyRegions(tiles, width, height, start);

  return {
    seed: publicSeed >>> 0,
    width,
    height,
    tiles,
    chambers,
    start: { x: start.x, y: start.y },
  };
}

function connectAllChambers(
  tiles: CaveTile[],
  width: number,
  height: number,
  chambers: Chamber[],
  rng: SeededRandom,
): void {
  const connected = new Set<number>([0]);
  while (connected.size < chambers.length) {
    let bestA = 0;
    let bestB = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const a of connected) {
      for (let b = 0; b < chambers.length; b += 1) {
        if (connected.has(b)) continue;
        const roomA = chambers[a]!;
        const roomB = chambers[b]!;
        const distance = distanceSq(roomA, roomB);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestA = a;
          bestB = b;
        }
      }
    }
    carveCorridor(tiles, width, height, chambers[bestA]!, chambers[bestB]!, rng);
    connected.add(bestB);
  }
}

function addExtraConnections(
  tiles: CaveTile[],
  width: number,
  height: number,
  chambers: Chamber[],
  rng: SeededRandom,
): void {
  const extraConnections = Math.max(1, Math.floor(chambers.length * 0.25));
  for (let index = 0; index < extraConnections; index += 1) {
    const from = rng.pick(chambers);
    const candidates = chambers
      .filter((room) => room.id !== from.id)
      .sort((left, right) => distanceSq(from, left) - distanceSq(from, right))
      .slice(0, 4);
    if (candidates.length > 0) carveCorridor(tiles, width, height, from, rng.pick(candidates), rng);
  }
}

function createWallGrid(width: number, height: number): CaveTile[] {
  const tiles: CaveTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles.push({ x, y, structure: 'wall', materialId: 'basalt', variant: 0, regionId: -1 });
    }
  }
  return tiles;
}

function carveEllipse(tiles: CaveTile[], width: number, height: number, chamber: Chamber): void {
  for (let y = chamber.y - chamber.ry; y <= chamber.y + chamber.ry; y += 1) {
    for (let x = chamber.x - chamber.rx; x <= chamber.x + chamber.rx; x += 1) {
      if (!inBounds(x, y, width, height)) continue;
      const nx = (x - chamber.x) / chamber.rx;
      const ny = (y - chamber.y) / chamber.ry;
      if (nx * nx + ny * ny <= 1) tiles[tileIndex(x, y, width)]!.structure = 'floor';
    }
  }
}

function carveCorridor(
  tiles: CaveTile[],
  width: number,
  height: number,
  from: Chamber,
  to: Chamber,
  rng: SeededRandom,
): void {
  let x = from.x;
  let y = from.y;
  const horizontalFirst = rng.chance(0.5);
  const carveStep = (): void => {
    const wobble = rng.chance(0.16) ? rng.pick([-1, 1] as const) : 0;
    carveDisc(tiles, width, height, x, y, 1);
    if (wobble !== 0) {
      carveDisc(
        tiles,
        width,
        height,
        x + (horizontalFirst ? 0 : wobble),
        y + (horizontalFirst ? wobble : 0),
        1,
      );
    }
  };
  const walkX = (): void => {
    while (x !== to.x) {
      x += Math.sign(to.x - x);
      carveStep();
    }
  };
  const walkY = (): void => {
    while (y !== to.y) {
      y += Math.sign(to.y - y);
      carveStep();
    }
  };
  if (horizontalFirst) {
    walkX();
    walkY();
  } else {
    walkY();
    walkX();
  }
}

function carveDisc(tiles: CaveTile[], width: number, height: number, cx: number, cy: number, radius: number): void {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (inBounds(x, y, width, height)) tiles[tileIndex(x, y, width)]!.structure = 'floor';
    }
  }
}

function cleanupWalls(tiles: CaveTile[], width: number, height: number): void {
  const snapshot = tiles.map((tile) => tile.structure);
  for (let y = 2; y < height - 2; y += 1) {
    for (let x = 2; x < width - 2; x += 1) {
      let floorCount = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (snapshot[tileIndex(x + ox, y + oy, width)] === 'floor') floorCount += 1;
        }
      }
      const tile = tiles[tileIndex(x, y, width)]!;
      if (tile.structure === 'wall' && floorCount >= 7) tile.structure = 'floor';
      if (tile.structure === 'floor' && floorCount <= 2) tile.structure = 'wall';
    }
  }
}

function assignMaterials(tiles: CaveTile[], width: number, height: number, seed: number): void {
  const rng = new SeededRandom(hashNumbers(seed, 0x4d41_544c));
  const fields = MATERIALS.map((materialId, index) => ({
    materialId,
    centers: Array.from({ length: index === 0 ? 4 : 3 }, () => ({
      x: rng.float(0, width),
      y: rng.float(0, height),
      strength: rng.float(0.72, 1.35),
    })),
  }));

  for (const tile of tiles) {
    let selected: MaterialId = 'limestone';
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const field of fields) {
      let score = Number.NEGATIVE_INFINITY;
      for (const center of field.centers) {
        const dx = (tile.x - center.x) / width;
        const dy = (tile.y - center.y) / height;
        score = Math.max(score, center.strength - Math.hypot(dx, dy) * 3.4);
      }
      const bias = field.materialId === 'limestone' ? 0.13 : field.materialId === 'basalt' ? 0.04 : -0.03;
      if (score + bias > bestScore) {
        bestScore = score + bias;
        selected = field.materialId;
      }
    }
    tile.materialId = selected;
    tile.variant = hashNumbers(seed, tile.x, tile.y, 0x5641_5249) % 8;
  }
}

function applyRegions(tiles: CaveTile[], width: number, height: number, start: GridPoint): void {
  const regions = markRegions(tiles, width, height, start.x, start.y);
  for (const tile of tiles) {
    tile.regionId = tile.structure === 'floor' ? regions[tileIndex(tile.x, tile.y, width)]! : -1;
  }
}

export function markRegions(
  tiles: readonly CaveTile[],
  width: number,
  height: number,
  startX: number,
  startY: number,
): number[] {
  const regions = new Array<number>(tiles.length).fill(-1);
  if (!inBounds(startX, startY, width, height)) return regions;
  const startIndex = tileIndex(startX, startY, width);
  if (tiles[startIndex]?.structure !== 'floor') return regions;
  const queue: GridPoint[] = [{ x: startX, y: startY }];
  regions[startIndex] = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    for (const next of orthogonalNeighbors(current.x, current.y)) {
      if (!inBounds(next.x, next.y, width, height)) continue;
      const index = tileIndex(next.x, next.y, width);
      if (regions[index] !== -1 || tiles[index]?.structure !== 'floor') continue;
      regions[index] = 0;
      queue.push(next);
    }
  }
  return regions;
}

export function validateCave(world: CaveWorld): boolean {
  const floors = world.tiles.filter((tile) => tile.structure === 'floor');
  const ratio = floors.length / world.tiles.length;
  if (ratio < 0.22 || ratio > 0.69 || world.chambers.length < 7) return false;
  if (!isWalkable(world, world.start.x, world.start.y)) return false;
  return floors.every((tile) => tile.regionId === 0);
}

function generateFallback(seed: number, width: number, height: number): CaveWorld {
  const tiles = createWallGrid(width, height);
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const chambers: Chamber[] = [
    { id: 0, x: cx, y: cy, rx: 12, ry: 9 },
    { id: 1, x: Math.floor(width * 0.27), y: Math.floor(height * 0.28), rx: 8, ry: 6 },
    { id: 2, x: Math.floor(width * 0.72), y: Math.floor(height * 0.27), rx: 8, ry: 6 },
    { id: 3, x: Math.floor(width * 0.23), y: Math.floor(height * 0.68), rx: 7, ry: 5 },
    { id: 4, x: Math.floor(width * 0.76), y: Math.floor(height * 0.7), rx: 9, ry: 6 },
    { id: 5, x: Math.floor(width * 0.5), y: Math.floor(height * 0.14), rx: 7, ry: 5 },
    { id: 6, x: Math.floor(width * 0.5), y: Math.floor(height * 0.84), rx: 7, ry: 5 },
  ];
  for (const chamber of chambers) carveEllipse(tiles, width, height, chamber);
  const rng = new SeededRandom(hashNumbers(seed, 0xfa11_bacc));
  for (let index = 1; index < chambers.length; index += 1) {
    carveCorridor(tiles, width, height, chambers[0]!, chambers[index]!, rng);
  }
  cleanupWalls(tiles, width, height);
  assignMaterials(tiles, width, height, seed);
  applyRegions(tiles, width, height, chambers[0]!);
  return { seed: seed >>> 0, width, height, tiles, chambers, start: { x: cx, y: cy } };
}

export function orthogonalNeighbors(x: number, y: number): GridPoint[] {
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ];
}

function distanceSq(a: GridPoint, b: GridPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
