import type { CaveWorld, GridPoint } from '../game/types';
import { inBounds, isWalkable, tileIndex } from '../world/cave';

interface OpenNode extends GridPoint {
  g: number;
  f: number;
}

export function findPath(world: CaveWorld, start: GridPoint, goal: GridPoint): GridPoint[] {
  if (start.x === goal.x && start.y === goal.y) return [];
  if (!isWalkable(world, goal.x, goal.y)) return [];

  const size = world.width * world.height;
  const gScore = new Float64Array(size);
  gScore.fill(Number.POSITIVE_INFINITY);
  const cameFrom = new Int32Array(size);
  cameFrom.fill(-1);
  const closed = new Uint8Array(size);
  const open: OpenNode[] = [];
  const startIndex = tileIndex(start.x, start.y, world.width);
  gScore[startIndex] = 0;
  open.push({ ...start, g: 0, f: manhattan(start, goal) });

  while (open.length > 0) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      const candidate = open[index]!;
      const best = open[bestIndex]!;
      if (candidate.f < best.f || (candidate.f === best.f && candidate.g > best.g)) bestIndex = index;
    }

    const current = open.splice(bestIndex, 1)[0]!;
    const currentIndex = tileIndex(current.x, current.y, world.width);
    if (closed[currentIndex]) continue;
    closed[currentIndex] = 1;

    if (current.x === goal.x && current.y === goal.y) {
      return reconstruct(cameFrom, world.width, startIndex, currentIndex);
    }

    for (const next of neighbors(current)) {
      if (!inBounds(next.x, next.y, world.width, world.height) || !isWalkable(world, next.x, next.y)) continue;
      const nextIndex = tileIndex(next.x, next.y, world.width);
      if (closed[nextIndex]) continue;
      const tentativeG = current.g + 1;
      if (tentativeG >= gScore[nextIndex]!) continue;
      cameFrom[nextIndex] = currentIndex;
      gScore[nextIndex] = tentativeG;
      open.push({ ...next, g: tentativeG, f: tentativeG + manhattan(next, goal) });
    }
  }

  return [];
}

export function resolveGroupDestinations(
  world: CaveWorld,
  requested: GridPoint,
  count: number,
  occupiedKeys = new Set<string>(),
): GridPoint[] {
  const result: GridPoint[] = [];
  const visited = new Set<string>();
  const queue: GridPoint[] = [requested];
  visited.add(keyOf(requested));

  for (let cursor = 0; cursor < queue.length && result.length < count; cursor += 1) {
    const current = queue[cursor]!;
    const key = keyOf(current);
    if (isWalkable(world, current.x, current.y) && !occupiedKeys.has(key)) result.push(current);
    for (const next of ringNeighbors(current)) {
      const nextKey = keyOf(next);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      if (Math.abs(next.x - requested.x) > 9 || Math.abs(next.y - requested.y) > 9) continue;
      queue.push(next);
    }
  }

  return result;
}

function reconstruct(cameFrom: Int32Array, width: number, startIndex: number, goalIndex: number): GridPoint[] {
  const reversed: GridPoint[] = [];
  let current = goalIndex;
  while (current !== startIndex && current >= 0) {
    reversed.push({ x: current % width, y: Math.floor(current / width) });
    current = cameFrom[current]!;
  }
  return reversed.reverse();
}

function neighbors(point: GridPoint): GridPoint[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ];
}

function ringNeighbors(point: GridPoint): GridPoint[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y + 1 },
    { x: point.x + 1, y: point.y - 1 },
    { x: point.x - 1, y: point.y + 1 },
    { x: point.x - 1, y: point.y - 1 },
  ];
}

export function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function keyOf(point: GridPoint): string {
  return `${point.x},${point.y}`;
}
