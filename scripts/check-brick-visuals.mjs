import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__brickVisualTest = {
  drawBrick,
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

const api = context.__brickVisualTest;
api.drawBrick(0, 0);
api.drawBrick(8, 0);

assertPixel(8, 5, '#d85028', 'staggered brick course should continue through the middle of a 16x16 wall tile');
assertPixel(7, 1, '#902818', 'top brick course should keep the intended vertical mortar seam');
assertPixel(8, 1, '#d85028', 'top brick course should begin the second brick after the mortar seam');

console.log('Brick visual alignment contracts pass');

function assertPixel(x, y, expected, message) {
  const actual = pixels.get(`${x},${y}`);
  if (actual !== expected) {
    console.error(`${message}: expected ${expected} at ${x},${y}, got ${actual}`);
    process.exit(1);
  }
}
