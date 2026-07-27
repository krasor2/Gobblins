import Phaser from 'phaser';
import type { GoblinEntity, GoblinProfile } from '../game/types';

export class GoblinView extends Phaser.GameObjects.Container {
  readonly entity: GoblinEntity;

  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly hoverRing: Phaser.GameObjects.Ellipse;
  private readonly selectionRing: Phaser.GameObjects.Ellipse;
  private readonly selectionMarker: Phaser.GameObjects.Graphics;
  private readonly backHair: Phaser.GameObjects.Graphics;
  private readonly backEar: Phaser.GameObjects.Graphics;
  private readonly backHand: Phaser.GameObjects.Graphics;
  private readonly backFoot: Phaser.GameObjects.Graphics;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly frontFoot: Phaser.GameObjects.Graphics;
  private readonly frontHand: Phaser.GameObjects.Graphics;
  private readonly frontEar: Phaser.GameObjects.Graphics;
  private readonly head: Phaser.GameObjects.Graphics;
  private readonly eyes: Phaser.GameObjects.Graphics;
  private readonly faceDetails: Phaser.GameObjects.Graphics;
  private readonly frontHair: Phaser.GameObjects.Graphics;

  private phase = 0;
  private lastProfile: GoblinProfile | null = null;

  constructor(scene: Phaser.Scene, entity: GoblinEntity) {
    super(scene, entity.worldX, entity.worldY);
    this.entity = entity;

    this.shadow = scene.add.ellipse(0, 8, 18, 6, 0x050409, 0.52);
    this.hoverRing = scene.add.ellipse(0, 8, 24, 10, 0xffffff, 0).setStrokeStyle(1, 0xe9d5ff, 0.9);
    this.selectionRing = scene.add.ellipse(0, 8, 25, 11, 0xd946ef, 0.1).setStrokeStyle(2, 0xf0abfc, 1);
    this.selectionMarker = scene.add.graphics();
    this.backHair = scene.add.graphics();
    this.backEar = scene.add.graphics();
    this.backHand = scene.add.graphics();
    this.backFoot = scene.add.graphics();
    this.body = scene.add.graphics();
    this.frontFoot = scene.add.graphics();
    this.frontHand = scene.add.graphics();
    this.frontEar = scene.add.graphics();
    this.head = scene.add.graphics();
    this.eyes = scene.add.graphics();
    this.faceDetails = scene.add.graphics();
    this.frontHair = scene.add.graphics();

    this.add([
      this.shadow,
      this.hoverRing,
      this.selectionRing,
      this.backHair,
      this.backEar,
      this.backHand,
      this.backFoot,
      this.body,
      this.frontFoot,
      this.frontHand,
      this.frontEar,
      this.head,
      this.eyes,
      this.faceDetails,
      this.frontHair,
      this.selectionMarker,
    ]);

    scene.add.existing(this);
    this.setSize(28, 38);
    this.setInteractive(new Phaser.Geom.Rectangle(-14, -29, 28, 39), Phaser.Geom.Rectangle.Contains);
    this.on(Phaser.Input.Events.POINTER_OVER, () => { this.entity.hovered = true; });
    this.on(Phaser.Input.Events.POINTER_OUT, () => { this.entity.hovered = false; });
    this.redrawForProfile();
  }

  update(deltaSeconds: number): void {
    const profile = this.profile;
    if (profile !== this.lastProfile) this.redrawForProfile();

    this.phase += deltaSeconds * (this.entity.moving ? 10.5 : 2.1);
    const moving = this.entity.moving;
    const wave = Math.sin(this.phase);
    const bob = moving ? Math.round(Math.abs(wave) * -2) : Math.round(wave * 0.45);
    const swing = moving ? Math.round(wave * 3) : Math.round(wave * 0.5);
    const step = moving ? Math.round(wave * 2.2) : 0;

    for (const part of [this.body, this.head, this.backEar, this.frontEar, this.eyes, this.faceDetails]) {
      part.setPosition(0, bob);
    }
    this.frontHair.setPosition(0, bob - (moving ? Math.sign(wave) : 0));
    this.backHair.setPosition(0, bob + (moving ? 1 : 0));
    this.backHand.setPosition(0, bob - swing);
    this.frontHand.setPosition(0, bob + swing);
    this.backFoot.setPosition(-step, Math.max(0, -bob));
    this.frontFoot.setPosition(step, Math.max(0, -bob));
    this.shadow.setScale(1 - Math.abs(bob) * 0.04, 1);

    this.hoverRing.setVisible(this.entity.hovered && !this.entity.selected);
    this.selectionRing.setVisible(this.entity.selected);
    this.selectionMarker.setVisible(this.entity.selected);
    this.setPosition(Math.round(this.entity.worldX), Math.round(this.entity.worldY));
    this.setDepth(this.entity.worldY + (this.entity.selected ? 0.2 : 0));
    this.setScale(this.entity.facing === 'left' ? -1 : 1, 1);
  }

