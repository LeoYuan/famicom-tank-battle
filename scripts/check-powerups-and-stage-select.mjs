import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');
let randomState = 1;
const seededMath = Object.create(Math);
seededMath.random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x100000000;
};

const instrumented = `${source}
globalThis.__powerUpTest = {
  createGame,
  createTank,
  selectTitleStage: typeof selectTitleStage === 'undefined' ? null : selectTitleStage,
  spawnPowerUp: typeof spawnPowerUp === 'undefined' ? null : spawnPowerUp,
  spawnPowerUpAtRandomLocation: typeof spawnPowerUpAtRandomLocation === 'undefined' ? null : spawnPowerUpAtRandomLocation,
  applyPowerUp: typeof applyPowerUp === 'undefined' ? null : applyPowerUp,
  clearEnemiesWithGrenade: typeof clearEnemiesWithGrenade === 'undefined' ? null : clearEnemiesWithGrenade,
  armorBase: typeof armorBase === 'undefined' ? null : armorBase,
  updatePowerUps: typeof updatePowerUps === 'undefined' ? null : updatePowerUps,
  restoreBaseArmor: typeof restoreBaseArmor === 'undefined' ? null : restoreBaseArmor,
  hitTank,
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
  Math: seededMath,
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

const api = context.__powerUpTest;

for (const name of ['selectTitleStage', 'spawnPowerUp', 'spawnPowerUpAtRandomLocation', 'applyPowerUp', 'clearEnemiesWithGrenade', 'armorBase', 'updatePowerUps', 'restoreBaseArmor']) {
  if (typeof api[name] !== 'function') {
    console.error(`Expected ${name} to be implemented`);
    process.exit(1);
  }
}

checkStageSelection();
checkBonusCarrierDropsPowerUp();
checkRandomPowerUpsSpawnReachably();
checkPowerUpEffects();

console.log('Power-up and stage-select contracts pass');

function checkStageSelection() {
  const game = api.createGame(1);
  api.setGame(game);

  api.selectTitleStage(4);
  assertEqual(api.getGame().stage, 5, 'stage selector should move forward');

  api.selectTitleStage(99);
  assertEqual(api.getGame().stage, 8, 'stage selector should clamp to last stage');

  api.selectTitleStage(-99);
  assertEqual(api.getGame().stage, 1, 'stage selector should clamp to first stage');
}

function checkBonusCarrierDropsPowerUp() {
  const game = api.createGame(1);
  game.phase = 'playing';
  game.powerUps = [];
  const carrier = api.createTank('enemy', 3, 3, 'down', '#8fa8a2', '#d04f3f');
  carrier.bonusCarrier = true;
  carrier.spawnShield = 0;
  game.enemies = [carrier];
  api.setGame(game);

  api.hitTank({
    side: 'player',
    x: carrier.x + 6,
    y: carrier.y + 6,
    dir: 'right',
    speed: 148,
    alive: true,
    ownerId: 1,
  });

  assertEqual(game.powerUps.length, 1, 'bonus carrier should drop one power-up');
  assert(game.powerUps[0].x >= 0 && game.powerUps[0].x <= 12 * 16, 'power-up x should be inside battlefield');
  assert(game.powerUps[0].y >= 0 && game.powerUps[0].y <= 12 * 16, 'power-up y should be inside battlefield');
}

function checkRandomPowerUpsSpawnReachably() {
  for (let stage = 1; stage <= 8; stage += 1) {
    const game = api.createGame(stage);
    game.phase = 'playing';
    api.setGame(game);
    randomState = stage;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      api.spawnPowerUpAtRandomLocation('timer');
      const powerUp = game.powerUps[0];
      const spawnTile = { x: powerUp.x / 16, y: powerUp.y / 16 };
      assert(
        canReachCoarseTile(game, { x: 4, y: 12 }, spawnTile),
        `stage ${stage} random power-up should spawn on a reachable tile, got ${spawnTile.x},${spawnTile.y}`,
      );
    }
  }
}

function canReachCoarseTile(game, start, target) {
  if (!isPassableCoarseTile(game, target.x, target.y)) {
    return false;
  }

  const key = (tile) => `${tile.x},${tile.y}`;
  const queue = [start];
  const seen = new Set([key(start)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.x === target.x && current.y === target.y) {
      return true;
    }
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const nextKey = key(next);
      if (seen.has(nextKey) || !isPassableCoarseTile(game, next.x, next.y)) {
        continue;
      }
      seen.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}

function isPassableCoarseTile(game, x, y) {
  if (x < 0 || y < 0 || x >= 13 || y >= 13) {
    return false;
  }
  for (let blockY = y * 2; blockY < y * 2 + 2; blockY += 1) {
    for (let blockX = x * 2; blockX < x * 2 + 2; blockX += 1) {
      const tile = game.map[blockY]?.[blockX];
      if (tile === 'B' || tile === 'S' || tile === 'W' || tile === 'E') {
        return false;
      }
    }
  }
  return true;
}

function checkPowerUpEffects() {
  checkGrenade();
  checkHelmet();
  checkShovel();
  checkTimer();
  checkTank();
  checkStar();
}

function checkGrenade() {
  const game = api.createGame(1);
  game.phase = 'playing';
  game.enemies = [
    api.createTank('enemy', 0, 0, 'down', '#8fa8a2', '#d04f3f'),
    api.createTank('enemy', 12, 0, 'down', '#8fa8a2', '#d04f3f'),
  ];
  api.setGame(game);
  api.applyPowerUp({ type: 'grenade', x: 0, y: 0, age: 0, duration: 12 });
  assertEqual(game.enemies.length, 0, 'grenade should clear visible enemies');
}

function checkHelmet() {
  const game = api.createGame(1);
  api.setGame(game);
  game.player.spawnShield = 0;
  api.applyPowerUp({ type: 'helmet', x: 0, y: 0, age: 0, duration: 12 });
  assert(game.player.spawnShield >= 7.9, 'helmet should grant shield time');
}

function checkShovel() {
  const game = api.createGame(1);
  api.setGame(game);
  api.applyPowerUp({ type: 'shovel', x: 0, y: 0, age: 0, duration: 12 });
  assertEqual(game.baseArmorTimer > 0, true, 'shovel should start base armor timer');
  assertEqual(game.map[24][10], 'S', 'shovel should armor left base wall');
  api.restoreBaseArmor();
  assertEqual(game.map[24][10], 'B', 'base armor should restore original brick wall');
}

function checkTimer() {
  const game = api.createGame(1);
  api.setGame(game);
  api.applyPowerUp({ type: 'timer', x: 0, y: 0, age: 0, duration: 12 });
  assert(game.enemyFreezeTimer >= 5.9, 'timer should freeze enemies');
}

function checkTank() {
  const game = api.createGame(1);
  api.setGame(game);
  game.lives = 1;
  api.applyPowerUp({ type: 'tank', x: 0, y: 0, age: 0, duration: 12 });
  assertEqual(game.lives, 2, 'tank power-up should add one life');
}

function checkStar() {
  const game = api.createGame(1);
  api.setGame(game);
  game.playerPowerLevel = 1;
  api.applyPowerUp({ type: 'star', x: 0, y: 0, age: 0, duration: 12 });
  assertEqual(game.playerPowerLevel, 2, 'star should upgrade player power');
}

function assert(value, message) {
  if (!value) {
    console.error(message);
    process.exit(1);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`${message}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}
