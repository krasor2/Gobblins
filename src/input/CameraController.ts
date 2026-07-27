import Phaser from 'phaser';
import type { GridPoint, WorldBounds } from '../game/types';
import {
  boundsCenter,
  boundsFromPoints,
  calculateBoundsZoom,
  calculateDynamicMinZoom,
  CAMERA_CONFIG,
  clamp,
} from './cameraMath';

export class CameraController {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private worldWidth = 1;
  private worldHeight = 1;
  private minimumZoom = CAMERA_CONFIG.absoluteMinimumZoom;
  private lastPinchDistance = 0;
  private readonly lastPinchCenter = new Phaser.Math.Vector2();

  constructor(private readonly scene: Phaser.Scene) {
    this.camera = scene.cameras.main;
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input unavailable.');
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    scene.input.addPointer(2);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    scene.input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  setWorldSize(width: number, height: number): void {
    this.worldWidth = Math.max(1, width);
    this.worldHeight = Math.max(1, height);
    this.recalculateMinimumZoom();
    if (this.camera.zoom < this.minimumZoom) this.camera.setZoom(this.minimumZoom);
    this.clampCamera();
  }

  update(deltaSeconds: number): void {
    const speed = 470 * deltaSeconds / this.camera.zoom;
    if (this.keys.left.isDown) this.camera.scrollX -= speed;
    if (this.keys.right.isDown) this.camera.scrollX += speed;
    if (this.keys.up.isDown) this.camera.scrollY -= speed;
    if (this.keys.down.isDown) this.camera.scrollY += speed;
    this.updatePinchGesture();
    this.clampCamera();
  }

  framePoints(points: readonly GridPoint[], paddingPx = 120, maximumZoom = CAMERA_CONFIG.startingMaximumZoom): void {
    this.frameBounds(boundsFromPoints(points), paddingPx, maximumZoom);
  }

  frameBounds(bounds: WorldBounds, paddingPx = 120, maximumZoom = CAMERA_CONFIG.maximumZoom): void {
    const zoom = calculateBoundsZoom(
      bounds,
      { width: this.scene.scale.width, height: this.scene.scale.height },
      paddingPx,
      this.minimumZoom,
      maximumZoom,
    );
    const center = boundsCenter(bounds);
    this.camera.setZoom(zoom);
    this.camera.centerOn(center.x, center.y);
    this.clampCamera();
  }

  focusOn(points: readonly GridPoint[], pixelScale: number, paddingPx = 160): void {
    if (points.length === 0) return;
    this.frameBounds(boundsFromPoints(points, pixelScale), paddingPx, 2.35);
  }

  resetZoom(center?: GridPoint): void {
    const zoom = clamp(1.45, this.minimumZoom, CAMERA_CONFIG.maximumZoom);
    this.camera.setZoom(zoom);
    if (center) this.camera.centerOn(center.x, center.y);
    this.clampCamera();
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const before = this.camera.getWorldPoint(screenX, screenY);
    this.camera.setZoom(clamp(this.camera.zoom * factor, this.minimumZoom, CAMERA_CONFIG.maximumZoom));
    const after = this.camera.getWorldPoint(screenX, screenY);
    this.camera.scrollX += before.x - after.x;
    this.camera.scrollY += before.y - after.y;
    this.clampCamera();
  }

  clampCamera(): void {
    const visibleWidth = this.camera.width / this.camera.zoom;
    const visibleHeight = this.camera.height / this.camera.zoom;
    const padding = CAMERA_CONFIG.worldPaddingPx;

    if (visibleWidth >= this.worldWidth + padding * 2) {
      this.camera.scrollX = (this.worldWidth - visibleWidth) / 2;
    } else {
      this.camera.scrollX = clamp(this.camera.scrollX, -padding, this.worldWidth - visibleWidth + padding);
    }

    if (visibleHeight >= this.worldHeight + padding * 2) {
      this.camera.scrollY = (this.worldHeight - visibleHeight) / 2;
    } else {
      this.camera.scrollY = clamp(this.camera.scrollY, -padding, this.worldHeight - visibleHeight + padding);
    }
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    this.scene.input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    for (const key of Object.values(this.keys)) key.destroy();
  }

  private recalculateMinimumZoom(): void {
    this.minimumZoom = calculateDynamicMinZoom(
      { width: this.scene.scale.width, height: this.scene.scale.height },
      { width: this.worldWidth, height: this.worldHeight },
    );
  }

  private readonly handleResize = (): void => {
    this.recalculateMinimumZoom();
    if (this.camera.zoom < this.minimumZoom) this.camera.setZoom(this.minimumZoom);
    this.clampCamera();
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!pointer.middleButtonDown()) return;
    this.camera.scrollX -= pointer.velocity.x / this.camera.zoom;
    this.camera.scrollY -= pointer.velocity.y / this.camera.zoom;
    this.clampCamera();
  };

  private readonly handleWheel = (
    pointer: Phaser.Input.Pointer,
    _over: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    this.zoomAt(
      pointer.x,
      pointer.y,
      deltaY > 0 ? CAMERA_CONFIG.wheelZoomOut : CAMERA_CONFIG.wheelZoomIn,
    );
  };

  private updatePinchGesture(): void {
    const first = this.scene.input.pointer1;
    const second = this.scene.input.pointer2;
    if (!first.isDown || !second.isDown) {
      this.lastPinchDistance = 0;
      return;
    }

    const distance = Phaser.Math.Distance.Between(first.x, first.y, second.x, second.y);
    const centerX = (first.x + second.x) / 2;
    const centerY = (first.y + second.y) / 2;
    if (this.lastPinchDistance > 0) {
      const scale = clamp(distance / this.lastPinchDistance, 0.92, 1.08);
      this.zoomAt(centerX, centerY, scale);
      this.camera.scrollX -= (centerX - this.lastPinchCenter.x) / this.camera.zoom;
      this.camera.scrollY -= (centerY - this.lastPinchCenter.y) / this.camera.zoom;
    }
    this.lastPinchDistance = distance;
    this.lastPinchCenter.set(centerX, centerY);
  }
}