  private get profile(): GoblinProfile {
    if (this.entity.facing === 'up') return 'back';
    if (this.entity.facing === 'left' || this.entity.facing === 'right') return 'side';
    return 'front';
  }

  private redrawForProfile(): void {
    this.lastProfile = this.profile;
    for (const graphic of [
      this.backHair,
      this.backEar,
      this.backHand,
      this.backFoot,
      this.body,
      this.frontFoot,
      this.frontHand,
      this.frontEar,
      this.head,
      this.eyes,
      this.faceDetails,
      this.frontHair,
      this.selectionMarker,
    ]) graphic.clear();

    this.drawSelectionMarker();
    this.drawBody();
    this.drawHead();
    this.drawEars();
    this.drawHair();
    this.drawLimbs();
    this.drawFace();
  }

  private drawSelectionMarker(): void {
    this.selectionMarker
      .fillStyle(0x3b173f, 0.95)
      .fillTriangle(0, -33, -4, -28, 4, -28)
      .lineStyle(1, 0xf5d0fe, 1)
      .strokeTriangle(0, -33, -4, -28, 4, -28);
  }

  private drawBody(): void {
    const appearance = this.entity.appearance;
    const dimensions: Record<string, { width: number; height: number; x: number }> = {
      compact: { width: 13, height: 14, x: 0 },
      slender: { width: 10, height: 15, x: 0 },
      wide: { width: 15, height: 13, x: 0 },
      pear_shaped: { width: 14, height: 15, x: 0 },
    };
    const shape = dimensions[appearance.bodyId] ?? dimensions.compact!;
    const top = -13;
    this.body
      .fillStyle(appearance.outline)
      .fillRoundedRect(shape.x - shape.width / 2 - 1, top - 1, shape.width + 2, shape.height + 2, 4)
      .fillStyle(appearance.skinShadow)
      .fillRoundedRect(shape.x - shape.width / 2, top, shape.width, shape.height, 4)
      .fillStyle(appearance.skin)
      .fillRoundedRect(shape.x - shape.width / 2 + 1, top, shape.width - 2, Math.max(5, shape.height - 6), 3)
      .fillStyle(0x292130)
      .fillRect(shape.x - shape.width / 2, -4, shape.width, 5)
      .fillStyle(0x765535)
      .fillRect(shape.x - shape.width / 2, -5, shape.width, 2);

    if (appearance.bodyId === 'pear_shaped') {
      this.body.fillStyle(appearance.skinShadow).fillEllipse(0, -4, shape.width + 1, 8);
    }
    if (appearance.bodyId === 'wide') {
      this.body.fillStyle(0x9b8b5b).fillRect(-1, -4, 2, 5);
    }
  }

  private drawHead(): void {
    const appearance = this.entity.appearance;
    const profile = this.profile;
    let width = 14;
    let height = 11;
    let x = 0;
    if (appearance.headId === 'wide_jaw') width = 16;
    if (appearance.headId === 'small_chin') height = 10;
    if (appearance.headId === 'long_nose' && profile === 'side') x = 1;
    if (appearance.headId === 'flat_top') height = 10;

    this.head
      .fillStyle(appearance.outline)
      .fillRoundedRect(x - width / 2 - 1, -25, width + 2, height + 2, appearance.headId === 'flat_top' ? 2 : 5)
      .fillStyle(appearance.skin)
      .fillRoundedRect(x - width / 2, -24, width, height, appearance.headId === 'flat_top' ? 2 : 4)
      .fillStyle(appearance.skinHighlight, 0.48)
      .fillRect(x - width / 2 + 2, -23, Math.max(3, width - 7), 2)
      .fillStyle(appearance.skinShadow)
      .fillRect(x - 2, -15, 4, 2);

    if (appearance.headId === 'long_nose' && profile !== 'back') {
      if (profile === 'side') {
        this.head
          .fillStyle(appearance.outline)
          .fillTriangle(5, -20, 11, -18, 5, -16)
          .fillStyle(appearance.skin)
          .fillTriangle(5, -19, 10, -18, 5, -17);
      } else {
        this.head.fillStyle(appearance.skinShadow).fillTriangle(-1, -20, 2, -17, -2, -17);
      }
    }
  }

