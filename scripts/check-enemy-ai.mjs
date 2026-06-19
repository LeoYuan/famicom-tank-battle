import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs
  .readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  .replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__enemyAiTest = {
  createGame,
  createTank,
  tankRect,
  canTankOccupy,
  pickEnemyDirection,
  canTankMoveOneStep,
  updateEnemies,
  updateBullets,
  respawnPlayer,
  spawnEnemies,
  LEVELS_13_DRAFT,
  getGame: () => game,
  setGame: (next) => {
    game = next;
  },
  DIRS,
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
  Math: Object.create(Math),
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
context.Math.floor = Math.floor;
context.Math.abs = Math.abs;
context.Math.max = Math.max;
context.Math.min = Math.min;
context.Math.round = Math.round;

vm.createContext(context);
vm.runInContext(outputText, context);

const ai = context.__enemyAiTest;
const game = ai.createGame(1);
context.Math.random = () => 0;

const enemy = ai.createTank('enemy', 6, 0, 'down', '#8fa8a2', '#d04f3f');
game.enemies.push(enemy);

const direction = ai.pickEnemyDirection(enemy);
const vector = ai.DIRS[direction];
const nextRect = ai.tankRect(enemy);
nextRect.x += vector.x;
nextRect.y += vector.y;

if (!ai.canTankOccupy(nextRect, enemy)) {
  console.error(`Expected enemy AI to choose a movable direction, got ${direction}`);
  process.exit(1);
}

console.log(`Enemy AI chose movable direction: ${direction}`);

const spawnTiles = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 12, y: 0 },
];

for (let stage = 1; stage <= ai.LEVELS_13_DRAFT.length; stage += 1) {
  const stageGame = ai.createGame(stage);
  ai.setGame(stageGame);
  for (const spawn of spawnTiles) {
    const probe = ai.createTank('enemy', spawn.x, spawn.y, 'down', '#8fa8a2', '#d04f3f');
    const reachable = canReachInterior(probe);
    if (!reachable) {
      console.error(`Expected Stage ${stage} spawn ${spawn.x},${spawn.y} to have a route into the battlefield`);
      process.exit(1);
    }
  }
}

console.log('All enemy spawns can reach the battlefield across all stages');

for (let stage = 1; stage <= ai.LEVELS_13_DRAFT.length; stage += 1) {
  for (const spawn of spawnTiles) {
    const simulation = ai.createGame(stage);
    simulation.phase = 'playing';
    simulation.enemies = [];
    simulation.enemyReserve = 0;
    const movingEnemy = ai.createTank('enemy', spawn.x, spawn.y, 'down', '#8fa8a2', '#d04f3f');
    simulation.enemies.push(movingEnemy);
    ai.setGame(simulation);

    const start = { x: movingEnemy.x, y: movingEnemy.y };
    let maxY = movingEnemy.y;
    let maxDistance = 0;
    const trace = [];
    for (let frame = 0; frame < 420; frame += 1) {
      if (frame < 24 || frame % 60 === 0) {
        trace.push({
          frame,
          x: movingEnemy.x,
          y: movingEnemy.y,
          dir: movingEnemy.dir,
          aiTimer: movingEnemy.aiTimer,
          movable: ['up', 'right', 'down', 'left'].filter((dir) => ai.canTankMoveOneStep(movingEnemy, dir)),
        });
      }
      ai.updateEnemies(1 / 60);
      ai.updateBullets(1 / 60);
      maxY = Math.max(maxY, movingEnemy.y);
      maxDistance = Math.max(maxDistance, Math.hypot(movingEnemy.x - start.x, movingEnemy.y - start.y));
    }

    if (maxDistance < 48 || maxY < 48) {
      console.error(
        `Expected Stage ${stage} enemy from spawn ${spawn.x},${spawn.y} to enter the field, ` +
          `max moved ${maxDistance.toFixed(1)}px and max y ${maxY.toFixed(1)}px`,
      );
      console.error(JSON.stringify(trace, null, 2));
      process.exit(1);
    }
  }
}

console.log('All enemy spawns move into the battlefield during simulation across all stages');

const respawnCollisionGame = ai.createGame(1);
respawnCollisionGame.phase = 'playing';
const spawnBlocker = ai.createTank('enemy', 4, 12, 'up', '#8fa8a2', '#d04f3f');
spawnBlocker.spawnShield = 0;
respawnCollisionGame.enemies = [spawnBlocker];
ai.setGame(respawnCollisionGame);
ai.respawnPlayer();
const playerRect = ai.tankRect(respawnCollisionGame.player);
if (playerRect.x !== 4 * 16 || playerRect.y !== 12 * 16) {
  console.error(`Expected 1P respawn to stay on the primary left spawn, got ${playerRect.x},${playerRect.y}`);
  process.exit(1);
}
if (respawnCollisionGame.enemies.some((enemy) => rectsIntersect(playerRect, ai.tankRect(enemy)))) {
  console.error('Expected 1P respawn to clear enemies overlapping the primary spawn tile');
  process.exit(1);
}

console.log('Player respawn keeps the primary 1P spawn clear');

function canReachInterior(start) {
  const queue = [{ x: start.x, y: start.y }];
  const seen = new Set([`${start.x},${start.y}`]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.y >= 4 * 16) {
      return true;
    }

    for (const dir of ['up', 'right', 'down', 'left']) {
      const tank = { ...start, x: current.x, y: current.y, dir };
      if (!ai.canTankMoveOneStep(tank, dir)) {
        continue;
      }

      const next = { x: current.x + ai.DIRS[dir].x, y: current.y + ai.DIRS[dir].y };
      const key = `${next.x},${next.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }

  return false;
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
