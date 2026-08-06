import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__screenScaleTest = {
  screenScaleForViewport,
};
`;

const appliedScales = [];
const context = {
  console,
  Math,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  window: {
    innerWidth: 1328,
    innerHeight: 969,
    addEventListener: () => {},
    setTimeout: () => 0,
  },
  document: {
    documentElement: {
      style: {
        setProperty(name, value) {
          appliedScales.push({ name, value });
        },
      },
    },
    querySelector: () => ({
      width: 256,
      height: 240,
      getContext: () => ({
        set imageSmoothingEnabled(_value) {},
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

const { outputText } = ts.transpileModule(instrumented, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});

vm.createContext(context);
vm.runInContext(outputText, context);

const api = context.__screenScaleTest;

assertEqual(api.screenScaleForViewport(1328, 969), 3, '1328x969 should use a crisp 3x scale');
assertEqual(api.screenScaleForViewport(1920, 1200), 4, '1920x1200 desktop should use a 4x scale');
assertEqual(api.screenScaleForViewport(2560, 1440), 5, '2560x1440 desktop should use a 5x scale');
assertEqual(api.screenScaleForViewport(3840, 2160), 8, '4K desktop should use an 8x scale');
assertEqual(api.screenScaleForViewport(390, 844), 1, 'narrow mobile should stay at least 1x scale');

const applied = appliedScales.find((entry) => entry.name === '--screen-scale');
assertEqual(applied?.value, '3', 'initial page load should apply the computed integer scale');

console.log('Screen scale contract passes');

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`${message}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}
