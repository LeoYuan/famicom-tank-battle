import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs
  .readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  .replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__stageDifficultyTest = {
  LEVELS_13_DRAFT,
  STAGE_TUNING: typeof STAGE_TUNING === 'undefined' ? null : STAGE_TUNING,
  parseLevel,
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

const { LEVELS_13_DRAFT: levels, STAGE_TUNING: stageTuning, parseLevel } = context.__stageDifficultyTest;

const BOARD = 13;
const SPAWNS = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 12, y: 0 },
];
const PASSABLE = new Set(['.', 'F', 'I']);
const ROUTABLE = new Set(['.', 'B', 'F', 'I']);
const BULLET_PASSABLE = new Set(['.', 'W', 'F', 'I']);
const TERRAIN = ['S', 'W', 'F', 'I'];

const stageTargets = [
  { minPath: 14, maxOpenRing: 0, minProtection: 5, required: {}, forbidden: ['W', 'F', 'I'] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: {}, forbidden: ['W', 'F', 'I'] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: {}, forbidden: ['W', 'F', 'I'] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4 }, forbidden: ['W', 'F', 'I'] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { W: 2 }, forbidden: ['I'] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { F: 2 }, forbidden: ['I'] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
  { minPath: 13, maxOpenRing: 0, minProtection: 5, required: { S: 4, W: 2, F: 2, I: 2 }, forbidden: [] },
];

const failures = [];
const reports = [];

if (levels.length !== 20) {
  failures.push(`Expected exactly 20 stages, got ${levels.length}`);
}

checkStageTuning();

levels.forEach((rows, stageIndex) => {
  const stage = stageIndex + 1;
  const target = stageTargets[stageIndex];
  const map = rows.map((row) => [...row]);

  try {
    parseLevel(rows);
  } catch (error) {
    failures.push(`Stage ${stage}: ${error.message}`);
  }

  const base = findBase(map);
  if (!base) {
    failures.push(`Stage ${stage}: missing base tile E`);
    return;
  }

  const protectionRing = baseProtectionRing(base);
  const approachTiles = baseApproachTiles(base);
  const protectionCount = protectionRing.filter(({ x, y }) => ['B', 'S'].includes(tileAt(map, x, y))).length;
  const openRingCount = protectionRing.filter(({ x, y }) => PASSABLE.has(tileAt(map, x, y))).length;
  const terrainCounts = countTerrain(map);
  const activeSpawns = stageTuning?.[stageIndex]?.enemySpawnTiles ?? SPAWNS;
  const spawnReports = SPAWNS.map((spawn) => analyzeSpawn(map, spawn, approachTiles));
  const minSpawnToBasePath = Math.min(...spawnReports.map((report) => report.baseDistance));
  const openAreaRatio = countOpenArea(map) / (BOARD * BOARD);
  const difficultyScore = calculateDifficultyScore(minSpawnToBasePath, openRingCount, terrainCounts);
  const directBaseApproach = hasDirectBaseApproach(map, base, activeSpawns);
  const breakableDirectBaseApproach = hasBreakableDirectBaseApproach(map, base, activeSpawns);
  const spawnBulletLineToBase = hasSpawnBulletLineToBase(map, activeSpawns);
  const forestSteelAdjacencies = findForestSteelAdjacencies(map);

  reports.push({
    stage,
    minSpawnToBasePath,
    openRingCount,
    protectionCount,
    terrainCounts,
    openAreaRatio,
    difficultyScore,
    directBaseApproach,
    breakableDirectBaseApproach,
    spawnBulletLineToBase,
  });

  for (const [spawnIndex, report] of spawnReports.entries()) {
    if (!report.canEnterField) {
      failures.push(`Stage ${stage}: spawn ${spawnIndex + 1} cannot enter battlefield`);
    }
    if (!Number.isFinite(report.baseDistance)) {
      failures.push(`Stage ${stage}: spawn ${spawnIndex + 1} has no route to base perimeter`);
    }
  }

  if (!target) {
    return;
  }

  if (minSpawnToBasePath < target.minPath) {
    failures.push(
      `Stage ${stage}: min spawn-to-base path ${minSpawnToBasePath} is below target ${target.minPath}`,
    );
  }
  if (openRingCount > target.maxOpenRing) {
    failures.push(`Stage ${stage}: base open ring ${openRingCount} exceeds target ${target.maxOpenRing}`);
  }
  if (protectionCount < target.minProtection) {
    failures.push(`Stage ${stage}: base protection ${protectionCount} is below target ${target.minProtection}`);
  }

  for (const [terrain, minimum] of Object.entries(target.required)) {
    if (terrainCounts[terrain] < minimum) {
      failures.push(`Stage ${stage}: expected at least ${minimum} ${terrain} tiles, got ${terrainCounts[terrain]}`);
    }
  }

  for (const terrain of target.forbidden) {
    if (terrainCounts[terrain] > 0) {
      failures.push(`Stage ${stage}: ${terrain} should not appear yet`);
    }
  }

  if (stage > 1 && reports.length >= 2) {
    const previous = reports[reports.length - 2];
    const terrainComplexity = terrainComplexityScore(terrainCounts);
    const previousTerrainComplexity = terrainComplexityScore(previous.terrainCounts);
    if (stage >= 4 && terrainComplexity < previousTerrainComplexity) {
      failures.push(`Stage ${stage}: terrain complexity should not drop below Stage ${stage - 1}`);
    }
    if (difficultyScore < previous.difficultyScore) {
      failures.push(
        `Stage ${stage}: difficulty score ${difficultyScore} should not drop below Stage ${stage - 1} score ${previous.difficultyScore}`,
      );
    }
  }

  if (stage <= 4 && directBaseApproach) {
    failures.push(`Stage ${stage}: an enemy spawn has a direct no-turn approach to the base front`);
  }
  if (stage <= 4 && breakableDirectBaseApproach) {
    failures.push(`Stage ${stage}: an enemy spawn can shoot open a straight breakable lane to the base front`);
  }
  if (spawnBulletLineToBase) {
    failures.push(`Stage ${stage}: an active enemy spawn can shoot the base before leaving spawn`);
  }
  if (forestSteelAdjacencies.length > 0) {
    failures.push(
      `Stage ${stage}: forest and steel tiles touch visually at ${forestSteelAdjacencies.join(', ')}`,
    );
  }
});

