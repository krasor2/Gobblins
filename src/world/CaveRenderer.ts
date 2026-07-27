import Phaser from 'phaser';
import { hashNumbers } from '../core/random';
import type { CaveTile, CaveWorld, MaterialId } from '../game/types';
import { getTile, TILE_SIZE } from './cave';

interface MaterialPalette {
  floor: number;
  floorAlt: number;
  floorDark: number;
  mass: number;
  wallTop: number;
  wallFace: number;
  edge: number;
  highlight: number;
  crack: number;
}

const PALETTES: Record<MaterialId, MaterialPalette> = {
  limestone: {
    floor: 0x666571,
    floorAlt: 0x6d6b77,
    floorDark: 0x55545f,
    mass: 0x34333c,
    wallTop: 0x777580,
    wallFace: 0x4b4a54,
    edge: 0x292831,
    highlight: 0x96939e,
    crack: 0x41404a,
  },
  basalt: {
    floor: 0x302f39,
    floorAlt: 0x35343e,
    floorDark: 0x272630,
    mass: 0x17161d,
    wallTop: 0x45434e,
    wallFace: 0x292832,
    edge: 0x0f0e13,
    highlight: 0x65616f,
    crack: 0x1d1c24,
  },
  violet_slate: {
    floor: 0x443949,
    floorAlt: 0x493d4f,
    floorDark: 0x382f3d,
    mass: 0x211b25,
    wallTop: 0x604b66,
    wallFace: 0x382d3d,
    edge: 0x17121a,
    highlight: 0x82678a,
    crack: 0x2b2230,
  },
};

