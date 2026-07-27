import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT = {
  worldInfo: 'world-info',
  selectionInfo: 'selection-info',
  newCave: 'new-cave',
  sameCave: 'same-cave',
  focusTribe: 'focus-tribe',
  focusSelection: 'focus-selection',
  resetZoom: 'reset-zoom',
  toggleFullscreen: 'toggle-fullscreen',
  firstCommand: 'first-command',
} as const;

export interface WorldInfoPayload {
  seed: number;
  goblinCount: number;
}

export interface SelectionInfoPayload {
  selectedCount: number;
  name?: string;
  sexLabel?: string;
  stateLabel?: string;
}