for (const report of reports) {
  console.log(
    [
      `Stage ${report.stage}`,
      `path=${report.minSpawnToBasePath}`,
      `baseOpen=${report.openRingCount}`,
      `baseProtection=${report.protectionCount}`,
      `terrain=${JSON.stringify(report.terrainCounts)}`,
      `open=${report.openAreaRatio.toFixed(2)}`,
      `score=${report.difficultyScore}`,
      `directBaseApproach=${report.directBaseApproach}`,
      `breakableDirectBaseApproach=${report.breakableDirectBaseApproach}`,
      `spawnBulletLineToBase=${report.spawnBulletLineToBase}`,
    ].join(' | '),
  );
}

if (failures.length > 0) {
  console.error('\nStage difficulty check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nStage difficulty check passed for all 20 stages');

function checkStageTuning() {
  if (!Array.isArray(stageTuning) || stageTuning.length !== 20) {
    failures.push(`Expected stage tuning for exactly 20 stages, got ${Array.isArray(stageTuning) ? stageTuning.length : 'none'}`);
    return;
  }

  const stage1 = stageTuning[0];
  if (stage1.enemySpawnTiles.length > 2) {
    failures.push(`Stage 1: expected at most 2 enemy spawn positions, got ${stage1.enemySpawnTiles.length}`);
  }
  if (stage1.maxEnemiesOnField > 2) {
    failures.push(`Stage 1: expected at most 2 enemies on field, got ${stage1.maxEnemiesOnField}`);
  }
  if (stage1.initialEnemySpawnDelay < 2) {
    failures.push(`Stage 1: initial enemy spawn delay ${stage1.initialEnemySpawnDelay} is too fast`);
  }
  if (stage1.enemySpawnInterval < 2.6) {
    failures.push(`Stage 1: enemy spawn interval ${stage1.enemySpawnInterval} is too fast`);
  }

  for (let index = 0; index < 4; index += 1) {
    const current = stageTuning[index];
    const stage = index + 1;
    if (current.enemySpawnTiles.some((spawn) => spawn.x === 6 && spawn.y === 0)) {
      failures.push(`Stage ${stage}: center enemy spawn should not be active before Stage 5`);
    }
  }

  for (let index = 1; index < stageTuning.length; index += 1) {
    const previous = stageTuning[index - 1];
    const current = stageTuning[index];
    const stage = index + 1;
    if (current.maxEnemiesOnField < previous.maxEnemiesOnField) {
      failures.push(`Stage ${stage}: max enemies should not drop below Stage ${stage - 1}`);
    }
    if (current.enemySpawnInterval > previous.enemySpawnInterval) {
      failures.push(`Stage ${stage}: spawn interval should not be slower than Stage ${stage - 1}`);
    }
  }
}

function findBase(map) {
  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      if (map[y][x] === 'E') {
        return { x, y };
      }
    }
  }
  return null;
}

function baseProtectionRing(base) {
  return [
    { x: base.x - 1, y: base.y - 1 },
    { x: base.x, y: base.y - 1 },
    { x: base.x + 1, y: base.y - 1 },
    { x: base.x - 1, y: base.y },
    { x: base.x + 1, y: base.y },
  ];
}

function baseApproachTiles(base) {
  return uniquePoints([
    { x: base.x - 2, y: base.y },
    { x: base.x + 2, y: base.y },
    { x: base.x - 2, y: base.y - 1 },
    { x: base.x + 2, y: base.y - 1 },
    { x: base.x - 1, y: base.y - 2 },
    { x: base.x, y: base.y - 2 },
    { x: base.x + 1, y: base.y - 2 },
  ]).filter(({ x, y }) => inBounds(x, y));
}