  private drawEars(): void {
    const appearance = this.entity.appearance;
    const profile = this.profile;
    const ear = appearance.earId;
    const length = ear === 'short_round' ? 4 : ear === 'long_horizontal' ? 8 : ear === 'long_upturned' ? 7 : 6;
    const droop = ear === 'drooping' ? 3 : ear === 'long_upturned' ? -3 : 0;

    if (profile === 'side') {
      this.drawEarShape(this.backEar, -5, -20, -1, Math.max(3, length - 2), droop, true);
      this.drawEarShape(this.frontEar, 6, -20, 1, length, droop, ear === 'torn_left');
      return;
    }

    const leftLength = ear === 'asymmetric' ? Math.max(4, length - 2) : length;
    const rightLength = ear === 'torn_left' ? Math.max(4, length - 2) : length;
    this.drawEarShape(this.backEar, -7, -20, -1, leftLength, droop, ear === 'torn_left');
    this.drawEarShape(this.frontEar, 7, -20, 1, rightLength, droop, false);
  }

  private drawEarShape(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    direction: -1 | 1,
    length: number,
    droop: number,
    torn: boolean,
  ): void {
    const appearance = this.entity.appearance;
    const tipY = y + droop + (torn ? 2 : 0);
    graphics
      .fillStyle(appearance.outline)
      .fillTriangle(x, y - 3, x + direction * (length + 1), tipY, x, y + 4)
      .fillStyle(appearance.skin)
      .fillTriangle(x, y - 2, x + direction * length, tipY, x, y + 3)
      .fillStyle(appearance.skinShadow, 0.65)
      .fillTriangle(x, y, x + direction * Math.max(2, length - 2), tipY, x, y + 2);
  }

  private drawHair(): void {
    const appearance = this.entity.appearance;
    const profile = this.profile;
    const outline = appearance.outline;

    if (appearance.backHairId === 'long_back') {
      this.backHair.fillStyle(outline).fillRoundedRect(-7, -27, 14, 17, 4)
        .fillStyle(appearance.hairShadow).fillRoundedRect(-6, -26, 12, 15, 3);
    } else if (appearance.backHairId === 'neck_tuft') {
      this.backHair.fillStyle(outline).fillTriangle(-5, -18, 5, -18, 0, -8)
        .fillStyle(appearance.hairShadow).fillTriangle(-4, -18, 4, -18, 0, -10);
    } else if (appearance.backHairId === 'mohawk') {
      this.backHair.fillStyle(outline).fillTriangle(-2, -28, 0, -34, 2, -28)
        .fillStyle(appearance.hair).fillTriangle(-1, -28, 0, -32, 1, -28);
    } else if (appearance.backHairId === 'side_tail') {
      this.backHair.fillStyle(outline).fillRoundedRect(3, -25, 7, 14, 3)
        .fillStyle(appearance.hairShadow).fillRoundedRect(4, -24, 5, 12, 2);
    } else {
      this.backHair.fillStyle(outline).fillRoundedRect(-7, -27, 14, 6, 3)
        .fillStyle(appearance.hairShadow).fillRoundedRect(-6, -26, 12, 4, 2);
    }

    if (profile === 'back') {
      this.frontHair.fillStyle(outline).fillRoundedRect(-8, -28, 16, 7, 3)
        .fillStyle(appearance.hair).fillRoundedRect(-7, -27, 14, 5, 2);
      return;
    }

    this.frontHair.fillStyle(outline).fillRoundedRect(-8, -28, 16, 6, 3)
      .fillStyle(appearance.hair).fillRoundedRect(-7, -27, 14, 4, 2);
    switch (appearance.frontHairId) {
      case 'split_fringe':
        this.frontHair.fillTriangle(-6, -23, -1, -23, -4, -17).fillTriangle(1, -23, 6, -23, 4, -17);
        break;
      case 'left_sweep':
        this.frontHair.fillTriangle(-7, -24, 2, -23, -4, -16);
        break;
      case 'right_sweep':
        this.frontHair.fillTriangle(-2, -23, 7, -24, 4, -16);
        break;
      case 'short_spikes':
        this.frontHair.fillTriangle(-6, -24, -2, -24, -4, -18).fillTriangle(-2, -24, 2, -24, 0, -17).fillTriangle(2, -24, 6, -24, 4, -18);
        break;
      case 'single_lock':
        this.frontHair.fillTriangle(-2, -24, 3, -24, 0, -15);
        break;
      case 'brow_curtain':
        this.frontHair.fillRoundedRect(-6, -24, 12, 7, 2);
        break;
    }
  }

