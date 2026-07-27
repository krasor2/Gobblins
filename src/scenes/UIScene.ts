import Phaser from 'phaser';
import {
  GAME_EVENT,
  gameEvents,
  type SelectionInfoPayload,
  type WorldInfoPayload,
} from '../game/events';

interface UiButton {
  container: Phaser.GameObjects.Container;
  label: string;
}

export class UIScene extends Phaser.Scene {
  private tribePanel!: Phaser.GameObjects.Container;
  private tribeBackground!: Phaser.GameObjects.Rectangle;
  private tribeTitle!: Phaser.GameObjects.Text;
  private tribeInfo!: Phaser.GameObjects.Text;
  private selectionPanel!: Phaser.GameObjects.Container;
  private selectionBackground!: Phaser.GameObjects.Rectangle;
  private selectionText!: Phaser.GameObjects.Text;
  private hintPanel!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private helpPanel!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Text;
  private readonly buttons: UiButton[] = [];
  private hintTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('ui');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    this.createTribePanel();
    this.createSelectionPanel();
    this.createHintPanel();
    this.createHelpPanel();
    this.createButtons();
    this.tooltip = this.add.text(0, 0, '', this.textStyle(13, '#f5efff'))
      .setPadding(7, 5, 7, 5)
      .setBackgroundColor('#17121dee')
      .setOrigin(1, 0)
      .setVisible(false)
      .setDepth(500);

