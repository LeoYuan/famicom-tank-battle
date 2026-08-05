const TILE = 16;
const BOARD = 13;
const FIELD = TILE * BOARD;
const BULLET_DODGE_LANE = 16;
const DIRECTIONS = ['up', 'right', 'down', 'left'];
const KEY_FOR_DIRECTION = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
};
const VECTOR = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export function createAutoplayController() {
  let lastX = null;
  let lastY = null;
  let stationaryFrames = 0;
  let recoveryDirection = null;
  let recoveryFrames = 0;
  let stage = 0;

  return {
    decide(game, frame) {
      if (game.stage !== stage) {
        stage = game.stage;
        lastX = null;
        lastY = null;
        stationaryFrames = 0;
        recoveryDirection = null;
        recoveryFrames = 0;
      }

      if (game.phase === 'title') {
        return frame % 90 === 0 ? ['Enter'] : [];
      }
      if (game.phase === 'won') {
        return frame % 90 === 0 ? ['Enter'] : [];
      }
      if (game.phase !== 'playing' || !game.player.alive) {
        return [];
      }

      const player = game.player;
      if (lastX === player.x && lastY === player.y) {
        stationaryFrames += 1;
      } else {
        stationaryFrames = 0;
        lastX = player.x;
        lastY = player.y;
      }

      const bulletResponse = dodgeOrCounterBullet(game);
      if (bulletResponse.length > 0) {
        return bulletResponse;
      }

      const aimedEnemyResponse = evadeCloseAimedEnemies(game);
      if (aimedEnemyResponse.length > 0) {
        return aimedEnemyResponse;
      }

      const firingDirection = alignedEnemyDirection(game);
      if (firingDirection && canShootSafely(game, firingDirection)) {
        return [KEY_FOR_DIRECTION[firingDirection], 'Space'];
      }

      if (stationaryFrames > 42 && recoveryFrames <= 0) {
        recoveryDirection = chooseRecoveryDirection(game, frame);
        recoveryFrames = 36;
      }
      if (recoveryFrames > 0 && recoveryDirection) {
        recoveryFrames -= 1;
        const keys = [KEY_FOR_DIRECTION[recoveryDirection]];
        if (canShootSafely(game, recoveryDirection)) {
          keys.push('Space');
        }
        return keys;
      }

      const powerUpTarget = choosePowerUpTarget(game);
      const enemyTarget = chooseEnemyTarget(game);
      const route = powerUpTarget
        ? findPath(game, coarseTankTile(player), [powerUpTarget], false)
        : enemyTarget
          ? findPath(game, coarseTankTile(player), firingGoalTiles(game, enemyTarget), true)
          : findPath(game, coarseTankTile(player), patrolGoals(game, frame), true);

      if (route.length < 2) {
        const direction = game.player.y >= 112 && canAdvance(game, 'up')
          ? 'up'
          : safePatrolDirection(game, frame);
        const keys = direction ? [KEY_FOR_DIRECTION[direction]] : [];
        if (
          direction &&
          canShootSafely(game, direction) &&
          (shouldClearAhead(game, direction) || direction === 'up')
        ) {
          keys.push('Space');
        }
        return keys;
      }

      const direction = directionBetween(route[0], route[1]);
      const keys = [KEY_FOR_DIRECTION[direction]];
      const nextKind = cellKind(game, route[1]);
      if (canShootSafely(game, direction)) {
        keys.push('Space');
      }
      return keys;
    },
  };
}

function choosePowerUpTarget(game) {
  const start = coarseTankTile(game.player);
  const candidates = [];

  for (const powerUp of game.powerUps) {
    const target = coarsePoint(powerUp);
    const path = findPath(game, start, [target], false);
    if (path.length === 0) {
      continue;
    }
    const travelSeconds = (path.length - 1) * TILE / game.player.speed;
    const remaining = powerUp.duration - powerUp.age;
    const urgencyBonus = ['shovel', 'helmet', 'tank', 'grenade'].includes(powerUp.type) ? 2 : 0;
    if (travelSeconds + 0.8 <= remaining && path.length - 1 <= 5 + urgencyBonus) {
      candidates.push({ target, score: path.length - urgencyBonus });
    }
  }

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.target ?? null;
}

