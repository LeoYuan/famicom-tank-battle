import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

let source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');
source = source.replace(
  'function hitTile(bullet: Bullet): boolean {',
  `function hitTile(bullet: Bullet): boolean {
  if (blockRange(bulletRect(bullet)).some(({ x, y }) => game.map[y]?.[x] === 'E')) {
    globalThis.__baseHitProbe.push({
      time: game.messageBlink,
      stage: game.stage,
      side: bullet.side,
      ownerId: bullet.ownerId,
      x: bullet.x,
      y: bullet.y,
      dir: bullet.dir,
    });
  }`,
);

const instrumented = `${source}
globalThis.__qaPlaythroughTest = {
  createGame,
  update,
  tankRect,
  getStageTuning,
  keys,
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

const seededMath = Object.create(Math);
let randomState = 1;
seededMath.random = () => {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x100000000;
};

const context = {
  console,
  Math: seededMath,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  window: {
    innerWidth: 1243,
    innerHeight: 969,
    addEventListener: () => {},
    setTimeout: () => 0,
  },
  document: {
    documentElement: {
      style: {
        setProperty: () => {},
      },
    },
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
context.__baseHitProbe = [];

vm.createContext(context);
vm.runInContext(outputText, context);

const api = context.__qaPlaythroughTest;
const failures = [];
const summaries = [];

for (let stage = 1; stage <= 8; stage += 1) {
  const summary = {
    stage,
    baseHitRuns: 0,
    enemyKills: 0,
    playerDeaths: 0,
    powerUpFrames: 0,
  };

  for (let run = 0; run < 10; run += 1) {
    runStageAttempt(stage, run, summary);
  }

  summaries.push(summary);
}

for (const summary of summaries) {
  console.log(
    [
      `Stage ${summary.stage}`,
      `baseHitRuns=${summary.baseHitRuns}`,
      `enemyKills=${summary.enemyKills}`,
      `playerDeaths=${summary.playerDeaths}`,
      `powerUpFrames=${summary.powerUpFrames}`,
    ].join(' | '),
  );
}

if (failures.length > 0) {
  console.error('\nQA playthrough check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nQA playthrough check passed for 8 stages x 10 seeded runs');

function runStageAttempt(stage, run, summary) {
  seedRandom(stage * 1000 + run);
  context.__baseHitProbe = [];

  const game = api.createGame(stage);
  game.phase = 'playing';
  api.setGame(game);

  const allowedEnemySpawns = api
    .getStageTuning(stage)
    .enemySpawnTiles.map((spawn) => `${spawn.x},${spawn.y}`);
  let lastLives = game.lives;
  let lastScore = game.score;

  for (let frame = 0; frame < 60 * 75; frame += 1) {
    driveBot(game, frame);
    api.update(1 / 60);

    if (game.lives < lastLives) {
      summary.playerDeaths += lastLives - game.lives;
      lastLives = game.lives;
    }
    if (game.score > lastScore) {
      summary.enemyKills += 1;
      lastScore = game.score;
    }
    if (game.playerPowerLevel > 1 || game.baseArmorTimer > 0 || game.enemyFreezeTimer > 0 || game.lives > 3) {
      summary.powerUpFrames += 1;
    }

    const earlyBaseHit = context.__baseHitProbe.find(
      (hit) => hit.side === 'enemy' && hit.time < earlyBaseHitThreshold(stage),
    );
    if (earlyBaseHit) {
      failures.push(
        `Stage ${stage} run ${run}: enemy hit base at ${earlyBaseHit.time.toFixed(2)}s ` +
          `from ${earlyBaseHit.x.toFixed(1)},${earlyBaseHit.y.toFixed(1)} ${earlyBaseHit.dir}`,
      );
      return;
    }

    const anomaly = checkFrameAnomalies(game, frame, allowedEnemySpawns);
    if (anomaly) {
      failures.push(`Stage ${stage} run ${run}: ${anomaly}`);
      return;
    }
  }

  if (context.__baseHitProbe.some((hit) => hit.side === 'enemy')) {
    summary.baseHitRuns += 1;
  }
}

function earlyBaseHitThreshold(stage) {
  return stage <= 4 ? 18 : 12;
}

function checkFrameAnomalies(game, frame, allowedEnemySpawns) {
  for (const enemy of game.enemies) {
    if (enemy.x < 0 || enemy.y < 0 || enemy.x > 12 * 16 || enemy.y > 12 * 16) {
      return `enemy left battlefield at ${enemy.x.toFixed(1)},${enemy.y.toFixed(1)}`;
    }

    const tile = coarseTankTile(enemy);
    if (frame < 30 && enemy.spawnShield > 0 && !allowedEnemySpawns.includes(`${tile.x},${tile.y}`)) {
      return `enemy spawned at unexpected tile ${tile.x},${tile.y}`;
    }
  }

  const tanks = [game.player, ...game.enemies].filter((tank) => tank.alive);
  for (let i = 0; i < tanks.length; i += 1) {
    for (let j = i + 1; j < tanks.length; j += 1) {
      if (rectsIntersect(api.tankRect(tanks[i]), api.tankRect(tanks[j]))) {
        return `tank overlap at frame ${frame}`;
      }
    }
  }

  for (const powerUp of game.powerUps) {
    if (powerUp.x < 0 || powerUp.y < 0 || powerUp.x > 12 * 16 || powerUp.y > 12 * 16) {
      return `power-up left battlefield at ${powerUp.x},${powerUp.y}`;
    }
    if (!canReachCoarseTile(game, coarseTankTile(game.player), coarsePoint(powerUp))) {
      return `power-up spawned on unreachable tile ${powerUp.x / 16},${powerUp.y / 16}`;
    }
  }

  return null;
}

function driveBot(game, frame) {
  api.keys.clear();

  const player = game.player;
  if (!player.alive) {
    return;
  }

  const enemies = game.enemies.filter((enemy) => enemy.alive);
  let target = { x: player.x, y: player.y };
  if (enemies.length > 0) {
    enemies.sort((a, b) => distance(a, player) - distance(b, player));
    target = enemies[0];
  }

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const nearBase = player.y > 164 && player.x > 48 && player.x < 128;
  let direction;
  if (nearBase && frame % 180 < 90) {
    direction = player.x < 72 ? 'right' : 'left';
  } else if (Math.abs(dx) > Math.abs(dy)) {
    direction = dx > 0 ? 'right' : 'left';
  } else {
    direction = dy > 0 ? 'down' : 'up';
  }

  const keyMap = {
    up: 'ArrowUp',
    right: 'ArrowRight',
    down: 'ArrowDown',
    left: 'ArrowLeft',
  };
  api.keys.add(keyMap[direction]);

  if (safeToShoot(game) && frame % 20 < 10) {
    api.keys.add('Space');
  }
}

function safeToShoot(game) {
  const player = game.player;
  if (!player.alive) {
    return false;
  }
  if (player.dir === 'down' && player.y > 128 && Math.abs(player.x - 96) < 44) {
    return false;
  }
  if (player.dir === 'right' && player.y > 168 && player.x < 112) {
    return false;
  }
  if (player.dir === 'left' && player.y > 168 && player.x > 80) {
    return false;
  }
  return true;
}

function seedRandom(seed) {
  randomState = seed >>> 0;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function coarseTankTile(tank) {
  return {
    x: Math.round(tank.x / 16),
    y: Math.round(tank.y / 16),
  };
}

function coarsePoint(point) {
  return {
    x: point.x / 16,
    y: point.y / 16,
  };
}

function canReachCoarseTile(game, start, target) {
  if (!isPassableCoarseTile(game, target.x, target.y)) {
    return false;
  }

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
      if (['B', 'S', 'W', 'E'].includes(game.map[blockY]?.[blockX])) {
        return false;
      }
    }
  }

  return true;
}

function key(tile) {
  return `${tile.x},${tile.y}`;
}

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
