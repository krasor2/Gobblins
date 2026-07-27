import {
  boundsCenter,
  boundsFromPoints,
  calculateBoundsZoom,
  calculateDynamicMinZoom,
} from '../src/input/cameraMath';

describe('camera framing math', () => {
  it('prevents unreadable zoom-out', () => {
    expect(calculateDynamicMinZoom({ width: 1920, height: 1080 }, { width: 1536, height: 1024 })).toBeGreaterThanOrEqual(0.9);
    expect(calculateDynamicMinZoom({ width: 360, height: 640 }, { width: 1536, height: 1024 })).toBe(0.9);
  });

  it('frames a selected group with padding', () => {
    const bounds = boundsFromPoints([{ x: 100, y: 100 }, { x: 220, y: 180 }]);
    const zoom = calculateBoundsZoom(bounds, { width: 1280, height: 720 }, 160, 0.9, 2.35);
    expect(zoom).toBeGreaterThanOrEqual(0.9);
    expect(zoom).toBeLessThanOrEqual(2.35);
    expect(boundsCenter(bounds)).toEqual({ x: 160.5, y: 140.5 });
  });
});
