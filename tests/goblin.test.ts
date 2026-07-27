import { appearanceSignature, createGoblinEntity } from '../src/creatures/goblin';

describe('cave goblin appearance', () => {
  it('is deterministic and uses complete modular slots', () => {
    const spawn = { x: 10, y: 12 };
    const left = createGoblinEntity(77, 0, spawn);
    const right = createGoblinEntity(77, 0, spawn);
    expect(left).toEqual(right);
    expect(appearanceSignature(left.appearance)).toBe(appearanceSignature(right.appearance));
    expect(left.appearance.bodyId).toBeTruthy();
    expect(left.appearance.headId).toBeTruthy();
    expect(left.appearance.earId).toBeTruthy();
    expect(left.appearance.frontHairId).toBeTruthy();
    expect(left.appearance.backHairId).toBeTruthy();
    expect(left.appearance.handId).toBeTruthy();
    expect(left.appearance.footId).toBeTruthy();
  });

  it('creates visible variation across a tribe', () => {
    const signatures = new Set(
      Array.from({ length: 12 }, (_, index) => appearanceSignature(createGoblinEntity(991, index, { x: 10 + index, y: 12 }).appearance)),
    );
    expect(signatures.size).toBeGreaterThanOrEqual(10);
  });
});