function analyzeSpawn(map, spawn, approachTiles) {
  const openDistances = bfsDistances(map, spawn);
  const breakableDistances = dijkstraDistances(map, spawn);
  const canEnterField = [...openDistances.keys()].some((key) => Number(key.split(',')[1]) >= 2);
  const baseDistance = Math.min(...approachTiles.map(({ x, y }) => breakableDistances.get(`${x},${y}`) ?? Infinity));

  return { canEnterField, baseDistance };
}

function hasDirectBaseApproach(map, base, spawns) {
  const frontLineY = base.y - 3;
  return spawns.some((spawn) => {
    if (spawn.x < base.x - 1 || spawn.x > base.x + 1) {
      return false;
    }

    const startTile = tileAt(map, spawn.x, spawn.y);
    if (!PASSABLE.has(startTile)) {
      return false;
    }

    for (let y = spawn.y + 1; y <= frontLineY; y += 1) {
      if (!PASSABLE.has(tileAt(map, spawn.x, y))) {
        return false;
      }
    }

    return true;
  });
}

function hasBreakableDirectBaseApproach(map, base, spawns) {
  const frontLineY = base.y - 3;
  return spawns.some((spawn) => {
    if (spawn.x < base.x - 1 || spawn.x > base.x + 1) {
      return false;
    }

    if (!ROUTABLE.has(tileAt(map, spawn.x, spawn.y))) {
      return false;
    }

    for (let y = spawn.y + 1; y <= frontLineY; y += 1) {
      if (!ROUTABLE.has(tileAt(map, spawn.x, y))) {
        return false;
      }
    }

    return true;
  });
}

function hasSpawnBulletLineToBase(map, spawns) {
  return spawns.some((spawn) => {
    if (!inBounds(spawn.x, spawn.y)) {
      return false;
    }

    for (let y = spawn.y + 1; y < BOARD; y += 1) {
      const tile = tileAt(map, spawn.x, y);
      if (tile === 'E') {
        return true;
      }
      if (!BULLET_PASSABLE.has(tile)) {
        return false;
      }
    }

    return false;
  });
}

function findForestSteelAdjacencies(map) {
  const adjacencies = [];

  for (let y = 0; y < BOARD; y += 1) {
    for (let x = 0; x < BOARD; x += 1) {
      if (tileAt(map, x, y) !== 'F') {
        continue;
      }

      for (const next of neighbors({ x, y })) {
        if (tileAt(map, next.x, next.y) === 'S') {
          adjacencies.push(`${x},${y}<->${next.x},${next.y}`);
        }
      }
    }
  }

  return adjacencies;
}

function bfsDistances(map, start) {
  const distances = new Map();
  if (!PASSABLE.has(tileAt(map, start.x, start.y))) {
    return distances;
  }

  const queue = [start];
  distances.set(`${start.x},${start.y}`, 0);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const distance = distances.get(`${current.x},${current.y}`);
    for (const next of neighbors(current)) {
      if (!PASSABLE.has(tileAt(map, next.x, next.y))) {
        continue;
      }
      const key = `${next.x},${next.y}`;
      if (!distances.has(key)) {
        distances.set(key, distance + 1);
        queue.push(next);
      }
    }
  }

  return distances;
}

function dijkstraDistances(map, start) {
  const distances = new Map();
  if (!ROUTABLE.has(tileAt(map, start.x, start.y))) {
    return distances;
  }

  const queue = [start];
  distances.set(`${start.x},${start.y}`, 0);

  while (queue.length > 0) {
    queue.sort((a, b) => distances.get(`${a.x},${a.y}`) - distances.get(`${b.x},${b.y}`));
    const current = queue.shift();
    const distance = distances.get(`${current.x},${current.y}`);

    for (const next of neighbors(current)) {
      const tile = tileAt(map, next.x, next.y);
      if (!ROUTABLE.has(tile)) {
        continue;
      }

      const nextDistance = distance + (tile === 'B' ? 5 : 1);
      const key = `${next.x},${next.y}`;
      if (!distances.has(key) || nextDistance < distances.get(key)) {
        distances.set(key, nextDistance);
        queue.push(next);
      }
    }
  }

  return distances;
}

function neighbors(point) {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ].filter(({ x, y }) => inBounds(x, y));
}

function tileAt(map, x, y) {
  if (!inBounds(x, y)) {
    return '#';
  }
  return map[y][x];
}

function inBounds(x, y) {
  return x >= 0 && x < BOARD && y >= 0 && y < BOARD;
}

function countTerrain(map) {
  const counts = Object.fromEntries(TERRAIN.map((terrain) => [terrain, 0]));
  for (const row of map) {
    for (const tile of row) {
      if (tile in counts) {
        counts[tile] += 1;
      }
    }
  }
  return counts;
}

function countOpenArea(map) {
  return map.flat().filter((tile) => PASSABLE.has(tile)).length;
}

function terrainComplexityScore(counts) {
  return counts.S + counts.W * 2 + counts.F + counts.I;
}

function calculateDifficultyScore(minPath, openRingCount, terrainCounts) {
  return terrainComplexityScore(terrainCounts) + openRingCount * 4 + Math.max(0, 18 - minPath);
}

function uniquePoints(points) {
  const seen = new Set();
  return points.filter((point) => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
