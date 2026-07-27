import type { GridPoint, ScreenSize, WorldBounds } from '../game/types';

export const CAMERA_CONFIG = {
  absoluteMinimumZoom: 0.9,
  maximumZoom: 3,
  fitWorldMultiplier: 0.92,
  startingMaximumZoom: 1.85,
  wheelZoomIn: 1.12,
  wheelZoomOut: 0.89,
  worldPaddingPx: 96,
} as const;

export function calculateDynamicMinZoom(viewport: ScreenSize, world: ScreenSize): number {
  const fitZoom = Math.min(viewport.width / world.width, viewport.height / world.height);
  return clamp(
    Math.max(CAMERA_CONFIG.absoluteMinimumZoom, fitZoom * CAMERA_CONFIG.fitWorldMultiplier),
    CAMERA_CONFIG.absoluteMinimumZoom,
    CAMERA_CONFIG.maximumZoom,
  );
}

export function calculateBoundsZoom(
  bounds: WorldBounds,
  viewport: ScreenSize,
  paddingPx: number,
  minimumZoom: number,
  maximumZoom: number,
): number {
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const availableWidth = Math.max(1, viewport.width - paddingPx * 2);
  const availableHeight = Math.max(1, viewport.height - paddingPx * 2);
  return clamp(Math.min(availableWidth / width, availableHeight / height), minimumZoom, maximumZoom);
}

export function boundsFromPoints(points: readonly GridPoint[], pixelScale = 1): WorldBounds {
  if (points.length === 0) return { left: 0, top: 0, right: pixelScale, bottom: pixelScale };
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    left = Math.min(left, point.x * pixelScale);
    top = Math.min(top, point.y * pixelScale);
    right = Math.max(right, point.x * pixelScale);
    bottom = Math.max(bottom, point.y * pixelScale);
  }
  return { left, top, right: right + pixelScale, bottom: bottom + pixelScale };
}

export function boundsCenter(bounds: WorldBounds): GridPoint {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
