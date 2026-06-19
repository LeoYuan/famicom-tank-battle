import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs
  .readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  .replace("import './styles.css';", '')
  .replace(/pixelText\(/g, 'recordPixelText(')
  .replace('function recordPixelText', 'function pixelText');

const instrumented = `${source}
function recordPixelText(text, x, y, scale, color) {
  globalThis.__pixelTextCalls.push({ text, x, y, scale, color });
  return pixelText(text, x, y, scale, color);
}
globalThis.__overlayBaseTest = {
  createGame,
  drawBattlefield,
  drawStageIntro,
  drawTitleScreen,
  drawOverlayMessage,
  drawHud,
  drawBase,
  hitTile,
  handleStartPause,
  pixelTextWidth,
  getGame: () => game,
  setGame: (next) => {
    game = next;
  },
};
`;

const operations = [];
const context = {
  console,
  Math,
  __pixelTextCalls: [],
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  window: {
    addEventListener: () => {},
    setTimeout: () => 0,
  },
  document: {
    querySelector: () => ({
      width: 256,
      height: 240,
      getContext: () => ({
        _fillStyle: '#000',
        _strokeStyle: '#000',
        _lineWidth: 1,
        set fillStyle(value) {
          this._fillStyle = value;
        },
        get fillStyle() {
          return this._fillStyle;
        },
        set strokeStyle(value) {
          this._strokeStyle = value;
        },
        get strokeStyle() {
          return this._strokeStyle;
        },
        set lineWidth(value) {
          this._lineWidth = value;
        },
        get lineWidth() {
          return this._lineWidth;
        },
        set imageSmoothingEnabled(_value) {},
        beginPath: () => operations.push({ op: 'beginPath' }),
        clip: () => operations.push({ op: 'clip' }),
        closePath: () => operations.push({ op: 'closePath' }),
        fill: function () {
          operations.push({ op: 'fill', fillStyle: this.fillStyle });
        },
        fillRect: function (x, y, w, h) {
          operations.push({ op: 'fillRect', fillStyle: this.fillStyle, x, y, w, h });
        },
        lineTo: (x, y) => operations.push({ op: 'lineTo', x, y }),
        moveTo: (x, y) => operations.push({ op: 'moveTo', x, y }),
        rect: (x, y, w, h) => operations.push({ op: 'rect', x, y, w, h }),
        restore: () => operations.push({ op: 'restore' }),
        rotate: () => {},
        save: () => operations.push({ op: 'save' }),
        scale: () => {},
        setLineDash: () => {},
        stroke: function () {
          operations.push({ op: 'stroke', strokeStyle: this.strokeStyle });
        },
        strokeRect: function (x, y, w, h) {
          operations.push({ op: 'strokeRect', strokeStyle: this.strokeStyle, x, y, w, h });
        },
        translate: () => {},
      }),
    }),
  },
};
context.globalThis = context;

const { outputText } = ts.transpileModule(instrumented, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

vm.createContext(context);
vm.runInContext(outputText, context);

const api = context.__overlayBaseTest;

checkGameOverPanelFitsRetryText();
checkGameOverTextIsCentered();
checkBaseUsesEaglePalette();
checkBaseIsClearedWhenHit();
checkStageIntroShowsCenteredStageNumber();
checkTitleScreenTextAlignment();
checkBattlefieldIsClipped();
checkTankShieldStaysInsideBattlefield();
checkBattlefieldEdgeDoesNotCoverTanks();
checkRightBattlefieldEdgeDoesNotDrawInternalGap();
checkHudStageNumberAlignsWithFlag();
checkHudFlagSizeMatchesTankIcon();
checkEnterPauseToggle();

console.log('Overlay and base visual contracts pass');

function checkGameOverPanelFitsRetryText() {
  operations.length = 0;
  const game = api.createGame(1);
  game.phase = 'gameover';
  game.messageBlink = 0;
  api.setGame(game);

  api.drawOverlayMessage();

  const panel = operations.find((operation) => operation.op === 'fillRect');
  const retryWidth = api.pixelTextWidth('ENTER RETRY', 1);
  if (!panel || panel.w < retryWidth + 20) {
    console.error(`Expected retry panel width >= ${retryWidth + 20}, got ${panel?.w}`);
    process.exit(1);
  }
}

function checkGameOverTextIsCentered() {
  operations.length = 0;
  context.__pixelTextCalls.length = 0;
  const game = api.createGame(1);
  game.phase = 'gameover';
  game.messageBlink = 0;
  api.setGame(game);

  api.drawOverlayMessage();

  const panel = operations.find((operation) => operation.op === 'fillRect');
  assertTextCentered(panel, context.__pixelTextCalls.find((call) => call.text === 'GAME OVER'), 'GAME OVER');
  assertTextCentered(panel, context.__pixelTextCalls.find((call) => call.text === 'ENTER RETRY'), 'ENTER RETRY');
}

function checkBaseUsesEaglePalette() {
  operations.length = 0;
  api.drawBase(0, 0);

  const usesEagleGold = operations.some(
    (operation) => operation.op === 'fillRect' && operation.fillStyle === '#d8c050',
  );
  const usesWingShadow = operations.some(
    (operation) => operation.op === 'fillRect' && operation.fillStyle === '#8c7a28',
  );

  if (!usesEagleGold || !usesWingShadow) {
    console.error('Expected base to render as a gold eagle with shaded wings');
    process.exit(1);
  }
}

function checkBaseIsClearedWhenHit() {
  const game = api.createGame(1);
  game.phase = 'playing';
  api.setGame(game);

  const bullet = {
    side: 'enemy',
    x: 13 * 8 + 2,
    y: 24 * 8 + 2,
    dir: 'down',
    speed: 120,
    alive: true,
    ownerId: 99,
  };
  api.hitTile(bullet);

  for (const [x, y] of [
    [12, 24],
    [13, 24],
    [12, 25],
    [13, 25],
  ]) {
    if (game.map[y][x] !== '.') {
      console.error(`Expected whole base to disappear when hit, but ${x},${y} is ${game.map[y][x]}`);
      process.exit(1);
    }
  }
}

function checkStageIntroShowsCenteredStageNumber() {
  operations.length = 0;
  context.__pixelTextCalls.length = 0;
  const game = api.createGame(3);
  game.phase = 'stageIntro';
  api.setGame(game);

  api.drawStageIntro();

  const call = context.__pixelTextCalls.find((entry) => entry.text === 'STAGE 03');
  assertScreenTextCentered(call, 'STAGE 03', 2);
  api.setGame(api.createGame(1));
}

function checkTitleScreenTextAlignment() {
  operations.length = 0;
  context.__pixelTextCalls.length = 0;

  api.drawTitleScreen();

  assertScreenTextCentered(context.__pixelTextCalls.find((call) => call.text === 'HI-34100'), 'HI-34100');
  assertScreenTextCentered(
    context.__pixelTextCalls.find((call) => call.text === '(C) 1980 1985 NAMCO LTD.'),
    '(C) 1980 1985 NAMCO LTD.',
  );
  assertScreenTextCentered(
    context.__pixelTextCalls.find((call) => call.text === 'ALL RIGHTS RESERVED'),
    'ALL RIGHTS RESERVED',
  );
  assertScreenTextCentered(context.__pixelTextCalls.find((call) => call.text === 'STAGE 01'), 'STAGE 01');

  const widestMenuText = '2 PLAYERS';
  const menuTextX = Math.round((256 - (16 + 7 + api.pixelTextWidth(widestMenuText, 1))) / 2) + 16 + 7;
  const onePlayer = context.__pixelTextCalls.find((call) => call.text === '1 PLAYER');
  const twoPlayers = context.__pixelTextCalls.find((call) => call.text === '2 PLAYERS');
  if (!onePlayer || onePlayer.x !== menuTextX || !twoPlayers || twoPlayers.x !== menuTextX) {
    console.error(`Expected menu text at x=${menuTextX}, got ${onePlayer?.x}/${twoPlayers?.x}`);
    process.exit(1);
  }
}

function checkBattlefieldIsClipped() {
  operations.length = 0;
  const game = api.createGame(1);
  game.phase = 'playing';
  game.player.spawnShield = 1;
  game.player.x = 192;
  api.setGame(game);

  api.drawBattlefield();

  const fieldClipIndex = operations.findIndex(
    (operation) => operation.op === 'rect' && operation.x === 0 && operation.y === 0 && operation.w === 208 && operation.h === 208,
  );
  const clipIndex = operations.findIndex((operation) => operation.op === 'clip');
  if (fieldClipIndex < 0 || clipIndex < fieldClipIndex) {
    console.error('Expected battlefield drawing to clip to the 208x208 playfield');
    process.exit(1);
  }
}

function checkTankShieldStaysInsideBattlefield() {
  for (const x of [0, 192]) {
    operations.length = 0;
    const game = api.createGame(1);
    game.phase = 'playing';
    game.player.spawnShield = 1;
    game.player.x = x;
    api.setGame(game);

    api.drawBattlefield();

    const shield = operations.find(
      (operation) => operation.op === 'strokeRect' && operation.strokeStyle === '#f2f2f2',
    );
    if (!shield || shield.x < 0 || shield.y < 0 || shield.x + shield.w > 208 || shield.y + shield.h > 208) {
      console.error(`Expected tank shield to stay inside battlefield at x=${x}, got ${JSON.stringify(shield)}`);
      process.exit(1);
    }
  }
}

function checkBattlefieldEdgeDoesNotCoverTanks() {
  operations.length = 0;
  const game = api.createGame(1);
  game.phase = 'playing';
  game.player.spawnShield = 0;
  game.player.x = 192;
  api.setGame(game);

  api.drawBattlefield();

  const tankIndex = operations.findIndex(
    (operation) => operation.op === 'fillRect' && operation.fillStyle === '#ffd84a',
  );
  const edgeIndex = operations.findIndex((operation) => isBattlefieldEdgeOperation(operation));
  if (edgeIndex < 0 || tankIndex < 0 || edgeIndex > tankIndex) {
    console.error(`Expected battlefield edge to be drawn before tanks, got edge=${edgeIndex} tank=${tankIndex}`);
    process.exit(1);
  }
}

function checkRightBattlefieldEdgeDoesNotDrawInternalGap() {
  operations.length = 0;
  const game = api.createGame(7);
  game.phase = 'playing';
  api.setGame(game);

  api.drawBattlefield();

  const rightInternalGap = operations.find(
    (operation) =>
      operation.op === 'fillRect' &&
      operation.fillStyle === '#000' &&
      operation.x >= 207 &&
      operation.x < 208 &&
      operation.y === 0 &&
      operation.h === 208,
  );
  const rightStrokeGap = operations.find(
    (operation) =>
      operation.op === 'strokeRect' &&
      operation.strokeStyle === '#000' &&
      operation.x === 0 &&
      operation.y === 0 &&
      operation.w === 208 &&
      operation.h === 208,
  );

  if (rightInternalGap || rightStrokeGap) {
    console.error('Expected right battlefield edge not to draw a black internal gap before the HUD');
    process.exit(1);
  }
}

function isBattlefieldEdgeOperation(operation) {
  return (
    (operation.op === 'strokeRect' &&
      operation.strokeStyle === '#000' &&
      operation.x === 0 &&
      operation.y === 0 &&
      operation.w === 208 &&
      operation.h === 208) ||
    (operation.op === 'fillRect' &&
      operation.fillStyle === '#000' &&
      ((operation.x === 0 && operation.y === 0 && operation.w === 208 && operation.h === 1) ||
        (operation.x === 0 && operation.y === 207 && operation.w === 208 && operation.h === 1) ||
        (operation.x === 0 && operation.y === 0 && operation.w === 1 && operation.h === 208)))
  );
}

function checkHudStageNumberAlignsWithFlag() {
  operations.length = 0;
  context.__pixelTextCalls.length = 0;
  const game = api.createGame(7);
  api.setGame(game);

  api.drawHud();

  const flagPole = operations.find(
    (operation) =>
      operation.op === 'fillRect' &&
      operation.fillStyle === '#111' &&
      operation.x === 220 &&
      operation.y === 169 &&
      operation.w === 2 &&
      operation.h === 11,
  );
  const stageNumber = context.__pixelTextCalls.find((call) => call.text === '07');

  if (!flagPole || !stageNumber) {
    console.error('Expected HUD to render both the stage flag and stage number');
    process.exit(1);
  }

  const textHeight = 7;
  const expectedY = Math.round(flagPole.y + (flagPole.h - textHeight) / 2);
  if (stageNumber.y !== expectedY) {
    console.error(`Expected HUD stage number y=${expectedY} to align with flag center, got ${stageNumber.y}`);
    process.exit(1);
  }
}

function checkHudFlagSizeMatchesTankIcon() {
  operations.length = 0;
  const game = api.createGame(1);
  api.setGame(game);

  api.drawHud();

  const tankTrack = operations.find(
    (operation) =>
      operation.op === 'fillRect' &&
      operation.fillStyle === '#b86020' &&
      operation.x === 219 &&
      operation.y === 128 &&
      operation.w === 3 &&
      operation.h === 8,
  );
  const flagPole = operations.find(
    (operation) =>
      operation.op === 'fillRect' &&
      operation.fillStyle === '#111' &&
      operation.x === 220 &&
      operation.y === 169 &&
      operation.w === 2 &&
      operation.h === 11,
  );

  if (!tankTrack || !flagPole) {
    console.error('Expected HUD to render both the life tank icon and a compact stage flag icon');
    process.exit(1);
  }

  if (flagPole.h > tankTrack.h + 3) {
    console.error(`Expected HUD flag height to stay close to tank icon height, got flag=${flagPole.h}, tank=${tankTrack.h}`);
    process.exit(1);
  }
}

function checkEnterPauseToggle() {
  const game = api.createGame(1);
  game.phase = 'playing';
  api.setGame(game);

  api.handleStartPause();
  assertEqual(api.getGame().phase, 'paused', 'Enter should pause while playing');
  api.handleStartPause();
  assertEqual(api.getGame().phase, 'playing', 'Enter should resume while paused');
}

function assertTextCentered(panel, call, label) {
  const expectedX = Math.round(panel.x + (panel.w - api.pixelTextWidth(label, 1)) / 2);
  if (!call || call.x !== expectedX) {
    console.error(`Expected ${label} centered at x=${expectedX}, got ${call?.x}`);
    process.exit(1);
  }
}

function assertScreenTextCentered(call, label, scale = 1) {
  const expectedX = Math.round((256 - api.pixelTextWidth(label, scale)) / 2);
  if (!call || call.x !== expectedX) {
    console.error(`Expected ${label} centered at x=${expectedX}, got ${call?.x}`);
    process.exit(1);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`${message}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}
