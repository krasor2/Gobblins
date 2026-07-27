import { hashNumbers, SeededRandom } from '../core/random';
import type { GoblinAppearance, GoblinEntity, GoblinSex, GridPoint } from '../game/types';
import { TILE_SIZE } from '../world/cave';

const FEMALE_NAMES = ['Morga', 'Vesha', 'Rikka', 'Nym', 'Krosha', 'Ziva', 'Urra', 'Skrel'] as const;
const MALE_NAMES = ['Gruk', 'Varr', 'Mok', 'Ruz', 'Krag', 'Drek', 'Skarn', 'Ugg'] as const;
const SKINS = [0x77747d, 0x66636d, 0x56535e, 0x47454f, 0x393842, 0x2c2b35] as const;
const EYES = [0xa855f7, 0xc026d3, 0xe11d48, 0xf43f5e, 0xdc2626] as const;
const HAIRS = [0xf8fafc, 0xe5e7eb, 0xd8d6e2] as const;

interface WeightedPart {
  id: string;
  weight: number;
  femaleWeight?: number;
  maleWeight?: number;
}

const BODIES: readonly WeightedPart[] = [
  { id: 'compact', weight: 1.2, femaleWeight: 1.05, maleWeight: 1.05 },
  { id: 'slender', weight: 1, femaleWeight: 1.2, maleWeight: 0.85 },
  { id: 'wide', weight: 1, femaleWeight: 0.85, maleWeight: 1.25 },
  { id: 'pear_shaped', weight: 0.9, femaleWeight: 1.2, maleWeight: 0.8 },
];

const HEADS: readonly WeightedPart[] = [
  { id: 'round', weight: 1.2 },
  { id: 'wide_jaw', weight: 1, maleWeight: 1.15 },
  { id: 'long_nose', weight: 1 },
  { id: 'flat_top', weight: 0.9 },
  { id: 'small_chin', weight: 1, femaleWeight: 1.15 },
];

const EARS: readonly WeightedPart[] = [
  { id: 'short_round', weight: 0.9 },
  { id: 'long_horizontal', weight: 1.2 },
  { id: 'long_upturned', weight: 1 },
  { id: 'drooping', weight: 0.9 },
  { id: 'torn_left', weight: 0.65 },
  { id: 'asymmetric', weight: 0.75 },
];

const FRONT_HAIR: readonly WeightedPart[] = [
  { id: 'split_fringe', weight: 1.1 },
  { id: 'left_sweep', weight: 1 },
  { id: 'right_sweep', weight: 1 },
  { id: 'short_spikes', weight: 1.1 },
  { id: 'single_lock', weight: 0.9 },
  { id: 'brow_curtain', weight: 0.7 },
];

const BACK_HAIR: readonly WeightedPart[] = [
  { id: 'cropped', weight: 1.1 },
  { id: 'neck_tuft', weight: 1 },
  { id: 'long_back', weight: 0.8, femaleWeight: 1.15 },
  { id: 'mohawk', weight: 0.8, maleWeight: 1.1 },
  { id: 'side_tail', weight: 0.75 },
];

const HANDS: readonly WeightedPart[] = [
  { id: 'round', weight: 1.2 },
  { id: 'wide', weight: 0.9 },
  { id: 'knuckled', weight: 0.8 },
];

const FEET: readonly WeightedPart[] = [
  { id: 'round', weight: 1.2 },
  { id: 'wide', weight: 1 },
  { id: 'pointed', weight: 0.75 },
];

export function createGoblinEntity(seed: number, index: number, spawn: GridPoint): GoblinEntity {
  const rng = new SeededRandom(hashNumbers(seed, index + 1, 0x474f_424c));
  const sex: GoblinSex = rng.chance(0.5) ? 'female' : 'male';
  const skin = rng.pick(SKINS);
  const hair = rng.pick(HAIRS);
  return {
    id: `goblin-${index + 1}`,
    name: rng.pick(sex === 'female' ? FEMALE_NAMES : MALE_NAMES),
    sex,
    raceId: 'goblin',
    subraceId: 'cave_goblin',
    appearance: {
      skin,
      skinShadow: shade(skin, 0.68),
      skinHighlight: mix(skin, 0xb9b1c2, 0.28),
      outline: skin <= 0x35353f ? 0x4c4856 : 0x17141e,
      eye: rng.pick(EYES),
      hair,
      hairShadow: shade(hair, 0.7),
      bodyId: weightedPick(rng, BODIES, sex),
      headId: weightedPick(rng, HEADS, sex),
      earId: weightedPick(rng, EARS, sex),
      frontHairId: weightedPick(rng, FRONT_HAIR, sex),
      backHairId: weightedPick(rng, BACK_HAIR, sex),
      handId: weightedPick(rng, HANDS, sex),
      footId: weightedPick(rng, FEET, sex),
    },
    tileX: spawn.x,
    tileY: spawn.y,
    worldX: spawn.x * TILE_SIZE + TILE_SIZE / 2,
    worldY: spawn.y * TILE_SIZE + TILE_SIZE / 2,
    facing: 'down',
    path: [],
    selected: false,
    hovered: false,
    moving: false,
  };
}

function weightedPick(rng: SeededRandom, parts: readonly WeightedPart[], sex: GoblinSex): string {
  const weighted = parts.map((part) => ({
    part,
    weight: part.weight * (sex === 'female' ? part.femaleWeight ?? 1 : part.maleWeight ?? 1),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.float(0, total);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.part.id;
  }
  return weighted[weighted.length - 1]!.part.id;
}

function shade(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function mix(left: number, right: number, amount: number): number {
  const channel = (shift: number): number => {
    const a = (left >> shift) & 0xff;
    const b = (right >> shift) & 0xff;
    return Math.round(a + (b - a) * amount);
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export function appearanceSignature(appearance: GoblinAppearance): string {
  return [
    appearance.bodyId,
    appearance.headId,
    appearance.earId,
    appearance.frontHairId,
    appearance.backHairId,
    appearance.handId,
    appearance.footId,
    appearance.skin.toString(16),
    appearance.eye.toString(16),
  ].join(':');
}
