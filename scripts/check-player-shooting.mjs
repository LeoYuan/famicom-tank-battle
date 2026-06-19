import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__playerShootingTest = {
  createGame,
  updatePlayer,
  getGame: () => game,
  setGame: (next) => {
    game = next;
  },
};
`;

const listeners = {};
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
    addEventListener: (type, handler) => {
      listeners[type] = handler;
    },
    setTimeout: () => 0,
  },
  document: {
    querySelector: () => ({
      width: 256,
      height: 240,
      getContext: () => ({
        imageSmoothingEnabled: false,
        beginPath: () => {},
        clip: () => {},
        closePath: () => {},
        fill: () => {},
        fillRect: () => {},
        lineTo: () => {},
        moveTo: () => {},
        rect: () => {},
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

const api = context.__playerShootingTest;
checkSpaceShootsAfterMovementDirectionIsApplied();

console.log('Player shooting input contracts pass');

function checkSpaceShootsAfterMovementDirectionIsApplied() {
  const game = api.createGame(1);
  game.phase = 'playing';
  game.map = Array.from({ length: 26 }, () => Array.from({ length: 26 }, () => '.'));
  game.player.x = 64;
  game.player.y = 64;
  game.player.dir = 'left';
  game.player.cooldown = 0;
  api.setGame(game);

  keydown('ArrowRight');
  keydown('Space');

  assertEqual(game.bullets.length, 0, 'Space keydown should not fire before movement direction is applied');

  api.updatePlayer(1 / 60);

  assertEqual(game.bullets.length, 1, 'held Space should fire during player update');
  assertEqual(game.bullets[0].dir, 'right', 'shot should use the direction after movement input is applied');
}

function keydown(code) {
  listeners.keydown({
    code,
    preventDefault: () => {},
  });
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`${message}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}