function chooseEnemyTarget(game) {
  const player = game.player;
  const base = { x: 6 * TILE, y: 12 * TILE };
  const enemies = game.enemies.filter((enemy) => enemy.alive);
  enemies.sort((a, b) => {
    const aBase = distance(a, base);
    const bBase = distance(b, base);
    const aPlayer = distance(a, player);
    const bPlayer = distance(b, player);
    const aThreat = a.y > 128 ? 500 : 0;
    const bThreat = b.y > 128 ? 500 : 0;
    const aBonus = a.bonusCarrier ? 36 : 0;
    const bBonus = b.bonusCarrier ? 36 : 0;
    return (bThreat + bBonus - bBase - bPlayer * 0.3) - (aThreat + aBonus - aBase - aPlayer * 0.3);
  });
  return enemies[0] ?? null;
}

function firingGoalTiles(game, enemy) {
  const enemyTile = coarseTankTile(enemy);
  const goals = [];

  for (let distance = 2; distance <= 5; distance += 1) {
    const tile = {
      x: enemyTile.x,
      y: enemyTile.y + distance,
    };
    if (
      inBounds(tile) &&
      tile.y <= 10 &&
      cellKind(game, tile) !== 'blocked' &&
      clearFiringLine(game, tile, enemyTile)
    ) {
      goals.push(tile);
    }
  }

  if (enemyTile.y >= 8) {
    for (let distance = 2; distance <= 4; distance += 1) {
      for (const direction of ['left', 'right']) {
        const vector = VECTOR[direction];
        const tile = {
          x: enemyTile.x + vector.x * distance,
          y: enemyTile.y,
        };
        if (
          inBounds(tile) &&
          tile.y <= 10 &&
          cellKind(game, tile) !== 'blocked' &&
          clearFiringLine(game, tile, enemyTile)
        ) {
          goals.push(tile);
        }
      }
    }
  }

  return uniqueTiles(goals.length > 0 ? goals : patrolGoals(game, enemy.id * 60));
}

function patrolGoals(game, frame) {
  const goals = [
    { x: 4, y: 9 },
    { x: 8, y: 9 },
    { x: 3, y: 7 },
    { x: 9, y: 7 },
    { x: 6, y: 6 },
  ];
  const offset = Math.floor(frame / 240) % goals.length;
  return [...goals.slice(offset), ...goals.slice(0, offset)]
    .filter((tile) => cellKind(game, tile) !== 'blocked');
}

function alignedEnemyDirection(game) {
  const playerCenter = center(game.player);
  const aligned = [];

  for (const enemy of game.enemies) {
    if (!enemy.alive) {
      continue;
    }
    const enemyCenter = center(enemy);
    if (Math.abs(enemyCenter.x - playerCenter.x) <= 6) {
      const direction = enemyCenter.y < playerCenter.y ? 'up' : 'down';
      if (clearBulletLine(game, playerCenter, enemyCenter, direction)) {
        aligned.push({ direction, distance: Math.abs(enemyCenter.y - playerCenter.y), threat: enemy.y });
      }
    }
    if (Math.abs(enemyCenter.y - playerCenter.y) <= 6) {
      const direction = enemyCenter.x < playerCenter.x ? 'left' : 'right';
      if (clearBulletLine(game, playerCenter, enemyCenter, direction)) {
        aligned.push({ direction, distance: Math.abs(enemyCenter.x - playerCenter.x), threat: enemy.y });
      }
    }
  }

  aligned.sort((a, b) => b.threat - a.threat || a.distance - b.distance);
  return aligned[0]?.direction ?? null;
}

function enemyInDirection(game, direction) {
  const playerCenter = center(game.player);
  return game.enemies.some((enemy) => {
    if (!enemy.alive) {
      return false;
    }
    const enemyCenter = center(enemy);
    if (direction === 'up' || direction === 'down') {
      if (Math.abs(enemyCenter.x - playerCenter.x) > 6) {
        return false;
      }
      if (direction === 'up' && enemyCenter.y >= playerCenter.y) {
        return false;
      }
      if (direction === 'down' && enemyCenter.y <= playerCenter.y) {
        return false;
      }
    } else {
      if (Math.abs(enemyCenter.y - playerCenter.y) > 6) {
        return false;
      }
      if (direction === 'left' && enemyCenter.x >= playerCenter.x) {
        return false;
      }
      if (direction === 'right' && enemyCenter.x <= playerCenter.x) {
        return false;
      }
    }
    return clearBulletLine(game, playerCenter, enemyCenter, direction);
  });
}