    gameEvents.on(GAME_EVENT.worldInfo, this.handleWorldInfo);
    gameEvents.on(GAME_EVENT.selectionInfo, this.handleSelectionInfo);
    gameEvents.on(GAME_EVENT.firstCommand, this.hideHint);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroyUi, this);
    this.layout();

    this.hintTimer = this.time.delayedCall(8_000, this.hideHint);
  }

  private createTribePanel(): void {
    this.tribePanel = this.add.container(0, 0).setDepth(100);
    this.tribeBackground = this.add.rectangle(0, 0, 218, 78, 0x120e17, 0.93)
      .setOrigin(0)
      .setStrokeStyle(1, 0x6f5277, 0.9);
    this.tribeTitle = this.add.text(14, 10, 'CAVE TRIBE', this.textStyle(20, '#f5d0fe'));
    this.tribeInfo = this.add.text(14, 39, '6 goblinów\nSeed: —', this.textStyle(14, '#d7cedd'));
    this.tribePanel.add([this.tribeBackground, this.tribeTitle, this.tribeInfo]);
  }

  private createSelectionPanel(): void {
    this.selectionPanel = this.add.container(0, 0).setDepth(100);
    this.selectionBackground = this.add.rectangle(0, 0, 330, 68, 0x120e17, 0.94)
      .setOrigin(0, 1)
      .setStrokeStyle(1, 0x6f5277, 0.9);
    this.selectionText = this.add.text(14, -55, 'Brak zaznaczenia', this.textStyle(16, '#f0abfc'));
    this.selectionPanel.add([this.selectionBackground, this.selectionText]);
  }

  private createHintPanel(): void {
    const background = this.add.rectangle(0, 0, 590, 42, 0x120e17, 0.9)
      .setOrigin(0.5, 1)
      .setStrokeStyle(1, 0x4b3d50, 0.9);
    this.hintText = this.add.text(
      0,
      -21,
      'LPM: wybór i ramka  •  PPM/dotyk: ruch  •  WASD: kamera  •  F: skup zaznaczenie',
      this.textStyle(14, '#d7cedd'),
    ).setOrigin(0.5);
    this.hintPanel = this.add.container(0, 0, [background, this.hintText]).setDepth(100);
  }

  private createHelpPanel(): void {
    const shade = this.add.rectangle(0, 0, 10, 10, 0x050408, 0.76).setOrigin(0);
    const card = this.add.rectangle(0, 0, 520, 430, 0x15101b, 0.98)
      .setStrokeStyle(2, 0x9f6daa, 1);
    const title = this.add.text(0, -180, 'STEROWANIE PLEMIENIEM', this.textStyle(22, '#f5d0fe')).setOrigin(0.5);
    const body = this.add.text(
      -220,
      -135,
      [
        'LPM / dotyk      wybór goblina',
        'Przeciągnięcie   zaznaczenie grupy',
        'Shift + LPM      dodanie lub usunięcie',
        'PPM / dotyk      rozkaz ruchu',
        'WASD             przesuwanie kamery',
        'Środkowy przycisk przeciąganie kamery',
        'Rolka / pinch    zoom',
        'F                skup zaznaczonych',
        'Home             skup całe plemię',
        '0                reset zoomu',
        'R                nowa jaskinia',
        'Shift + R        ten sam seed',
        'Alt + Enter      pełny ekran',
        '`                debug',
        'Esc              wyczyść zaznaczenie',
      ].join('\n'),
      this.textStyle(16, '#e5dde9'),
    );
    const close = this.add.text(0, 175, 'Kliknij, aby zamknąć', this.textStyle(14, '#d8b4fe')).setOrigin(0.5);
    this.helpPanel = this.add.container(0, 0, [shade, card, title, body, close])
      .setDepth(400)
      .setVisible(false)
      .setInteractive(new Phaser.Geom.Rectangle(-260, -215, 520, 430), Phaser.Geom.Rectangle.Contains);
    this.helpPanel.on(Phaser.Input.Events.POINTER_DOWN, () => this.helpPanel.setVisible(false));
    this.helpPanel.setData('shade', shade);
  }

  private createButtons(): void {
    this.createButton('↻', 'Nowa jaskinia', () => gameEvents.emit(GAME_EVENT.newCave));
    this.createButton('⟳', 'Ponów seed', () => gameEvents.emit(GAME_EVENT.sameCave));
    this.createButton('◎', 'Skup plemię', () => gameEvents.emit(GAME_EVENT.focusTribe));
    this.createButton('⛶', 'Pełny ekran', () => gameEvents.emit(GAME_EVENT.toggleFullscreen));
    this.createButton('?', 'Pomoc', () => this.helpPanel.setVisible(!this.helpPanel.visible));
  }

  private createButton(label: string, tooltip: string, action: () => void): void {
    const background = this.add.rectangle(0, 0, 48, 48, 0x17121d, 0.96)
      .setStrokeStyle(1, 0x815b89, 1);
    const text = this.add.text(0, -1, label, this.textStyle(22, '#f5efff')).setOrigin(0.5);
    const container = this.add.container(0, 0, [background, text])
      .setSize(48, 48)
      .setDepth(120)
      .setInteractive({ useHandCursor: true });
    container.on(Phaser.Input.Events.POINTER_DOWN, (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      action();
    });
    container.on(Phaser.Input.Events.POINTER_OVER, () => {
      background.setFillStyle(0x2a1d31, 1);
      this.tooltip.setText(tooltip).setVisible(true);
    });
    container.on(Phaser.Input.Events.POINTER_OUT, () => {
      background.setFillStyle(0x17121d, 0.96);
      this.tooltip.setVisible(false);
    });
    this.buttons.push({ container, label: tooltip });
  }

  private readonly handleWorldInfo = (payload: WorldInfoPayload): void => {
    this.tribeInfo.setText(`${payload.goblinCount} goblinów\nSeed: ${payload.seed}`);
  };

  private readonly handleSelectionInfo = (payload: SelectionInfoPayload): void => {
    if (payload.selectedCount === 0) {
      this.selectionText.setText('Brak zaznaczenia');
    } else if (payload.selectedCount === 1) {
      this.selectionText.setText(`${payload.name ?? 'Goblin'}\nGoblin jaskiniowy · ${payload.sexLabel ?? ''} · ${payload.stateLabel ?? ''}`);
    } else {
      this.selectionText.setText(`Wybrano ${payload.selectedCount} goblinów`);
    }
  };

  private readonly hideHint = (): void => {
    if (!this.hintPanel.active || !this.hintPanel.visible) return;
    this.tweens.add({
      targets: this.hintPanel,
      alpha: 0,
      duration: 300,
      onComplete: () => this.hintPanel.setVisible(false),
    });
  };

  private readonly layout = (): void => {
    const width = this.scale.width;
    const height = this.scale.height;
    const scale = Phaser.Math.Clamp(Math.min(width / 1280, height / 720), 0.9, 1.25);
    const narrow = width < 700;

    this.tribePanel.setScale(scale).setPosition(12, 12);
    this.selectionPanel.setScale(scale).setPosition(12, height - 12);
    this.hintPanel.setScale(scale).setPosition(width / 2, height - 8);

    this.buttons.forEach((button, index) => {
      if (narrow) button.container.setPosition(width - 30, 34 + index * 56);
      else button.container.setPosition(width - 30 - (this.buttons.length - 1 - index) * 56, 34);
    });
    this.tooltip.setPosition(width - 10, narrow ? Math.min(height - 50, 34 + this.buttons.length * 56) : 66);

    this.helpPanel.setPosition(width / 2, height / 2);
    const shade = this.helpPanel.getData('shade') as Phaser.GameObjects.Rectangle;
    shade.setPosition(-width / 2, -height / 2).setSize(width, height);
    const helpScale = Phaser.Math.Clamp(Math.min(width / 580, height / 500), 0.62, 1);
    this.helpPanel.setScale(helpScale);
  };

  private textStyle(size: number, color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: `${size}px`,
      color,
      stroke: '#0d0911',
      strokeThickness: 3,
    };
  }

  private destroyUi(): void {
    this.hintTimer?.remove(false);
    gameEvents.off(GAME_EVENT.worldInfo, this.handleWorldInfo);
    gameEvents.off(GAME_EVENT.selectionInfo, this.handleSelectionInfo);
    gameEvents.off(GAME_EVENT.firstCommand, this.hideHint);
    this.scale.off(Phaser.Scale.Events.RESIZE, this.layout);
  }
}
