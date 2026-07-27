export type MaterialId = 'limestone' | 'basalt' | 'violet_slate';
export type TileStructure = 'floor' | 'wall';
export type GoblinSex = 'female' | 'male';
export type Facing = 'up' | 'down' | 'left' | 'right';
export type GoblinProfile = 'front' | 'side' | 'back';

export interface GridPoint {
  x: number;
  y: number;
}

export interface CaveTile extends GridPoint {
  structure: TileStructure;
  materialId: MaterialId;
  variant: number;
  regionId: number;
}

export interface Chamber {
  id: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface CaveWorld {
  seed: number;
  width: number;
  height: number;
  tiles: CaveTile[];
  chambers: Chamber[];
  start: GridPoint;
}

export interface GoblinAppearance {
  skin: number;
  skinShadow: number;
  skinHighlight: number;
  outline: number;
  eye: number;
  hair: number;
  hairShadow: number;
  bodyId: string;
  headId: string;
  earId: string;
  frontHairId: string;
  backHairId: string;
  handId: string;
  footId: string;
}

export interface GoblinEntity {
  id: string;
  name: string;
  sex: GoblinSex;
  raceId: 'goblin';
  subraceId: 'cave_goblin';
  appearance: GoblinAppearance;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  facing: Facing;
  path: GridPoint[];
  selected: boolean;
  hovered: boolean;
  moving: boolean;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export interface WorldBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