function dodgeOrCounterBullet(game) {
  const playerCenter = center(game.player);
  const threats = game.bullets
    .filter((bullet) => bullet.alive && bullet.side === 'enemy')
    .map((bullet) => ({
      bullet,
      distance: distance(bullet, playerCenter),
    }))
    .filter(({ bullet, distance: bulletDistance }) => {
      if (bulletDistance > 80) {
        return false;
      }
      if (bullet.dir === 'up' || bullet.dir === 'down') {
        const approaching =
          (bullet.dir === 'down' && bullet.y < playerCenter.y) ||
          (bullet.dir === 'up' && bullet.y > playerCenter.y);
        return approaching && Math.abs(renderedBulletCenter(bullet).x - playerCenter.x) < BULLET_DODGE_LANE;
      }
      const approaching =
        (bullet.dir === 'right' && bullet.x < playerCenter.x) ||
        (bullet.dir === 'left' && bullet.x > playerCenter.x);
      return approaching && Math.abs(renderedBulletCenter(bullet).y - playerCenter.y) < BULLET_DODGE_LANE;
    })
    .sort((a, b) => a.distance - b.distance);

  const threat = threats[0];
  if (!threat) {
    return [];
  }

  const perpendicularDirections =
    threat.bullet.dir === 'up' || threat.bullet.dir === 'down'
      ? ['left', 'right']
      : ['up', 'down'];
  const dodgeCandidates = [
    ...perpendicularDirections,
  ]
    .map((direction) => ({
      direction,
      score: scoreDodgeDirection(game, threat.bullet, direction),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score);
  if (dodgeCandidates.length > 0) {
    return [KEY_FOR_DIRECTION[dodgeCandidates[0].direction]];
  }

  const counterDirection = opposite(threat.bullet.dir);
  return playerHasBulletCapacity(game) && canShootSafely(game, counterDirection)
    ? [KEY_FOR_DIRECTION[counterDirection], 'Space']
    : [];
}

function scoreDodgeDirection(game, bullet, direction) {
  let clearance = 0;
  for (const distance of [4, 8, 12, 16, 20, 24]) {
    if (!canOccupyAfterMove(game, direction, distance)) {
      break;
    }
    clearance = distance;
  }
  if (clearance < 8) {
    return Number.NEGATIVE_INFINITY;
  }

  const vector = VECTOR[direction];
  const bulletCenter = renderedBulletCenter(bullet);
  const currentCenter = center(game.player);
  const immediateCenter = {
    x: currentCenter.x + vector.x,
    y: currentCenter.y + vector.y,
  };
  const futureCenter = {
    x: game.player.x + 8 + vector.x * clearance,
    y: game.player.y + 8 + vector.y * clearance,
  };
  const currentSeparation =
    bullet.dir === 'up' || bullet.dir === 'down'
      ? Math.abs(currentCenter.x - bulletCenter.x)
      : Math.abs(currentCenter.y - bulletCenter.y);
  const immediateSeparation =
    bullet.dir === 'up' || bullet.dir === 'down'
      ? Math.abs(immediateCenter.x - bulletCenter.x)
      : Math.abs(immediateCenter.y - bulletCenter.y);
  if (immediateSeparation <= currentSeparation) {
    return Number.NEGATIVE_INFINITY;
  }
  const lineSeparation =
    bullet.dir === 'up' || bullet.dir === 'down'
      ? Math.abs(futureCenter.x - bulletCenter.x)
      : Math.abs(futureCenter.y - bulletCenter.y);
  const edgeMargin = Math.min(
    futureCenter.x,
    futureCenter.y,
    FIELD - futureCenter.x,
    FIELD - futureCenter.y,
  );
  const perpendicularBonus = direction === bullet.dir ? 0 : 80;
  return perpendicularBonus + lineSeparation * 6 + clearance * 2 + edgeMargin * 0.15;
}

function evadeCloseAimedEnemies(game) {
  const playerCenter = center(game.player);
  const threats = game.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => aimedEnemyThreat(game, enemy, playerCenter))
    .filter(Boolean);
  if (threats.length === 0) {
    return [];
  }

  const candidates = DIRECTIONS
    .map((direction) => ({
      direction,
      score: scoreCloseAimEvasion(game, threats, direction),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score);
  return candidates.length > 0 ? [KEY_FOR_DIRECTION[candidates[0].direction]] : [];
}

function aimedEnemyThreat(game, enemy, playerCenter) {
  const enemyCenter = center(enemy);
  const vector = VECTOR[enemy.dir];
  const offset = {
    x: playerCenter.x - enemyCenter.x,
    y: playerCenter.y - enemyCenter.y,
  };
  const axialDistance = offset.x * vector.x + offset.y * vector.y;
  const crossSeparation =
    enemy.dir === 'up' || enemy.dir === 'down'
      ? Math.abs(offset.x)
      : Math.abs(offset.y);
  if (
    axialDistance <= 0 ||
    axialDistance > 48 ||
    crossSeparation >= BULLET_DODGE_LANE ||
    !hasImmediateFiringLine(game, enemyCenter, playerCenter, enemy.dir)
  ) {
    return null;
  }
  return {
    axis: enemy.dir === 'up' || enemy.dir === 'down' ? 'vertical' : 'horizontal',
    center: enemyCenter,
    axialDistance,
  };
}

function hasImmediateFiringLine(game, from, to, direction) {
  const vector = VECTOR[direction];
  let x = from.x + vector.x * 9;
  let y = from.y + vector.y * 9;
  while (
    direction === 'up' ? y > to.y :
      direction === 'down' ? y < to.y :
        direction === 'left' ? x > to.x :
          x < to.x
  ) {
    if (['B', 'S', 'E'].includes(game.map[Math.floor(y / 8)]?.[Math.floor(x / 8)])) {
      return false;
    }
    x += vector.x;
    y += vector.y;
  }
  return true;
}

function scoreCloseAimEvasion(game, threats, direction) {
  let clearance = 0;
  for (const distance of [4, 8, 12, 16, 20, 24]) {
    if (!canOccupyAfterMove(game, direction, distance)) {
      break;
    }
    clearance = distance;
  }
  if (clearance < 8) {
    return Number.NEGATIVE_INFINITY;
  }

  const vector = VECTOR[direction];
  const futureCenter = {
    x: game.player.x + 8 + vector.x * clearance,
    y: game.player.y + 8 + vector.y * clearance,
  };
  const worstThreatSafety = Math.min(...threats.map((threat) => {
    const crossSeparation = threat.axis === 'vertical'
      ? Math.abs(futureCenter.x - threat.center.x)
      : Math.abs(futureCenter.y - threat.center.y);
    const futureAxialDistance = threat.axis === 'vertical'
      ? Math.abs(futureCenter.y - threat.center.y)
      : Math.abs(futureCenter.x - threat.center.x);
    const axialGain = futureAxialDistance - threat.axialDistance;
    return crossSeparation >= BULLET_DODGE_LANE
      ? 120 + Math.min(crossSeparation, 32)
      : crossSeparation * 6 + axialGain * 2;
  }));
  return worstThreatSafety + clearance;
}

function renderedBulletCenter(bullet) {
  return {
    x: Math.round(bullet.x) + 1.5,
    y: Math.round(bullet.y) + 1.5,
  };
}

function canOccupyAfterMove(game, direction, distance) {
  const vector = VECTOR[direction];
  const x = game.player.x + vector.x * distance;
  const y = game.player.y + vector.y * distance;
  if (x < 0 || y < 0 || x + 16 > FIELD || y + 16 > FIELD) {
    return false;
  }

  const dangerTile = {
    x: Math.round(x / TILE),
    y: Math.round(y / TILE),
  };
  if (isBaseDangerTile(dangerTile)) {
    return false;
  }

  const minTileX = Math.floor((x + 1) / 8);
  const maxTileX = Math.floor((x + 14) / 8);
  const minTileY = Math.floor((y + 1) / 8);
  const maxTileY = Math.floor((y + 14) / 8);
  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      if (['B', 'S', 'W', 'E'].includes(game.map[tileY]?.[tileX])) {
        return false;
      }
    }
  }

  return !game.enemies.some((enemy) => (
    enemy.alive &&
    x < enemy.x + 16 &&
    x + 16 > enemy.x &&
    y < enemy.y + 16 &&
    y + 16 > enemy.y
  ));
}

function playerHasBulletCapacity(game) {
  const activeBullets = game.bullets.filter((bullet) => (
    bullet.alive && bullet.side === 'player'
  )).length;
  const maxBullets = game.player.level >= 3 ? 2 : 1;
  return activeBullets < maxBullets && game.player.cooldown <= 0;
}

function chooseRecoveryDirection(game, frame) {
  const start = coarseTankTile(game.player);
  const choices = DIRECTIONS.filter((direction) => {
    const tile = neighbor(start, direction);
    const kind = cellKind(game, tile);
    return kind !== 'blocked' && !isBaseDangerTile(tile);
  });
  if (choices.length === 0) {
    return 'up';
  }
  return choices[(game.stage + frame) % choices.length];
}

function safePatrolDirection(game, frame) {
  const start = coarseTankTile(game.player);
  const order = [...DIRECTIONS];
  const offset = (game.stage + Math.floor(frame / 60)) % order.length;
  const rotated = [...order.slice(offset), ...order.slice(0, offset)];
  return rotated.find((direction) => {
    const tile = neighbor(start, direction);
    return cellKind(game, tile) !== 'blocked' && !isBaseDangerTile(tile);
  }) ?? null;
}

function shouldClearAhead(game, direction) {
  return cellKind(game, neighbor(coarseTankTile(game.player), direction)) === 'brick';
}

function canAdvance(game, direction) {
  const kind = cellKind(game, neighbor(coarseTankTile(game.player), direction));
  return kind === 'open' || kind === 'brick';
}

function canShootSafely(game, direction) {
  const player = game.player;
  if (shotLineCanReachBase(game, direction)) {
    return false;
  }
  if (direction === 'down' && player.y > 128 && Math.abs(player.x - 96) < 48) {
    return false;
  }
  if (direction === 'right' && player.y > 168 && player.x < 112) {
    return false;
  }
  if (direction === 'left' && player.y > 168 && player.x > 80) {
    return false;
  }
  return true;
}

function shotLineCanReachBase(game, direction) {
  const vector = VECTOR[direction];
  let x = game.player.x + 8 + vector.x * 10;
  let y = game.player.y + 8 + vector.y * 10;

  while (x >= 0 && y >= 0 && x < FIELD && y < FIELD) {
    const tile = game.map[Math.floor(y / 8)]?.[Math.floor(x / 8)];
    if (tile === 'E') {
      return true;
    }
    if (tile === 'S') {
      return false;
    }
    x += vector.x;
    y += vector.y;
  }

  return false;
}

function findPath(game, start, goals, allowBrick) {
  const validGoals = new Set(
    goals
      .filter(inBounds)
      .filter((goal) => {
        const kind = cellKind(game, goal);
        return kind === 'open' || (allowBrick && kind === 'brick');
      })
      .map(tileKey),
  );
  if (validGoals.size === 0) {
    return [];
  }

  const startKey = tileKey(start);
  const distances = new Map([[startKey, 0]]);
  const previous = new Map();
  const queue = [start];

  while (queue.length > 0) {
    queue.sort((a, b) => distances.get(tileKey(a)) - distances.get(tileKey(b)));
    const current = queue.shift();
    const currentKey = tileKey(current);
    if (validGoals.has(currentKey)) {
      return reconstructPath(current, previous);
    }

    for (const direction of DIRECTIONS) {
      const next = neighbor(current, direction);
      if (!inBounds(next) || isBaseDangerTile(next)) {
        continue;
      }
      const kind = cellKind(game, next);
      if (kind === 'blocked' || (!allowBrick && kind === 'brick')) {
        continue;
      }
      const stepCost = kind === 'brick' ? 6 : 1;
      const nextKey = tileKey(next);
      const nextDistance = distances.get(currentKey) + stepCost;
      if (!distances.has(nextKey) || nextDistance < distances.get(nextKey)) {
        distances.set(nextKey, nextDistance);
        previous.set(nextKey, current);
        queue.push(next);
      }
    }
  }

  return [];
}

function reconstructPath(end, previous) {
  const path = [end];
  let current = end;
  while (previous.has(tileKey(current))) {
    current = previous.get(tileKey(current));
    path.push(current);
  }
  return path.reverse();
}

function cellKind(game, tile) {
  if (!inBounds(tile)) {
    return 'blocked';
  }

  const blockers = [];
  for (let y = tile.y * 2; y < tile.y * 2 + 2; y += 1) {
    for (let x = tile.x * 2; x < tile.x * 2 + 2; x += 1) {
      const block = game.map[y]?.[x];
      if (['B', 'S', 'W', 'E'].includes(block)) {
        blockers.push(block);
      }
    }
  }

  if (blockers.length === 0) {
    return 'open';
  }
  if (blockers.every((block) => block === 'B')) {
    return 'brick';
  }
  return 'blocked';
}

function clearFiringLine(game, fromTile, toTile) {
  if (fromTile.x !== toTile.x && fromTile.y !== toTile.y) {
    return false;
  }
  const direction =
    fromTile.x === toTile.x
      ? toTile.y < fromTile.y ? 'up' : 'down'
      : toTile.x < fromTile.x ? 'left' : 'right';
  let cursor = neighbor(fromTile, direction);
  while (tileKey(cursor) !== tileKey(toTile)) {
    const kind = cellKind(game, cursor);
    if (kind === 'blocked') {
      return false;
    }
    cursor = neighbor(cursor, direction);
  }
  return true;
}

function clearBulletLine(game, from, to, direction) {
  const start = {
    x: Math.floor(from.x / 8),
    y: Math.floor(from.y / 8),
  };
  const end = {
    x: Math.floor(to.x / 8),
    y: Math.floor(to.y / 8),
  };
  const vector = VECTOR[direction];
  let x = start.x + vector.x;
  let y = start.y + vector.y;

  while (
    direction === 'up' ? y >= end.y :
      direction === 'down' ? y <= end.y :
        direction === 'left' ? x >= end.x :
          x <= end.x
  ) {
    const block = game.map[y]?.[x];
    if (block === 'S' || block === 'E') {
      return false;
    }
    x += vector.x;
    y += vector.y;
  }
  return true;
}

function isBaseDangerTile(tile) {
  return tile.y >= 11 && tile.x >= 5 && tile.x <= 7;
}

function directionBetween(from, to) {
  if (to.x > from.x) {
    return 'right';
  }
  if (to.x < from.x) {
    return 'left';
  }
  return to.y > from.y ? 'down' : 'up';
}

function opposite(direction) {
  if (direction === 'up') {
    return 'down';
  }
  if (direction === 'down') {
    return 'up';
  }
  if (direction === 'left') {
    return 'right';
  }
  return 'left';
}

function neighbor(tile, direction) {
  const vector = VECTOR[direction];
  return {
    x: tile.x + vector.x,
    y: tile.y + vector.y,
  };
}

function coarseTankTile(tank) {
  return {
    x: clamp(Math.round(tank.x / TILE), 0, BOARD - 1),
    y: clamp(Math.round(tank.y / TILE), 0, BOARD - 1),
  };
}

function coarsePoint(point) {
  return {
    x: clamp(Math.round(point.x / TILE), 0, BOARD - 1),
    y: clamp(Math.round(point.y / TILE), 0, BOARD - 1),
  };
}

function center(entity) {
  return {
    x: entity.x + 8,
    y: entity.y + 8,
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function uniqueTiles(tiles) {
  return [...new Map(tiles.map((tile) => [tileKey(tile), tile])).values()];
}

function tileKey(tile) {
  return `${tile.x},${tile.y}`;
}

function inBounds(tile) {
  return tile.x >= 0 && tile.y >= 0 && tile.x < BOARD && tile.y < BOARD;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
