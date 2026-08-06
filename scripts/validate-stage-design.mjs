// Quick stage validator for design iteration
const BOARD = 13;
const PASSABLE = new Set(['.', 'F', 'I']);
const ROUTABLE = new Set(['.', 'B', 'F', 'I']);
const BULLET_PASSABLE = new Set(['.', 'W', 'F', 'I']);

function tileAt(map, x, y) {
  if (x < 0 || x >= BOARD || y < 0 || y >= BOARD) return '#';
  return map[y][x];
}

function inBounds(x, y) {
  return x >= 0 && x < BOARD && y >= 0 && y < BOARD;
}

function neighbors(p) {
  return [
    { x: p.x, y: p.y - 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
  ].filter(({ x, y }) => inBounds(x, y));
}

function findBase(map) {
  for (let y = 0; y < BOARD; y++) {
    for (let x = 0; x < BOARD; x++) {
      if (map[y][x] === 'E') return { x, y };
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
  return [
    { x: base.x - 2, y: base.y },
    { x: base.x + 2, y: base.y },
    { x: base.x - 2, y: base.y - 1 },
    { x: base.x + 2, y: base.y - 1 },
    { x: base.x - 1, y: base.y - 2 },
    { x: base.x, y: base.y - 2 },
    { x: base.x + 1, y: base.y - 2 },
  ].filter(({ x, y }) => inBounds(x, y));
}

function bfsDistances(map, start) {
  const distances = new Map();
  if (!PASSABLE.has(tileAt(map, start.x, start.y))) return distances;
  const queue = [start];
  distances.set(`${start.x},${start.y}`, 0);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const distance = distances.get(`${current.x},${current.y}`);
    for (const next of neighbors(current)) {
      if (!PASSABLE.has(tileAt(map, next.x, next.y))) continue;
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
  if (!ROUTABLE.has(tileAt(map, start.x, start.y))) return distances;
  const queue = [start];
  distances.set(`${start.x},${start.y}`, 0);
  while (queue.length > 0) {
    queue.sort((a, b) => distances.get(`${a.x},${a.y}`) - distances.get(`${b.x},${b.y}`));
    const current = queue.shift();
    const distance = distances.get(`${current.x},${current.y}`);
    for (const next of neighbors(current)) {
      const tile = tileAt(map, next.x, next.y);
      if (!ROUTABLE.has(tile)) continue;
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

function hasSpawnBulletLineToBase(map, spawns) {
  return spawns.some((spawn) => {
    if (!inBounds(spawn.x, spawn.y)) return false;
    for (let y = spawn.y + 1; y < BOARD; y++) {
      const tile = tileAt(map, spawn.x, y);
      if (tile === 'E') return true;
      if (!BULLET_PASSABLE.has(tile)) return false;
    }
    return false;
  });
}

function findForestSteelAdjacencies(map) {
  const adj = [];
  for (let y = 0; y < BOARD; y++) {
    for (let x = 0; x < BOARD; x++) {
      if (tileAt(map, x, y) !== 'F') continue;
      for (const next of neighbors({ x, y })) {
        if (tileAt(map, next.x, next.y) === 'S') adj.push(`${x},${y}<->${next.x},${next.y}`);
      }
    }
  }
  return adj;
}

function countTerrain(map) {
  const counts = { S: 0, W: 0, F: 0, I: 0 };
  for (const row of map) {
    for (const tile of row) {
      if (tile in counts) counts[tile]++;
    }
  }
  return counts;
}

function terrainComplexityScore(counts) {
  return counts.S + counts.W * 2 + counts.F + counts.I;
}

function calculateDifficultyScore(minPath, openRingCount, terrainCounts) {
  return terrainComplexityScore(terrainCounts) + openRingCount * 4 + Math.max(0, 18 - minPath);
}

function validateStage(rows, stageNum, spawns) {
  const map = rows.map((r) => [...r]);
  const errors = [];
  const base = findBase(map);
  if (!base) {
    errors.push('missing base');
    return { errors };
  }

  const protectionRing = baseProtectionRing(base);
  const approachTiles = baseApproachTiles(base);
  const protectionCount = protectionRing.filter(({ x, y }) => ['B', 'S'].includes(tileAt(map, x, y))).length;
  const openRingCount = protectionRing.filter(({ x, y }) => PASSABLE.has(tileAt(map, x, y))).length;
  const terrainCounts = countTerrain(map);
  const spawnReports = spawns.map((spawn) => {
    const openDistances = bfsDistances(map, spawn);
    const breakableDistances = dijkstraDistances(map, spawn);
    const canEnterField = [...openDistances.keys()].some((key) => Number(key.split(',')[1]) >= 2);
    const baseDistance = Math.min(...approachTiles.map(({ x, y }) => breakableDistances.get(`${x},${y}`) ?? Infinity));
    return { canEnterField, baseDistance };
  });
  const minSpawnToBasePath = Math.min(...spawnReports.map((r) => r.baseDistance));
  const spawnBulletLineToBase = hasSpawnBulletLineToBase(map, spawns);
  const forestSteelAdj = findForestSteelAdjacencies(map);
  const difficultyScore = calculateDifficultyScore(minSpawnToBasePath, openRingCount, terrainCounts);

  for (let i = 0; i < spawnReports.length; i++) {
    if (!spawnReports[i].canEnterField) errors.push(`spawn ${i + 1} cannot enter field`);
    if (!Number.isFinite(spawnReports[i].baseDistance)) errors.push(`spawn ${i + 1} no route to base`);
  }
  if (minSpawnToBasePath < 13) errors.push(`minPath ${minSpawnToBasePath} < 13`);
  if (openRingCount > 0) errors.push(`baseOpen ${openRingCount} > 0`);
  if (protectionCount < 5) errors.push(`protection ${protectionCount} < 5`);
  if (spawnBulletLineToBase) errors.push('spawn bullet line to base');
  if (forestSteelAdj.length > 0) errors.push(`forest-steel adjacency: ${forestSteelAdj.join(', ')}`);

  return {
    errors,
    minSpawnToBasePath,
    openRingCount,
    protectionCount,
    terrainCounts,
    difficultyScore,
    terrainComplexity: terrainComplexityScore(terrainCounts),
  };
}

// Test designs
const designs = {
  stage1_v2: [
    '.B.B...B.B.B.',
    '.............',
    '.B.B...B.B.B.',
    '..BB.....BB..',
    '....B.S.B....',
    '.B.B.B.B.B.B.',
    '.B.BB...BB.B.',
    '.B.BB...BB.B.',
    '.B.BB...BB.B.',
    '.B.B.....B.B.',
    '.B.BBBBBBB.B.',
    '.....BBB.....',
    '.....BEB.....',
  ],
  stage7_v2: [
    '..B..S.S..B..',
    '..F..B.B..F..',
    '.....F.F.....',
    '.BB.WW.WW.BB.',
    'FF.B.I.I.B.FF',
    'B....B.B....B',
    '...B..I..B...',
    '.BB..WWW..BB.',
    '..F..B.B..F..',
    '.B.S.....S.B.',
    '.B.B..S.BB...',
    '.....BBB.....',
    '.....BEB.....',
  ],
};

const spawns = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 12, y: 0 },
];

for (const [name, rows] of Object.entries(designs)) {
  const result = validateStage(rows, name, spawns);
  console.log(`${name}: score=${result.difficultyScore} complexity=${result.terrainComplexity} path=${result.minSpawnToBasePath} protection=${result.protectionCount}`);
  if (result.errors.length > 0) {
    console.log(`  ERRORS: ${result.errors.join('; ')}`);
  }
}