  private drawLimbs(): void {
    const appearance = this.entity.appearance;
    const profile = this.profile;
    const handWidth = appearance.handId === 'wide' ? 7 : appearance.handId === 'knuckled' ? 6 : 5;
    const handHeight = appearance.handId === 'knuckled' ? 6 : 5;
    const footWidth = appearance.footId === 'wide' ? 8 : appearance.footId === 'pointed' ? 7 : 7;
    const footHeight = appearance.footId === 'pointed' ? 5 : 6;

    if (profile === 'side') {
      this.drawLimb(this.backHand, -7, -7, handWidth, handHeight, appearance.skinShadow, appearance.skin, appearance.outline);
      this.drawLimb(this.frontHand, 11, -6, handWidth, handHeight, appearance.skin, appearance.skinHighlight, appearance.outline);
      this.drawLimb(this.backFoot, -4, 7, footWidth, footHeight, appearance.skinShadow, appearance.skin, appearance.outline);
      this.drawLimb(this.frontFoot, 5, 7, footWidth, footHeight, appearance.skin, appearance.skinHighlight, appearance.outline);
      return;
    }

    this.drawLimb(this.backHand, -11, -7, handWidth, handHeight, appearance.skinShadow, appearance.skin, appearance.outline);
    this.drawLimb(this.frontHand, 11, -7, handWidth, handHeight, appearance.skin, appearance.skinHighlight, appearance.outline);
    this.drawLimb(this.backFoot, -5, 7, footWidth, footHeight, appearance.skinShadow, appearance.skin, appearance.outline);
    this.drawLimb(this.frontFoot, 5, 7, footWidth, footHeight, appearance.skin, appearance.skinHighlight, appearance.outline);
  }

  private drawLimb(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    main: number,
    highlight: number,
    outline: number,
  ): void {
    graphics.fillStyle(outline).fillEllipse(x, y, width + 2, height + 2)
      .fillStyle(main).fillEllipse(x, y, width, height)
      .fillStyle(highlight, 0.72).fillRect(x - 1, y - 2, 2, 1);
  }

  private drawFace(): void {
    const appearance = this.entity.appearance;
    const profile = this.profile;
    if (profile === 'back') return;

    if (profile === 'side') {
      this.eyes.fillStyle(0x120f18).fillRect(1, -21, 4, 4)
        .fillStyle(appearance.eye).fillRect(2, -20, 3, 3)
        .fillStyle(0xffffff).fillRect(2, -20, 1, 1);
    } else {
      this.eyes.fillStyle(0x120f18).fillRect(-5, -21, 4, 4).fillRect(1, -21, 4, 4)
        .fillStyle(appearance.eye).fillRect(-4, -20, 3, 3).fillRect(1, -20, 3, 3)
        .fillStyle(0xffffff).fillRect(-4, -20, 1, 1).fillRect(1, -20, 1, 1);
    }

    if (this.entity.appearance.headId === 'wide_jaw') {
      this.faceDetails.fillStyle(0xe8d8b3).fillTriangle(-5, -15, -2, -15, -3, -11).fillTriangle(2, -15, 5, -15, 3, -11);
    } else if (this.entity.appearance.headId === 'small_chin') {
      this.faceDetails.fillStyle(appearance.skinShadow).fillRect(-2, -15, 4, 1);
    }
  }
}
