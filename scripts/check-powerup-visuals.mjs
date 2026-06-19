import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__powerUpVisualTest = {
  createGame,
  drawPowerUps,
  getGame: () => game,
  setGame: (next) => {
    game = next;
  },
};
`;

const pixels = new Map();
const context2d = {
  _fillStyle: '#000',
  set fillStyle(value) {
    this._fillStyle = value;
  },
  get fillStyle() {
    return this._fillStyle;
  },
  set imageSmoothingEnabled(_value) {},
  beginPath: () => {},
  clip: () => {},
  closePath: () => {},
  fill: () => {},
  fillRect(x, y, w, h) {
    for (let py = y; py < y + h; py += 1) {
      for (let px = x; px < x + w; px += 1) {
        pixels.set(`${px},${py}`, this.fillStyle);
      }
    }
  },
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
};

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
      getContext: () => context2d,
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

const api = context.__powerUpVisualTest;
const types = ['grenade', 'helmet', 'shovel', 'star', 'tank', 'timer'];
const game = api.createGame(1);
game.powerUps = types.map((type, index) => ({
  type,
  x: index * 20,
  y: 0,
  age: 0,
  duration: 12,
}));
api.setGame(game);
api.drawPowerUps();

assertPixel(5, 8, '#6c8f40', 'grenade should have a green round explosive body');
assertPixel(13, 4, '#d85028', 'grenade should have a red fuse tip');
assertPixel(25, 6, '#b8c0c8', 'helmet should have a gray dome');
assertPixel(29, 10, '#b8c0c8', 'helmet should have a readable brim');
assertPixel(47, 5, '#8c5a28', 'shovel should have a brown handle');
assertPixel(45, 11, '#b8c0c8', 'shovel should have a metal blade');
assertPixel(68, 4, '#fff3b0', 'star should have a bright top point');
assertPixel(64, 8, '#fff3b0', 'star should have a left point');
assertPixel(83, 8, '#8fa8a2', 'tank power-up should have left track');
assertPixel(88, 8, '#d04f3f', 'tank power-up should have a red tank body');
assertPixel(106, 6, '#fff3b0', 'timer should have a bright clock face');
assertPixel(105, 3, '#b8c0c8', 'timer should have a clock bell');
assertPixel(104, 8, '#b8c0c8', 'timer should have a readable left metal clock rim');
assertPixel(111, 8, '#b8c0c8', 'timer should have a readable right metal clock rim');

console.log('Power-up visual contracts pass');

function assertPixel(x, y, expected, message) {
  const actual = pixels.get(`${x},${y}`);
  if (actual !== expected) {
    console.error(`${message}: expected ${expected} at ${x},${y}, got ${actual}`);
    process.exit(1);
  }
}
