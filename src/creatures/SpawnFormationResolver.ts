import { hashNumbers } from '../core/random';
import type { CaveWorld, GridPoint } from '../game/types';
import { getTile, inBounds, isWalkable } from '../world/cave';

export interface SpawnFormationRequest {
  centerTile: GridPoint;
  unitCount: number;
  minimumTileDistance?: number;
  maximumRadius?: number;
}

interface Candidate extends GridPoint {
  wallClearance: number;
  centerDistance: number;
  tieBreaker: number;
}

export function resolveSpawnFormation(world: CaveWorld, request: SpawnFormationRequest): GridPoint[] {
  const desiredDistance = request.minimumTileDistance ?? 2;
  const maximumRadius = request.maximumRadius ?? 12;
  const candidates = collectCandidates(world, request.centerTile, maximumRadius);
  if (candidates.length < request.unitCount) {
    throw new Error(`Not enough walkable spawn tiles: ${candidates.length}/${request.unitCount}.`);
  }

  const thresholds = [desiredDistance, Math.max(1.5, desiredDistance * 0.75), 1];
  for (const threshold of thresholds) {
    const result = selectCandidates(candidates, request.centerTile, request.unitCount, threshold);
    if (result.length === request.unitCount) return sortClockwise(result, request.centerTile);
  }

  return sortClockwise(candidates.slice(0, request.unitCount), request.centerTile);
}

function collectCandidates(world: CaveWorld, center: GridPoint, radius: number): Candidate[] {
  const result: Candidate[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (!isWalkable(world, x, y)) continue;
      const tile = getTile(world, x, y);
      if (!tile || tile.regionId !== 0) continue;
      const centerDistance = Math.hypot(x - center.x, y - center.y);
      if (centerDistance > radius) continue;
      result.push({
        x,
        y,
        wallClearance: localWallClearance(world, x, y),
        centerDistance,
        tieBreaker: hashNumbers(world.seed, x, y, 0x5350_4157) / 0xffff_ffff,
      });
    }
  }

  return result.sort((left, right) => {
    const leftBase = left.wallClearance * 4 - Math.abs(left.centerDistance - 3.2) + left.tieBreaker * 0.05;
    const rightBase = right.wallClearance * 4 - Math.abs(right.centerDistance - 3.2) + right.tieBreaker * 0.05;
    return rightBase - leftBase;
  });
}

function selectCandidates(candidates: Candidate[], center: GridPoint, count: number, minimumDistance: number): GridPoint[] {
  const selected: Candidate[] = [];
  while (selected.length < count) {
    let best: Candidate | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      if (selected.includes(candidate)) continue;
      const nearestDistance = selected.length === 0
        ? minimumDistance + 2
        : Math.min(...selected.map((spawn) => Math.hypot(candidate.x - spawn.x, candidate.y - spawn.y)));
      if (nearestDistance + 0.001 < minimumDistance) continue;
      const quadrant = getQuadrant(candidate, center);
      const quadrantCount = selected.filter((spawn) => getQuadrant(spawn, center) === quadrant).length;
      const radialTarget = 3.1 + selected.length * 0.18;
      const score = candidate.wallClearance * 6
        + Math.min(nearestDistance, 5) * 5
        - Math.abs(candidate.centerDistance - radialTarget) * 1.8
        - quadrantCount * 5
        + candidate.tieBreaker * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) break;
    selected.push(best);
  }
  return selected.map(({ x, y }) => ({ x, y }));
}

function localWallClearance(world: CaveWorld, x: number, y: number): number {
  let score = 0;
  for (let oy = -2; oy <= 2; oy += 1) {
    for (let ox = -2; ox <= 2; ox += 1) {
      if (ox === 0 && oy === 0) continue;
      const distance = Math.max(Math.abs(ox), Math.abs(oy));
      if (!inBounds(x + ox, y + oy, world.width, world.height)) continue;
      if (isWalkable(world, x + ox, y + oy)) score += distance === 1 ? 2 : 0.4;
    }
  }
  return score;
}

function getQuadrant(point: GridPoint, center: GridPoint): number {
  const angle = Math.atan2(point.y - center.y, point.x - center.x);
  return Math.floor(((angle + Math.PI * 2 + Math.PI / 4) % (Math.PI * 2)) / (Math.PI / 2));
}

function sortClockwise(points: GridPoint[], center: GridPoint): GridPoint[] {
  return [...points].sort((left, right) => {
    const leftAngle = Math.atan2(left.y - center.y, left.x - center.x);
    const rightAngle = Math.atan2(right.y - center.y, right.x - center.x);
    return leftAngle - rightAngle;
  });
}

export function minimumPairDistance(points: readonly GridPoint[]): number {
  if (points.length < 2) return Number.POSITIVE_INFINITY;
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      const a = points[left]!;
      const b = points[right]!;
      minimum = Math.min(minimum, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  return minimum;
}
