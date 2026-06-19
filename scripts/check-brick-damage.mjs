import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs
  .readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  .replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__brickDamageTest = {
  createGame,
  hitTile,
  updateBullets,
  getGame: () => game,
  setGame: (next) => {
    game = next;
  },
};
`;

const { outputText } = ts.transpileModule(instrumented, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

const context = {
  console,
  Math,
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
        imageSmoothingEnabled: false,
        beginPath: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        lineTo: () => {},
        moveTo: () => {},
        restore: () => {},
        rotate: () => {},
        save: () => {},
        scale: () => {},
        setLineDash: () => {},
        stroke: () => {},
        strokeRect: () => {},
        translate: () => {},
      }),
    }),
  },
};
context.globalThis = context;

vm.createContext(context);
vm.runInContext(outputText, context);

const api = context.__brickDamageTest;

checkVerticalShotClearsHorizontalBrickLine();
checkHorizontalShotClearsVerticalBrickLine();
checkRightShotPrefersFrontBrickWhenBulletSpansTwoColumns();
checkDownShotPrefersFrontBrickWhenBulletSpansTwoRows();
checkUpShotCannotTunnelPastNearBrickRow();

console.log('Brick damage matches one-line Battle City behavior');

function createIsolatedBrickGame() {
  const game = api.createGame(1);
  game.map = Array.from({ length: 26 }, () => Array.from({ length: 26 }, () => '.'));
  game.map[4][4] = 'B';
  game.map[4][5] = 'B';
  game.map[5][4] = 'B';
  game.map[5][5] = 'B';
  api.setGame(game);
  return game;
}

function checkVerticalShotClearsHorizontalBrickLine() {
  const game = createIsolatedBrickGame();
  const bullet = {
    side: 'player',
    x: 4 * 8 + 2,
    y: 4 * 8 + 2,
    dir: 'down',
    speed: 148,
    alive: true,
    ownerId: 1,
  };

  api.hitTile(bullet);

  assertEqual(game.map[4][4], '.', 'vertical shot should clear hit brick segment');
  assertEqual(game.map[4][5], '.', 'vertical shot should clear adjacent brick segment in same row');
  assertEqual(game.map[5][4], 'B', 'vertical shot should not clear the second brick row');
  assertEqual(game.map[5][5], 'B', 'vertical shot should not clear the second brick row');
}

function checkHorizontalShotClearsVerticalBrickLine() {
  const game = createIsolatedBrickGame();
  const bullet = {
    side: 'player',
    x: 4 * 8 + 2,
    y: 4 * 8 + 2,
    dir: 'right',
    speed: 148,
    alive: true,
    ownerId: 1,
  };

  api.hitTile(bullet);

  assertEqual(game.map[4][4], '.', 'horizontal shot should clear hit brick segment');
  assertEqual(game.map[5][4], '.', 'horizontal shot should clear adjacent brick segment in same column');
  assertEqual(game.map[4][5], 'B', 'horizontal shot should not clear the second brick column');
  assertEqual(game.map[5][5], 'B', 'horizontal shot should not clear the second brick column');
}

function checkRightShotPrefersFrontBrickWhenBulletSpansTwoColumns() {
  const game = createIsolatedBrickGame();
  const bullet = {
    side: 'player',
    x: 5 * 8 - 1,
    y: 4 * 8 + 2,
    dir: 'right',
    speed: 148,
    alive: true,
    ownerId: 1,
  };

  api.hitTile(bullet);

  assertEqual(game.map[4][4], 'B', 'right shot should not clear rear brick segment first');
  assertEqual(game.map[5][4], 'B', 'right shot should not clear rear brick column first');
  assertEqual(game.map[4][5], '.', 'right shot should clear front brick segment first');
  assertEqual(game.map[5][5], '.', 'right shot should clear front brick column first');
}

function checkDownShotPrefersFrontBrickWhenBulletSpansTwoRows() {
  const game = createIsolatedBrickGame();
  const bullet = {
    side: 'player',
    x: 4 * 8 + 2,
    y: 5 * 8 - 1,
    dir: 'down',
    speed: 148,
    alive: true,
    ownerId: 1,
  };

  api.hitTile(bullet);

  assertEqual(game.map[4][4], 'B', 'down shot should not clear rear brick row first');
  assertEqual(game.map[4][5], 'B', 'down shot should not clear rear brick row first');
  assertEqual(game.map[5][4], '.', 'down shot should clear front brick segment first');
  assertEqual(game.map[5][5], '.', 'down shot should clear front brick row first');
}

function checkUpShotCannotTunnelPastNearBrickRow() {
  const game = createIsolatedBrickGame();
  game.bullets = [
    {
      side: 'player',
      x: 4 * 8 + 2,
      y: 5 * 8 + 5,
      dir: 'up',
      speed: 148,
      alive: true,
      ownerId: 1,
    },
  ];

  api.updateBullets(0.035);

  assertEqual(game.map[4][4], 'B', 'up shot should not tunnel through and clear the far brick row first');
  assertEqual(game.map[4][5], 'B', 'up shot should not tunnel through and clear the far brick row first');
  assertEqual(game.map[5][4], '.', 'up shot should clear the near brick row first');
  assertEqual(game.map[5][5], '.', 'up shot should clear the near brick row first');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`${message}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}
