import Phaser from 'phaser';
import { resolveSpawnFormation } from '../creatures/SpawnFormationResolver';
import { createGoblinEntity } from '../creatures/goblin';
import { GoblinView } from '../creatures/GoblinView';
import {
  GAME_EVENT,
  gameEvents,
  type SelectionInfoPayload,
  type WorldInfoPayload,
} from '../game/events';
import type { CaveWorld, GoblinEntity, GridPoint } from '../game/types';
import { CameraController } from '../input/CameraController';
import { findPath, manhattan, resolveGroupDestinations } from '../navigation/pathfinding';
import { CaveRenderer } from '../world/CaveRenderer';
import { generateCave, getTile, MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from '../world/cave';

const MOVE_SPEED = TILE_SIZE * 3.2;
const STARTING_GOBLINS = 6;

export class GameScene extends Phaser.Scene {
  private world!: CaveWorld;
  private seed = (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
  private caveRenderer!: CaveRenderer;
  private cameraController!: CameraController;
  private goblins: GoblinEntity[] = [];
  private goblinViews: GoblinView[] = [];
  private selectionGraphics!: Phaser.GameObjects.Graphics;
  private commandGraphics!: Phaser.GameObjects.Graphics;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private dragStart: Phaser.Math.Vector2 | null = null;
  private readonly pointerDownScreen = new Phaser.Math.Vector2();
  private clickedGoblin = false;
  private debugEnabled = false;

  constructor() {
    super('game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#09070d');
    this.selectionGraphics = this.add.graphics().setDepth(800);
    this.commandGraphics = this.add.graphics().setDepth(600);
    this.debugGraphics = this.add.graphics().setDepth(850);
    this.debugText = this.add.text(12, 100, '', {
      fontFamily: 'ui-monospace, monospace',
      fontSize: '13px',
      color: '#f5d0fe',
      stroke: '#0d0911',
      strokeThickness: 3,
    }).setScrollFactor(0).setDepth(900).setVisible(false);

    this.caveRenderer = new CaveRenderer(this);
    this.cameraController = new CameraController(this);
    this.configureInput();
    this.configureUiEvents();
    this.scene.launch('ui');
    this.regenerate(this.seed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroySystems, this);
  }

  update(_time: number, deltaMs: number): void {
    const deltaSeconds = Math.min(deltaMs / 1000, 0.05);
    this.cameraController.update(deltaSeconds);
    this.updateMovement(deltaSeconds);
    for (const view of this.goblinViews) view.update(deltaSeconds);
    this.updateSelectionBox();
    this.updateDebugOverlay();
  }

  private regenerate(seed: number): void {
    this.seed = seed >>> 0;
    this.world = generateCave(this.seed, MAP_WIDTH, MAP_HEIGHT);
    this.caveRenderer.render(this.world);
    this.cameraController.setWorldSize(this.world.width * TILE_SIZE, this.world.height * TILE_SIZE);
    this.destroyGoblins();

    const spawns = resolveSpawnFormation(this.world, {
      centerTile: this.world.start,
      unitCount: STARTING_GOBLINS,
      minimumTileDistance: 2,
      maximumRadius: 12,
    });
    this.goblins = spawns.map((spawn, index) => createGoblinEntity(this.seed, index, spawn));
    this.goblinViews = this.goblins.map((entity) => this.createGoblinView(entity));

    this.emitWorldInfo();
    this.emitSelectionInfo();
    this.time.delayedCall(0, () => this.frameTribe(175));
  }

  private createGoblinView(entity: GoblinEntity): GoblinView {
    const view = new GoblinView(this, entity);
    view.on(
      Phaser.Input.Events.POINTER_DOWN,
      (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        if (!pointer.leftButtonDown()) return;
        this.clickedGoblin = true;
        event.stopPropagation();
        this.selectGoblin(entity, Boolean(pointer.event.shiftKey));
      },
    );
    return view;
  }

  private configureInput(): void {
    this.input.mouse?.disableContextMenu();
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input unavailable.');

    keyboard.on('keydown-R', this.handleRegenerateKey);
    keyboard.on('keydown-F', this.frameSelection);
    keyboard.on('keydown-HOME', this.frameTribe);
    keyboard.on('keydown-ZERO', this.resetZoom);
    keyboard.on('keydown-ENTER', this.handleEnterKey);
    keyboard.on('keydown-BACKTICK', this.toggleDebug);
    keyboard.on('keydown-ESC', this.clearSelection);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
  }

  private configureUiEvents(): void {
    gameEvents.on(GAME_EVENT.newCave, this.handleNewCave);
    gameEvents.on(GAME_EVENT.sameCave, this.handleSameCave);
    gameEvents.on(GAME_EVENT.focusTribe, this.frameTribe);
    gameEvents.on(GAME_EVENT.focusSelection, this.frameSelection);
    gameEvents.on(GAME_EVENT.resetZoom, this.resetZoom);
    gameEvents.on(GAME_EVENT.toggleFullscreen, this.toggleFullscreen);
  }

  private readonly handleRegenerateKey = (event: KeyboardEvent): void => {
    this.regenerate(event.shiftKey ? this.seed : this.randomSeed());
  };

  private readonly handleEnterKey = (event: KeyboardEvent): void => {
    if (event.altKey) this.toggleFullscreen();
  };

  private readonly toggleDebug = (): void => {
    this.debugEnabled = !this.debugEnabled;
  };

  private readonly handleNewCave = (): void => {
    this.regenerate(this.randomSeed());
  };

  private readonly handleSameCave = (): void => {
    this.regenerate(this.seed);
  };

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.pointerDownScreen.set(pointer.x, pointer.y);
    if (pointer.rightButtonDown()) {
      this.issueMove(this.pointerWorld(pointer));
      return;
    }
    if (pointer.middleButtonDown()) return;
    this.clickedGoblin = false;
    this.dragStart = this.pointerWorld(pointer);
  };

  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (pointer.rightButtonReleased() || !this.dragStart) return;
    const end = this.pointerWorld(pointer);
    const screenDistance = Phaser.Math.Distance.Between(
      this.pointerDownScreen.x,
      this.pointerDownScreen.y,
      pointer.x,
      pointer.y,
    );
    const wasTouch = this.isTouchPointer(pointer);

    if (!this.clickedGoblin && screenDistance < 9) {
      if (wasTouch && this.selectedGoblins().length > 0) this.issueMove(end);
      else if (!pointer.event.shiftKey) this.clearSelection();
    } else if (!this.clickedGoblin && screenDistance >= 9) {
      this.selectInRectangle(this.dragStart, end, Boolean(pointer.event.shiftKey));
    }

    this.dragStart = null;
    this.selectionGraphics.clear();
  };

  private selectGoblin(entity: GoblinEntity, additive: boolean): void {
    if (!additive) this.goblins.forEach((goblin) => { goblin.selected = false; });
    entity.selected = additive ? !entity.selected : true;
    this.emitSelectionInfo();
  }

  private selectInRectangle(start: GridPoint, end: GridPoint, additive: boolean): void {
    const left = Math.min(start.x, end.x);
    const right = Math.max(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const bottom = Math.max(start.y, end.y);
    if (!additive) this.goblins.forEach((goblin) => { goblin.selected = false; });
    for (const goblin of this.goblins) {
      if (goblin.worldX >= left && goblin.worldX <= right && goblin.worldY >= top && goblin.worldY <= bottom) {
        goblin.selected = true;
      }
    }
    this.emitSelectionInfo();
  }

  private readonly clearSelection = (): void => {
    this.goblins.forEach((goblin) => { goblin.selected = false; });
    this.emitSelectionInfo();
  };

  private issueMove(worldPoint: GridPoint): void {
    const selected = this.selectedGoblins();
    if (selected.length === 0) return;
    const requested = {
      x: Math.floor(worldPoint.x / TILE_SIZE),
      y: Math.floor(worldPoint.y / TILE_SIZE),
    };
    const occupied = new Set(
      this.goblins
        .filter((goblin) => !goblin.selected)
        .map((goblin) => `${goblin.tileX},${goblin.tileY}`),
    );
    const targets = resolveGroupDestinations(this.world, requested, selected.length, occupied);
    if (targets.length === 0) {
      this.drawInvalidCommand(requested);
      return;
    }

    const unassigned = [...targets];
    const sorted = [...selected].sort(
      (left, right) => manhattan({ x: left.tileX, y: left.tileY }, requested) - manhattan({ x: right.tileX, y: right.tileY }, requested),
    );
    const assignedTargets: GridPoint[] = [];
    for (const goblin of sorted) {
      unassigned.sort(
        (left, right) => manhattan({ x: goblin.tileX, y: goblin.tileY }, left) - manhattan({ x: goblin.tileX, y: goblin.tileY }, right),
      );
      const target = unassigned.shift();
      if (!target) break;
      goblin.path = findPath(this.world, { x: goblin.tileX, y: goblin.tileY }, target);
      goblin.moving = goblin.path.length > 0;
      assignedTargets.push(target);
    }

    this.drawMoveCommand(requested, assignedTargets);
    gameEvents.emit(GAME_EVENT.firstCommand);
    this.emitSelectionInfo();
  }

  private drawMoveCommand(requested: GridPoint, targets: readonly GridPoint[]): void {
    this.tweens.killTweensOf(this.commandGraphics);
    this.commandGraphics.clear().setAlpha(1);
    const centerX = requested.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = requested.y * TILE_SIZE + TILE_SIZE / 2;
    this.commandGraphics.lineStyle(2, 0xf0abfc, 0.95).strokeCircle(centerX, centerY, 8);
    this.commandGraphics.lineStyle(1, 0xd8b4fe, 0.75);
    for (const target of targets) {
      this.commandGraphics.strokeCircle(target.x * TILE_SIZE + TILE_SIZE / 2, target.y * TILE_SIZE + TILE_SIZE / 2, 4);
    }
    this.tweens.add({
      targets: this.commandGraphics,
      alpha: 0,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => this.commandGraphics.clear().setAlpha(1),
    });
  }

  private drawInvalidCommand(requested: GridPoint): void {
    this.tweens.killTweensOf(this.commandGraphics);
    this.commandGraphics.clear().setAlpha(1);
    const x = requested.x * TILE_SIZE + TILE_SIZE / 2;
    const y = requested.y * TILE_SIZE + TILE_SIZE / 2;
    this.commandGraphics.lineStyle(2, 0xfb7185, 1).strokeCircle(x, y, 8)
      .beginPath().moveTo(x - 5, y - 5).lineTo(x + 5, y + 5).moveTo(x + 5, y - 5).lineTo(x - 5, y + 5).strokePath();
    this.tweens.add({
      targets: this.commandGraphics,
      alpha: 0,
      duration: 420,
      onComplete: () => this.commandGraphics.clear().setAlpha(1),
    });
  }

  private updateMovement(deltaSeconds: number): void {
    let selectionStateChanged = false;
    for (const goblin of this.goblins) {
      const next = goblin.path[0];
      if (!next) {
        if (goblin.moving) {
          goblin.moving = false;
          selectionStateChanged ||= goblin.selected;
        }
        continue;
      }

      const targetX = next.x * TILE_SIZE + TILE_SIZE / 2;
      const targetY = next.y * TILE_SIZE + TILE_SIZE / 2;
      const dx = targetX - goblin.worldX;
      const dy = targetY - goblin.worldY;
      const distance = Math.hypot(dx, dy);
      if (Math.abs(dx) > Math.abs(dy)) goblin.facing = dx < 0 ? 'left' : 'right';
      else goblin.facing = dy < 0 ? 'up' : 'down';

      const travel = MOVE_SPEED * deltaSeconds;
      if (distance <= travel || distance < 0.01) {
        goblin.worldX = targetX;
        goblin.worldY = targetY;
        goblin.tileX = next.x;
        goblin.tileY = next.y;
        goblin.path.shift();
      } else {
        goblin.worldX += (dx / distance) * travel;
        goblin.worldY += (dy / distance) * travel;
      }
    }
    if (selectionStateChanged) this.emitSelectionInfo();
  }

  private updateSelectionBox(): void {
    if (!this.dragStart || this.clickedGoblin || !this.input.activePointer.leftButtonDown()) return;
    const current = this.pointerWorld(this.input.activePointer);
    const x = Math.min(this.dragStart.x, current.x);
    const y = Math.min(this.dragStart.y, current.y);
    const width = Math.abs(current.x - this.dragStart.x);
    const height = Math.abs(current.y - this.dragStart.y);
    this.selectionGraphics.clear()
      .fillStyle(0xd946ef, 0.09).fillRect(x, y, width, height)
      .lineStyle(1, 0xf0abfc, 1).strokeRect(x, y, width, height);
  }

  private readonly frameTribe = (paddingPx = 175): void => {
    this.cameraController.framePoints(
      this.goblins.map((goblin) => ({ x: goblin.worldX, y: goblin.worldY })),
      typeof paddingPx === 'number' ? paddingPx : 175,
      1.85,
    );
  };

  private readonly frameSelection = (): void => {
    const selected = this.selectedGoblins();
    if (selected.length === 0) {
      this.frameTribe();
      return;
    }
    this.cameraController.framePoints(
      selected.map((goblin) => ({ x: goblin.worldX, y: goblin.worldY })),
      165,
      2.35,
    );
  };

  private readonly resetZoom = (): void => {
    const selected = this.selectedGoblins();
    const source = selected.length > 0 ? selected : this.goblins;
    if (source.length === 0) return;
    const center = source.reduce(
      (sum, goblin) => ({ x: sum.x + goblin.worldX / source.length, y: sum.y + goblin.worldY / source.length }),
      { x: 0, y: 0 },
    );
    this.cameraController.resetZoom(center);
  };

  private updateDebugOverlay(): void {
    this.debugText.setVisible(this.debugEnabled);
    this.debugGraphics.clear();
    if (!this.debugEnabled) return;
    const pointer = this.pointerWorld(this.input.activePointer);
    const tileX = Math.floor(pointer.x / TILE_SIZE);
    const tileY = Math.floor(pointer.y / TILE_SIZE);
    const tile = getTile(this.world, tileX, tileY);
    const selected = this.selectedGoblins();
    this.debugText.setText([
      `FPS ${Math.round(this.game.loop.actualFps)}`,
      `TILE ${tileX},${tileY}`,
      tile ? `${tile.structure.toUpperCase()} / ${tile.materialId} / V${tile.variant}` : 'POZA MAPĄ',
      `REGION ${tile?.regionId ?? '-'}`,
      `ŚCIEŻKI ${selected.reduce((sum, goblin) => sum + goblin.path.length, 0)}`,
    ]);
    this.debugGraphics.lineStyle(1, 0xf5d0fe, 0.8).strokeRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    for (const goblin of selected) {
      if (goblin.path.length === 0) continue;
      this.debugGraphics.beginPath().moveTo(goblin.worldX, goblin.worldY);
      for (const point of goblin.path) {
        this.debugGraphics.lineTo(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2);
      }
      this.debugGraphics.strokePath();
    }
  }

  private emitWorldInfo(): void {
    const payload: WorldInfoPayload = { seed: this.seed, goblinCount: this.goblins.length };
    gameEvents.emit(GAME_EVENT.worldInfo, payload);
  }

  private emitSelectionInfo(): void {
    const selected = this.selectedGoblins();
    const payload: SelectionInfoPayload = { selectedCount: selected.length };
    if (selected.length === 1) {
      const goblin = selected[0]!;
      payload.name = goblin.name;
      payload.sexLabel = goblin.sex === 'female' ? 'Kobieta' : 'Mężczyzna';
      payload.stateLabel = goblin.moving ? 'W drodze' : 'Bezczynny';
    }
    gameEvents.emit(GAME_EVENT.selectionInfo, payload);
  }

  private pointerWorld(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return new Phaser.Math.Vector2(point.x, point.y);
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer): boolean {
    return typeof PointerEvent !== 'undefined'
      && pointer.event instanceof PointerEvent
      && pointer.event.pointerType === 'touch';
  }

  private readonly toggleFullscreen = (): void => {
    if (this.scale.isFullscreen) this.scale.stopFullscreen();
    else this.scale.startFullscreen();
  };

  private selectedGoblins(): GoblinEntity[] {
    return this.goblins.filter((goblin) => goblin.selected);
  }

  private destroyGoblins(): void {
    for (const view of this.goblinViews) view.destroy(true);
    this.goblinViews = [];
    this.goblins = [];
  }

  private randomSeed(): number {
    return (Date.now() ^ Math.floor(Math.random() * 0xffff_ffff)) >>> 0;
  }

  private destroySystems(): void {
    const keyboard = this.input.keyboard;
    keyboard?.off('keydown-R', this.handleRegenerateKey);
    keyboard?.off('keydown-F', this.frameSelection);
    keyboard?.off('keydown-HOME', this.frameTribe);
    keyboard?.off('keydown-ZERO', this.resetZoom);
    keyboard?.off('keydown-ENTER', this.handleEnterKey);
    keyboard?.off('keydown-BACKTICK', this.toggleDebug);
    keyboard?.off('keydown-ESC', this.clearSelection);
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    this.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    gameEvents.off(GAME_EVENT.newCave, this.handleNewCave);
    gameEvents.off(GAME_EVENT.sameCave, this.handleSameCave);
    gameEvents.off(GAME_EVENT.focusTribe, this.frameTribe);
    gameEvents.off(GAME_EVENT.focusSelection, this.frameSelection);
    gameEvents.off(GAME_EVENT.resetZoom, this.resetZoom);
    gameEvents.off(GAME_EVENT.toggleFullscreen, this.toggleFullscreen);
    this.cameraController.destroy();
    this.caveRenderer.destroy();
    this.destroyGoblins();
  }
}