export class CaveRenderer {
  private image: Phaser.GameObjects.Image | null = null;
  private textureKey: string | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  render(world: CaveWorld): void {
    this.destroyTexture();
    const worldWidth = world.width * TILE_SIZE;
    const worldHeight = world.height * TILE_SIZE;
    const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });

    graphics.fillStyle(0x0b0910, 1).fillRect(0, 0, worldWidth, worldHeight);
    this.drawRockMass(graphics, world);
    this.drawFloors(graphics, world);
    this.drawMaterialTransitions(graphics, world);
    this.drawWallFaces(graphics, world);
    this.drawFloorOcclusion(graphics, world);
    this.drawFloorDetails(graphics, world);

    this.textureKey = `cave-world-${world.seed}-${Date.now()}`;
    graphics.generateTexture(this.textureKey, worldWidth, worldHeight);
    graphics.destroy();
    this.image = this.scene.add.image(0, 0, this.textureKey).setOrigin(0).setDepth(0);
  }

  destroy(): void {
    this.destroyTexture();
  }

  private destroyTexture(): void {
    this.image?.destroy();
    this.image = null;
    if (this.textureKey && this.scene.textures.exists(this.textureKey)) this.scene.textures.remove(this.textureKey);
    this.textureKey = null;
  }

  private drawRockMass(graphics: Phaser.GameObjects.Graphics, world: CaveWorld): void {
    for (const tile of world.tiles) {
      if (tile.structure !== 'wall') continue;
      const palette = PALETTES[tile.materialId];
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      graphics.fillStyle(palette.mass, 1).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      if (tile.variant === 2 || tile.variant === 6) {
        graphics.fillStyle(palette.wallTop, 0.13).fillRect(x + 3, y + 4, 8, 1);
      }
    }
  }

  private drawFloors(graphics: Phaser.GameObjects.Graphics, world: CaveWorld): void {
    for (const tile of world.tiles) {
      if (tile.structure !== 'floor') continue;
      const palette = PALETTES[tile.materialId];
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      const base = tile.variant === 0 || tile.variant === 5 ? palette.floorAlt : palette.floor;
      graphics.fillStyle(base, 1).fillRect(x, y, TILE_SIZE, TILE_SIZE);
      if (tile.variant === 7) graphics.fillStyle(palette.floorDark, 0.22).fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
  }

  private drawWallFaces(graphics: Phaser.GameObjects.Graphics, world: CaveWorld): void {
    for (const tile of world.tiles) {
      if (tile.structure !== 'wall') continue;
      const north = getTile(world, tile.x, tile.y - 1);
      const south = getTile(world, tile.x, tile.y + 1);
      const west = getTile(world, tile.x - 1, tile.y);
      const east = getTile(world, tile.x + 1, tile.y);
      if (![north, south, west, east].some((neighbor) => neighbor?.structure === 'floor')) continue;

      const palette = PALETTES[tile.materialId];
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      const irregular = (hashNumbers(world.seed, tile.x, tile.y, 0x4544_4745) % 3) - 1;

      if (south?.structure === 'floor') {
        const topY = y + 5 + irregular;
        graphics.fillStyle(palette.wallTop, 1).fillRect(x, topY, TILE_SIZE, 5 - irregular);
        graphics.fillStyle(palette.wallFace, 1).fillRect(x, y + 10, TILE_SIZE, 5);
        graphics.fillStyle(palette.edge, 1).fillRect(x, y + 15, TILE_SIZE, 1);
        graphics.fillStyle(palette.highlight, 0.18).fillRect(x + 1, topY, TILE_SIZE - 2, 1);
        if (tile.variant % 3 === 0) {
          graphics.fillStyle(palette.crack, 0.55).fillRect(x + 4, y + 11, 1, 3).fillRect(x + 5, y + 13, 3, 1);
        }
      }
      if (north?.structure === 'floor') {
        graphics.fillStyle(palette.edge, 0.9).fillRect(x, y, TILE_SIZE, 2);
        graphics.fillStyle(palette.wallTop, 0.55).fillRect(x, y + 2, TILE_SIZE, 2);
      }
      if (west?.structure === 'floor') {
        graphics.fillStyle(palette.wallTop, 0.75).fillRect(x, y + 2, 3, TILE_SIZE - 4);
        graphics.fillStyle(palette.edge, 0.85).fillRect(x, y, 1, TILE_SIZE);
      }
      if (east?.structure === 'floor') {
        graphics.fillStyle(palette.wallTop, 0.65).fillRect(x + TILE_SIZE - 3, y + 2, 3, TILE_SIZE - 4);
        graphics.fillStyle(palette.edge, 0.85).fillRect(x + TILE_SIZE - 1, y, 1, TILE_SIZE);
      }

      this.drawCorners(graphics, world, tile, palette);
    }
  }

  private drawCorners(
    graphics: Phaser.GameObjects.Graphics,
    world: CaveWorld,
    tile: CaveTile,
    palette: MaterialPalette,
  ): void {
    const x = tile.x * TILE_SIZE;
    const y = tile.y * TILE_SIZE;
    const nw = getTile(world, tile.x - 1, tile.y - 1);
    const ne = getTile(world, tile.x + 1, tile.y - 1);
    const sw = getTile(world, tile.x - 1, tile.y + 1);
    const se = getTile(world, tile.x + 1, tile.y + 1);
    if (nw?.structure === 'floor') graphics.fillStyle(palette.highlight, 0.24).fillTriangle(x, y, x + 5, y, x, y + 5);
    if (ne?.structure === 'floor') graphics.fillStyle(palette.highlight, 0.2).fillTriangle(x + 16, y, x + 11, y, x + 16, y + 5);
    if (sw?.structure === 'floor') graphics.fillStyle(palette.edge, 0.65).fillTriangle(x, y + 16, x + 5, y + 16, x, y + 11);
    if (se?.structure === 'floor') graphics.fillStyle(palette.edge, 0.65).fillTriangle(x + 16, y + 16, x + 11, y + 16, x + 16, y + 11);
  }

  private drawFloorOcclusion(graphics: Phaser.GameObjects.Graphics, world: CaveWorld): void {
    for (const tile of world.tiles) {
      if (tile.structure !== 'floor') continue;
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      if (getTile(world, tile.x, tile.y - 1)?.structure === 'wall') {
        graphics.fillStyle(0x09070d, 0.34).fillRect(x, y, TILE_SIZE, 4);
        graphics.fillStyle(0x09070d, 0.14).fillRect(x, y + 4, TILE_SIZE, 2);
      }
      if (getTile(world, tile.x - 1, tile.y)?.structure === 'wall') {
        graphics.fillStyle(0x09070d, 0.2).fillRect(x, y, 2, TILE_SIZE);
      }
      if (getTile(world, tile.x + 1, tile.y)?.structure === 'wall') {
        graphics.fillStyle(0x09070d, 0.16).fillRect(x + TILE_SIZE - 2, y, 2, TILE_SIZE);
      }
    }
  }

  private drawFloorDetails(graphics: Phaser.GameObjects.Graphics, world: CaveWorld): void {
    for (const tile of world.tiles) {
      if (tile.structure !== 'floor') continue;
      const roll = hashNumbers(world.seed, tile.x, tile.y, 0x4445_544c) % 100;
      if (roll >= 28) continue;
      const palette = PALETTES[tile.materialId];
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      const variant = hashNumbers(world.seed, tile.x, tile.y, 0x4352_414b) % 5;
      if (variant === 0) {
        graphics.fillStyle(palette.crack, 0.48).fillRect(x + 4, y + 5, 4, 1).fillRect(x + 7, y + 6, 1, 3);
      } else if (variant === 1) {
        graphics.fillStyle(palette.highlight, 0.25).fillRect(x + 4, y + 8, 2, 1).fillRect(x + 10, y + 5, 1, 1);
      } else if (variant === 2) {
        graphics.fillStyle(palette.floorDark, 0.26).fillEllipse(x + 8, y + 9, 8, 4);
      } else if (variant === 3) {
        graphics.fillStyle(palette.highlight, 0.18).fillRect(x + 3, y + 4, 1, 1).fillRect(x + 7, y + 11, 1, 1).fillRect(x + 12, y + 7, 1, 1);
      } else {
        graphics.fillStyle(palette.crack, 0.34).fillRect(x + 9, y + 4, 1, 4).fillRect(x + 7, y + 7, 3, 1);
      }
    }
  }

  private drawMaterialTransitions(graphics: Phaser.GameObjects.Graphics, world: CaveWorld): void {
    for (const tile of world.tiles) {
      if (tile.structure !== 'floor') continue;
      const x = tile.x * TILE_SIZE;
      const y = tile.y * TILE_SIZE;
      const east = getTile(world, tile.x + 1, tile.y);
      const south = getTile(world, tile.x, tile.y + 1);
      if (east?.structure === 'floor' && east.materialId !== tile.materialId) {
        const neighbor = PALETTES[east.materialId];
        graphics.fillStyle(neighbor.floor, 0.35).fillRect(x + 14, y + 3, 1, 2).fillRect(x + 12, y + 9, 2, 1).fillRect(x + 15, y + 13, 1, 1);
      }
      if (south?.structure === 'floor' && south.materialId !== tile.materialId) {
        const neighbor = PALETTES[south.materialId];
        graphics.fillStyle(neighbor.floor, 0.32).fillRect(x + 3, y + 14, 2, 1).fillRect(x + 9, y + 12, 1, 2).fillRect(x + 13, y + 15, 1, 1);
      }
    }
  }
}
