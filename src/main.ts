import './styles.css';

type Direction = 'up' | 'right' | 'down' | 'left';
type Block = '.' | 'B' | 'S' | 'W' | 'F' | 'I' | 'E';
type Phase = 'title' | 'stageIntro' | 'playing' | 'paused' | 'won' | 'gameover';
type Side = 'player' | 'enemy';
type PowerUpType = 'grenade' | 'helmet' | 'shovel' | 'star' | 'tank' | 'timer';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Tank {
  id: number;
  side: Side;
  x: number;
  y: number;
  dir: Direction;
  speed: number;
  color: string;
  accent: string;
  cooldown: number;
  moveCarry: number;
  aiTimer: number;
  alive: boolean;
  spawnShield: number;
  bonusCarrier: boolean;
}

interface Bullet {
  side: Side;
  x: number;
  y: number;
  dir: Direction;
  speed: number;
  alive: boolean;
  ownerId: number;
}

interface Explosion {
  x: number;
  y: number;
  age: number;
  duration: number;
  size: number;
}

interface PowerUp {
  type: PowerUpType;
  x: number;
  y: number;
  age: number;
  duration: number;
}

interface TileSnapshot {
  x: number;
  y: number;
  tile: Block;
}

interface StageTuning {
  enemySpawnTiles: Array<{ x: number; y: number }>;
  initialEnemySpawnDelay: number;
  enemySpawnInterval: number;
  blockedSpawnRetryDelay: number;
  maxEnemiesOnField: number;
}

interface GameState {
  phase: Phase;
  stage: number;
  score: number;
  lives: number;
  enemyReserve: number;
  enemySpawnTimer: number;
  nextTankId: number;
  map: Block[][];
  player: Tank;
  enemies: Tank[];
  bullets: Bullet[];
  explosions: Explosion[];
  powerUps: PowerUp[];
  enemyFreezeTimer: number;
  baseArmorTimer: number;
  baseArmorSnapshot: TileSnapshot[];
  playerPowerLevel: number;
  enemiesSpawned: number;
  messageBlink: number;
  stageIntroTimer: number;
}

const canvas = getCanvas();
const ctx = getCanvasContext(canvas);

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 240;
const SCREEN_MAX_SCALE = 4;
const SCREEN_FRAME_EXTRA = 52;
const TILE = 16;
const BOARD = 13;
const BLOCK = 8;
const BLOCK_BOARD = 26;
const FIELD = TILE * BOARD;
const HUD_X = FIELD;
const BOARD_Y = 16;
const TANK = 16;
const BULLET = 3;
const ENEMIES_PER_STAGE = 20;
const POWER_UP_DURATION = 12;
const POWER_UP_TYPES: PowerUpType[] = ['grenade', 'helmet', 'shovel', 'star', 'tank', 'timer'];
const BONUS_ENEMY_SPAWN_NUMBERS = new Set([4, 11, 18]);
const POWER_UP_SPAWN_TILES = [
  { x: 1, y: 2 },
  { x: 4, y: 2 },
  { x: 8, y: 2 },
  { x: 11, y: 2 },
  { x: 2, y: 5 },
  { x: 5, y: 5 },
  { x: 7, y: 5 },
  { x: 10, y: 5 },
  { x: 1, y: 8 },
  { x: 4, y: 8 },
  { x: 8, y: 8 },
  { x: 11, y: 8 },
  { x: 2, y: 11 },
  { x: 5, y: 10 },
  { x: 7, y: 10 },
  { x: 10, y: 11 },
];
const PLAYER_RESPAWN_TILE = { x: 4, y: 12 };

updateScreenScale();
window.addEventListener('resize', updateScreenScale);

function screenScaleForViewport(viewportWidth: number, viewportHeight: number): number {
  const widthScale = (viewportWidth - SCREEN_FRAME_EXTRA) / SCREEN_WIDTH;
  const heightScale = (viewportHeight - SCREEN_FRAME_EXTRA) / SCREEN_HEIGHT;
  return Math.max(1, Math.min(SCREEN_MAX_SCALE, Math.floor(Math.min(widthScale, heightScale))));
}

function updateScreenScale(): void {
  document.documentElement?.style.setProperty(
    '--screen-scale',
    String(screenScaleForViewport(window.innerWidth, window.innerHeight)),
  );
}

const DIRS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

const STAGE_TUNING: StageTuning[] = [
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 2.4,
    enemySpawnInterval: 3.0,
    blockedSpawnRetryDelay: 0.8,
    maxEnemiesOnField: 2,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 1.8,
    enemySpawnInterval: 2.6,
    blockedSpawnRetryDelay: 0.7,
    maxEnemiesOnField: 3,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 1.5,
    enemySpawnInterval: 2.3,
    blockedSpawnRetryDelay: 0.6,
    maxEnemiesOnField: 3,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 1.3,
    enemySpawnInterval: 2.1,
    blockedSpawnRetryDelay: 0.55,
    maxEnemiesOnField: 4,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 1.1,
    enemySpawnInterval: 1.9,
    blockedSpawnRetryDelay: 0.5,
    maxEnemiesOnField: 4,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 1.0,
    enemySpawnInterval: 1.8,
    blockedSpawnRetryDelay: 0.45,
    maxEnemiesOnField: 4,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 0.8,
    enemySpawnInterval: 1.65,
    blockedSpawnRetryDelay: 0.4,
    maxEnemiesOnField: 4,
  },
  {
    enemySpawnTiles: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
    ],
    initialEnemySpawnDelay: 0.8,
    enemySpawnInterval: 1.55,
    blockedSpawnRetryDelay: 0.4,
    maxEnemiesOnField: 4,
  },
];

const INPUT_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
};

const PIXEL_FONT: Record<string, string[]> = {
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '11100'],
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
};

const LOGO_FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};

const LEVELS_13_DRAFT: string[][] = [
  [
    '.B.B...B.B.B.',
    '.B.B...B.B.B.',
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
  [
    '..B.......B..',
    '..B.......B..',
    '.............',
    '.BBB.B.B.BBB.',
    '.....B.B.....',
    'BB...B.B...BB',
    '.....B.B.....',
    '.BBB.....BBB.',
    '.....BBB.....',
    '.B.B.....B.B.',
    '.B.BB...BB.B.',
    '.....BBB.....',
    '.....BEB.....',
  ],
  [
    '..B..B.B..B..',
    '..B..B.B..B..',
    '.....B.B.....',
    '.BBB.....BBB.',
    '...B.B.B.B...',
    '...B.B.B.B...',
    '.B...B.B...B.',
    '.B.B.....B.B.',
    '...B.BBB.B...',
    '.B.B.....B.B.',
    '.B.BB...BB...',
    '.....BBB.....',
    '.....BE......',
  ],
  [
    '..B..S.S..B..',
    '..B..B.B..B..',
    '.....B.B.....',
    '.BB.S...S.BB.',
    '...B.B.B.B...',
    'S..B.....B..S',
    '...B.B.B.B...',
    '.BB...B...BB.',
    '.....BBB.....',
    '.B.S.....S.B.',
    '.B.BB...BB.B.',
    '.....BBB.....',
    '.....BEB.....',
  ],
  [
    '..B..S.S..B..',
    '.....B.B.....',
    '..B.......B..',
    '.BB.WW.WW.BB.',
    '...B.B.B.B...',
    'S....B.B....S',
    '...B.....B...',
    '.BB..WWW..BB.',
    '.....BBB.....',
    '.B.S.....S.B.',
    '.B.BB...BB.B.',
    '.....BBB.....',
    '.....BE......',
  ],
  [
    '..B..S.S..B..',
    '..F..B.B..F..',
    '.....F.F.....',
    '.BB.WW.WW.BB.',
    'FF.B.B.B.B.FF',
    'B....B.B....B',
    '...B..F..B...',
    '.BB..WWW..BB.',
    '..F..BBB..F..',
    '.B.S.....S.B.',
    '.B.BB...BB.B.',
    '.....B.B.....',
    '.....BE......',
  ],
  [
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
    '.....B.B.....',
    '.....BE......',
  ],
  [
    '..B..S.S..B..',
    'F.F..B.B..F.F',
    '.....F.F.....',
    '.BS.WW.WW.SB.',
    'FF.B.I.I.B.FF',
    'B....B.B....B',
    '..WB..I..BW..',
    '.BB..WWW..BB.',
    '..F..B.B..F..',
    '.B.S.....S.B.',
    '.B.B..S.B....',
    '.....B.B.....',
    '.....BE......',
  ],
];

const keys = new Set<string>();
let game = createGame(1);
let lastFrame = performance.now();

ctx.imageSmoothingEnabled = false;

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'Space'].includes(event.code)) {
    event.preventDefault();
  }

  if (!keys.has(event.code)) {
    if (game.phase === 'title') {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        selectTitleStage(-1);
      }
      if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        selectTitleStage(1);
      }
      if (/^Digit[1-8]$/.test(event.code)) {
        selectAbsoluteTitleStage(Number(event.code.slice(5)));
      }
    }
    if (event.code === 'Enter') {
      handleStartPause();
    }
    if (event.code === 'KeyR') {
      game = createGame(1);
      startStageIntro();
    }
  }

  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.code);
});

requestAnimationFrame(loop);

function getCanvas(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>('#game');
  if (!element) {
    throw new Error('Missing canvas element');
  }
  return element;
}

function getCanvasContext(element: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = element.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  return context;
}

function createGame(stage: number): GameState {
  const map = parseLevel(LEVELS_13_DRAFT[(stage - 1) % LEVELS_13_DRAFT.length]);
  const tuning = getStageTuning(stage);
  const player = createTank('player', 4, 12, 'up', '#ffd84a', '#fff2a3');

  return {
    phase: 'title',
    stage,
    score: 0,
    lives: 3,
    enemyReserve: ENEMIES_PER_STAGE,
    enemySpawnTimer: tuning.initialEnemySpawnDelay,
    nextTankId: 2,
    map,
    player,
    enemies: [],
    bullets: [],
    explosions: [],
    powerUps: [],
    enemyFreezeTimer: 0,
    baseArmorTimer: 0,
    baseArmorSnapshot: [],
    playerPowerLevel: 1,
    enemiesSpawned: 0,
    messageBlink: 0,
    stageIntroTimer: 0,
  };
}

function getStageTuning(stage: number): StageTuning {
  return STAGE_TUNING[(stage - 1) % STAGE_TUNING.length];
}

function selectTitleStage(delta: number): void {
  if (game.phase !== 'title') {
    return;
  }

  selectAbsoluteTitleStage(game.stage + delta);
}

function selectAbsoluteTitleStage(stage: number): void {
  if (game.phase !== 'title') {
    return;
  }

  game = createGame(clamp(Math.round(stage), 1, LEVELS_13_DRAFT.length));
}

function parseLevel(rows: string[]): Block[][] {
  if (rows.length !== BOARD) {
    throw new Error(`Invalid level height: ${rows.length}`);
  }

  const coarse = rows.map((row) => {
    if (row.length !== BOARD) {
      throw new Error(`Invalid level row width: ${row}`);
    }
    return [...row].map((char) => {
      if (!'.BSWFIE'.includes(char)) {
        throw new Error(`Invalid tile: ${char}`);
      }
      return char as Block;
    });
  });

  return expandCoarseLevel(coarse);
}

function expandCoarseLevel(rows: Block[][]): Block[][] {
  const blocks: Block[][] = [];
  for (const row of rows) {
    const top: Block[] = [];
    const bottom: Block[] = [];
    for (const block of row) {
      top.push(block, block);
      bottom.push(block, block);
    }
    blocks.push(top, bottom);
  }

  if (blocks.length !== BLOCK_BOARD || blocks.some((row) => row.length !== BLOCK_BOARD)) {
    throw new Error('Expanded level must be 26x26');
  }

  return blocks;
}

function createTank(
  side: Side,
  tileX: number,
  tileY: number,
  dir: Direction,
  color: string,
  accent: string,
): Tank {
  const offset = (TILE - TANK) / 2;
  return {
    id: side === 'player' ? 1 : Math.floor(Math.random() * 1000000),
    side,
    x: tileX * TILE + offset,
    y: tileY * TILE + offset,
    dir,
    speed: side === 'player' ? 56 : 34,
    color,
    accent,
    cooldown: 0.12,
    moveCarry: 0,
    aiTimer: 0,
    alive: true,
    spawnShield: side === 'player' ? 1.6 : 0.8,
    bonusCarrier: false,
  };
}

function handleStartPause(): void {
  if (game.phase === 'title') {
    startStageIntro();
    return;
  }
  if (game.phase === 'playing') {
    game.phase = 'paused';
    return;
  }
  if (game.phase === 'paused') {
    game.phase = 'playing';
    return;
  }
  if (game.phase === 'won') {
    const next = createGame(game.stage + 1);
    next.score = game.score;
    next.lives = game.lives;
    game = next;
    startStageIntro();
    return;
  }
  if (game.phase === 'gameover') {
    game = createGame(1);
    startStageIntro();
  }
}

function startStageIntro(): void {
  game.phase = 'stageIntro';
  game.stageIntroTimer = 1.6;
}

function loop(time: number): void {
  const dt = Math.min((time - lastFrame) / 1000, 0.035);
  lastFrame = time;

  if (game.phase === 'playing') {
    update(dt);
  } else if (game.phase === 'stageIntro') {
    game.stageIntroTimer -= dt;
    if (game.stageIntroTimer <= 0) {
      game.phase = 'playing';
    }
  } else {
    game.messageBlink += dt;
    updateExplosions(dt);
  }

  draw();
  requestAnimationFrame(loop);
}

function update(dt: number): void {
  game.messageBlink += dt;
  updatePowerUps(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateExplosions(dt);
  spawnEnemies(dt);
  checkWin();
}

function updatePlayer(dt: number): void {
  if (!game.player.alive) {
    return;
  }

  game.player.cooldown = Math.max(0, game.player.cooldown - dt);
  game.player.spawnShield = Math.max(0, game.player.spawnShield - dt);

  const nextDirection = getInputDirection();
  if (nextDirection) {
    moveTank(game.player, nextDirection, dt);
  }

  if (keys.has('Space')) {
    tryShoot(game.player);
  }
}

function getInputDirection(): Direction | null {
  const order = ['ArrowUp', 'KeyW', 'ArrowRight', 'KeyD', 'ArrowDown', 'KeyS', 'ArrowLeft', 'KeyA'];
  const code = order.find((key) => keys.has(key));
  return code ? INPUT_DIRECTIONS[code] : null;
}

function updateEnemies(dt: number): void {
  if (game.enemyFreezeTimer > 0) {
    return;
  }

  for (const enemy of game.enemies) {
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.spawnShield = Math.max(0, enemy.spawnShield - dt);
    enemy.aiTimer -= dt;

    if (enemy.aiTimer <= 0) {
      enemy.dir = pickEnemyDirection(enemy);
      enemy.aiTimer = 0.35 + Math.random() * 0.9;
    }

    const moved = moveTank(enemy, enemy.dir, dt);
    if (!moved && !canTankMoveOneStep(enemy, enemy.dir)) {
      enemy.dir = pickEnemyDirection(enemy, true);
      enemy.aiTimer = 0.12;
    }

    if (enemy.cooldown <= 0 && Math.random() < dt * 1.8) {
      tryShoot(enemy);
    }
  }
}

function pickEnemyDirection(enemy: Tank, forceDifferent = false): Direction {
  const candidates: Direction[] = ['up', 'right', 'down', 'left'];
  const movable = candidates.filter((direction) => {
    if (forceDifferent && direction === enemy.dir) {
      return false;
    }
    return canTankMoveOneStep(enemy, direction);
  });
  const fallback = forceDifferent ? candidates.filter((direction) => canTankMoveOneStep(enemy, direction)) : [];
  const choices = movable.length > 0 ? movable : fallback;

  if (choices.length === 0) {
    return enemy.dir;
  }

  if (!forceDifferent && choices.includes(enemy.dir) && Math.random() < 0.82) {
    return enemy.dir;
  }

  const forwardChoices = choices.filter((choice) => choice !== OPPOSITE[enemy.dir]);
  const turnChoices = forwardChoices.length > 0 ? forwardChoices : choices;
  const weighted = [...turnChoices];
  const verticalChase = enemy.y > game.player.y ? 'up' : 'down';
  const horizontalChase = enemy.x > game.player.x ? 'left' : 'right';
  if (Math.abs(enemy.x - game.player.x) < TILE * 1.2 && turnChoices.includes(verticalChase)) {
    weighted.push(verticalChase);
  }
  if (Math.abs(enemy.y - game.player.y) < TILE * 1.2 && turnChoices.includes(horizontalChase)) {
    weighted.push(horizontalChase);
  }
  if (turnChoices.includes('down')) {
    weighted.push('down');
  }

  return weighted[Math.floor(Math.random() * weighted.length)];
}

function canTankMoveOneStep(tank: Tank, dir: Direction): boolean {
  const probe = { ...tank, dir };
  snapToLane(probe, dir);

  const vector = DIRS[dir];
  const nextRect = tankRect(probe);
  nextRect.x += vector.x;
  nextRect.y += vector.y;

  return canTankOccupy(nextRect, tank);
}

function moveTank(tank: Tank, dir: Direction, dt: number): boolean {
  if (tank.dir !== dir) {
    tank.moveCarry = 0;
  }
  tank.dir = dir;
  snapToLane(tank, dir);

  const vector = DIRS[dir];
  const speedBoost = tank.side === 'player' && isTankOnIce(tank) ? 1.22 : 1;
  tank.moveCarry += tank.speed * speedBoost * dt;
  const steps = Math.floor(tank.moveCarry);
  tank.moveCarry -= steps;

  let moved = false;
  for (let step = 0; step < steps; step += 1) {
    const nextRect = tankRect(tank);
    nextRect.x += vector.x;
    nextRect.y += vector.y;

    if (!canTankOccupy(nextRect, tank)) {
      tank.moveCarry = 0;
      return moved;
    }

    tank.x = nextRect.x;
    tank.y = nextRect.y;
    moved = true;
  }

  return moved;
}

function snapToLane(tank: Tank, dir: Direction): void {
  const centerX = tank.x + TANK / 2;
  const centerY = tank.y + TANK / 2;

  if (dir === 'up' || dir === 'down') {
    const lane = Math.round((centerX - TILE / 2) / TILE) * TILE + TILE / 2;
    if (Math.abs(lane - centerX) <= 4) {
      tank.x = lane - TANK / 2;
    }
  } else {
    const lane = Math.round((centerY - TILE / 2) / TILE) * TILE + TILE / 2;
    if (Math.abs(lane - centerY) <= 4) {
      tank.y = lane - TANK / 2;
    }
  }
}

function canTankOccupy(rect: Rect, tank: Tank): boolean {
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > FIELD || rect.y + rect.h > FIELD) {
    return false;
  }

  for (const { x, y } of blockRange(rect)) {
    const tile = game.map[y]?.[x];
    if (tile === 'B' || tile === 'S' || tile === 'W' || tile === 'E') {
      return false;
    }
  }

  const tanks = [game.player, ...game.enemies];
  return !tanks.some((other) => other !== tank && other.alive && intersects(rect, tankRect(other)));
}

function isTankOnIce(tank: Tank): boolean {
  const centerX = Math.floor((tank.x + TANK / 2) / BLOCK);
  const centerY = Math.floor((tank.y + TANK / 2) / BLOCK);
  return game.map[centerY]?.[centerX] === 'I';
}

function tryShoot(tank: Tank): void {
  if (!tank.alive || tank.cooldown > 0) {
    return;
  }

  if (tank.side === 'player' && game.bullets.some((bullet) => bullet.side === 'player' && bullet.alive)) {
    return;
  }

  const vector = DIRS[tank.dir];
  const muzzle = {
    x: tank.x + TANK / 2 + vector.x * (TANK / 2 + 2) - BULLET / 2,
    y: tank.y + TANK / 2 + vector.y * (TANK / 2 + 2) - BULLET / 2,
  };

  game.bullets.push({
    side: tank.side,
    x: muzzle.x,
    y: muzzle.y,
    dir: tank.dir,
    speed: tank.side === 'player' ? (game.playerPowerLevel >= 2 ? 170 : 148) : 120,
    alive: true,
    ownerId: tank.id,
  });

  tank.cooldown = tank.side === 'player' ? (game.playerPowerLevel >= 2 ? 0.26 : 0.34) : 0.85 + Math.random() * 0.55;
}

function updateBullets(dt: number): void {
  for (const bullet of game.bullets) {
    if (!bullet.alive) {
      continue;
    }

    const vector = DIRS[bullet.dir];
    let remaining = bullet.speed * dt;

    if (resolveBulletCollision(bullet)) {
      continue;
    }

    while (bullet.alive && remaining > 0) {
      const step = Math.min(1, remaining);
      bullet.x += vector.x * step;
      bullet.y += vector.y * step;
      remaining -= step;

      if (bullet.x < -BULLET || bullet.y < -BULLET || bullet.x > FIELD || bullet.y > FIELD) {
        bullet.alive = false;
        break;
      }

      if (resolveBulletCollision(bullet)) {
        break;
      }
    }
  }

  game.bullets = game.bullets.filter((bullet) => bullet.alive);
}

function resolveBulletCollision(bullet: Bullet): boolean {
  if (hitTile(bullet)) {
    return true;
  }

  hitBullet(bullet);
  if (!bullet.alive) {
    return true;
  }

  hitTank(bullet);
  return !bullet.alive;
}

function hitTile(bullet: Bullet): boolean {
  const rect = bulletRect(bullet);
  for (const { x, y } of directionalBlockRange(rect, bullet.dir)) {
    const tile = game.map[y]?.[x];
    if (!tile || tile === '.' || tile === 'F' || tile === 'I' || tile === 'W') {
      continue;
    }

    bullet.alive = false;
    addExplosion(rect.x + rect.w / 2, rect.y + rect.h / 2, 8);

    if (tile === 'B') {
      damageBrickLine(x, y, bullet.dir);
    }
    if (tile === 'E') {
      destroyBase(x, y);
      game.phase = 'gameover';
      addExplosion(Math.floor(x / 2) * TILE + TILE / 2, Math.floor(y / 2) * TILE + TILE / 2, 24);
    }

    return true;
  }
  return false;
}

function directionalBlockRange(rect: Rect, dir: Direction): Array<{ x: number; y: number }> {
  return blockRange(rect).sort((a, b) => {
    if (dir === 'right') {
      return b.x - a.x || a.y - b.y;
    }
    if (dir === 'left') {
      return a.x - b.x || a.y - b.y;
    }
    if (dir === 'down') {
      return b.y - a.y || a.x - b.x;
    }
    return a.y - b.y || a.x - b.x;
  });
}

function damageBrickLine(x: number, y: number, bulletDir: Direction): void {
  const coarseX = Math.floor(x / 2) * 2;
  const coarseY = Math.floor(y / 2) * 2;

  if (bulletDir === 'up' || bulletDir === 'down') {
    clearBrick(coarseX, y);
    clearBrick(coarseX + 1, y);
    return;
  }

  clearBrick(x, coarseY);
  clearBrick(x, coarseY + 1);
}

function clearBrick(x: number, y: number): void {
  if (game.map[y]?.[x] === 'B') {
    game.map[y][x] = '.';
  }
}

function destroyBase(x: number, y: number): void {
  const baseX = Math.floor(x / 2) * 2;
  const baseY = Math.floor(y / 2) * 2;
  for (let clearY = baseY; clearY < baseY + 2; clearY += 1) {
    for (let clearX = baseX; clearX < baseX + 2; clearX += 1) {
      if (game.map[clearY]?.[clearX] === 'E') {
        game.map[clearY][clearX] = '.';
      }
    }
  }
}

function hitBullet(bullet: Bullet): void {
  for (const other of game.bullets) {
    if (other === bullet || !other.alive || other.side === bullet.side) {
      continue;
    }
    if (intersects(bulletRect(bullet), bulletRect(other))) {
      bullet.alive = false;
      other.alive = false;
      addExplosion(bullet.x + BULLET / 2, bullet.y + BULLET / 2, 14);
      return;
    }
  }
}

function hitTank(bullet: Bullet): void {
  const targets = bullet.side === 'player' ? game.enemies : [game.player];
  for (const tank of targets) {
    if (!tank.alive || tank.spawnShield > 0 || tank.id === bullet.ownerId) {
      continue;
    }
    if (!intersects(bulletRect(bullet), tankRect(tank))) {
      continue;
    }

    bullet.alive = false;
    tank.alive = false;
    addExplosion(tank.x + TANK / 2, tank.y + TANK / 2, 20);

    if (tank.side === 'enemy') {
      if (tank.bonusCarrier) {
        spawnPowerUpAtRandomLocation();
      }
      game.score += 100;
      game.enemies = game.enemies.filter((enemy) => enemy.alive);
    } else {
      game.lives -= 1;
      if (game.lives <= 0) {
        game.phase = 'gameover';
      } else {
        window.setTimeout(() => {
          if (game.phase === 'playing') {
            respawnPlayer();
          }
        }, 900);
      }
    }
    return;
  }
}

function respawnPlayer(): void {
  game.player.alive = false;
  const nextPlayer = createTank(
    'player',
    PLAYER_RESPAWN_TILE.x,
    PLAYER_RESPAWN_TILE.y,
    'up',
    '#ffd84a',
    '#fff2a3',
  );
  clearEnemiesFromPlayerRespawn(nextPlayer);
  game.player = nextPlayer;
}

function clearEnemiesFromPlayerRespawn(player: Tank): void {
  const respawnRect = tankRect(player);
  const survivors: Tank[] = [];

  for (const enemy of game.enemies) {
    if (enemy.alive && intersects(respawnRect, tankRect(enemy))) {
      enemy.alive = false;
      addExplosion(enemy.x + TANK / 2, enemy.y + TANK / 2, 20);
    } else {
      survivors.push(enemy);
    }
  }

  game.enemies = survivors;
}

function updateExplosions(dt: number): void {
  for (const explosion of game.explosions) {
    explosion.age += dt;
  }
  game.explosions = game.explosions.filter((explosion) => explosion.age < explosion.duration);
}

function updatePowerUps(dt: number): void {
  game.enemyFreezeTimer = Math.max(0, game.enemyFreezeTimer - dt);
  if (game.baseArmorTimer > 0) {
    game.baseArmorTimer = Math.max(0, game.baseArmorTimer - dt);
    if (game.baseArmorTimer === 0) {
      restoreBaseArmor();
    }
  }

  for (const powerUp of game.powerUps) {
    powerUp.age += dt;
    if (game.player.alive && intersects(powerUpRect(powerUp), tankRect(game.player))) {
      applyPowerUp(powerUp);
      powerUp.age = powerUp.duration;
    }
  }

  game.powerUps = game.powerUps.filter((powerUp) => powerUp.age < powerUp.duration);
}

function spawnPowerUp(x: number, y: number, type = randomPowerUpType()): void {
  game.powerUps = [
    {
      type,
      x: clamp(Math.round(x), 0, FIELD - TILE),
      y: clamp(Math.round(y), 0, FIELD - TILE),
      age: 0,
      duration: POWER_UP_DURATION,
    },
  ];
}

function spawnPowerUpAtRandomLocation(type = randomPowerUpType()): void {
  const spawn = POWER_UP_SPAWN_TILES[Math.floor(Math.random() * POWER_UP_SPAWN_TILES.length)];
  spawnPowerUp(spawn.x * TILE, spawn.y * TILE, type);
}

function randomPowerUpType(): PowerUpType {
  return POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
}

function applyPowerUp(powerUp: PowerUp): void {
  if (powerUp.type === 'grenade') {
    clearEnemiesWithGrenade();
  } else if (powerUp.type === 'helmet') {
    game.player.spawnShield = Math.max(game.player.spawnShield, 8);
  } else if (powerUp.type === 'shovel') {
    armorBase(12);
  } else if (powerUp.type === 'star') {
    game.playerPowerLevel = Math.min(3, game.playerPowerLevel + 1);
  } else if (powerUp.type === 'tank') {
    game.lives += 1;
  } else if (powerUp.type === 'timer') {
    game.enemyFreezeTimer = Math.max(game.enemyFreezeTimer, 6);
  }
}

function clearEnemiesWithGrenade(): void {
  for (const enemy of game.enemies) {
    addExplosion(enemy.x + TANK / 2, enemy.y + TANK / 2, 20);
  }
  game.score += game.enemies.length * 100;
  game.enemies = [];
}

function armorBase(duration: number): void {
  if (game.baseArmorSnapshot.length === 0) {
    game.baseArmorSnapshot = baseArmorTiles()
      .map(({ x, y }) => ({ x, y, tile: game.map[y]?.[x] }))
      .filter((snapshot): snapshot is TileSnapshot => snapshot.tile === 'B' || snapshot.tile === 'S');
  }

  for (const { x, y } of game.baseArmorSnapshot) {
    if (game.map[y]?.[x] === 'B') {
      game.map[y][x] = 'S';
    }
  }
  game.baseArmorTimer = Math.max(game.baseArmorTimer, duration);
}

function restoreBaseArmor(): void {
  for (const snapshot of game.baseArmorSnapshot) {
    if (game.map[snapshot.y]?.[snapshot.x] === 'S') {
      game.map[snapshot.y][snapshot.x] = snapshot.tile;
    }
  }
  game.baseArmorSnapshot = [];
  game.baseArmorTimer = 0;
}

function baseArmorTiles(): Array<{ x: number; y: number }> {
  const baseCells = findTiles('E');
  if (baseCells.length === 0) {
    return [];
  }
  const minX = Math.min(...baseCells.map((cell) => cell.x));
  const minY = Math.min(...baseCells.map((cell) => cell.y));
  const tiles: Array<{ x: number; y: number }> = [];

  for (let x = minX - 2; x <= minX + 3; x += 1) {
    tiles.push({ x, y: minY - 2 }, { x, y: minY - 1 });
  }
  for (let y = minY; y <= minY + 1; y += 1) {
    tiles.push({ x: minX - 2, y }, { x: minX - 1, y }, { x: minX + 2, y }, { x: minX + 3, y });
  }

  return tiles.filter(({ x, y }) => x >= 0 && y >= 0 && x < BLOCK_BOARD && y < BLOCK_BOARD);
}

function findTiles(tile: Block): Array<{ x: number; y: number }> {
  const tiles: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < game.map.length; y += 1) {
    for (let x = 0; x < game.map[y].length; x += 1) {
      if (game.map[y][x] === tile) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

function spawnEnemies(dt: number): void {
  const tuning = getStageTuning(game.stage);
  game.enemySpawnTimer -= dt;
  if (
    game.enemySpawnTimer > 0 ||
    game.enemyReserve <= 0 ||
    game.enemies.length >= tuning.maxEnemiesOnField
  ) {
    return;
  }

  const spawn = tuning.enemySpawnTiles[Math.floor(Math.random() * tuning.enemySpawnTiles.length)];
  const enemy = createTank('enemy', spawn.x, spawn.y, 'down', '#8fa8a2', '#d04f3f');
  enemy.id = game.nextTankId;
  game.nextTankId += 1;
  game.enemiesSpawned += 1;
  enemy.bonusCarrier = BONUS_ENEMY_SPAWN_NUMBERS.has(game.enemiesSpawned);

  if (!canTankOccupy(tankRect(enemy), enemy)) {
    game.enemySpawnTimer = tuning.blockedSpawnRetryDelay;
    return;
  }

  game.enemies.push(enemy);
  game.enemyReserve -= 1;
  game.enemySpawnTimer = tuning.enemySpawnInterval;
  addExplosion(enemy.x + TANK / 2, enemy.y + TANK / 2, 14);
}

function checkWin(): void {
  if (game.enemyReserve === 0 && game.enemies.length === 0 && game.phase === 'playing') {
    game.phase = 'won';
  }
}

function tankRect(tank: Tank): Rect {
  return { x: tank.x, y: tank.y, w: TANK, h: TANK };
}

function bulletRect(bullet: Bullet): Rect {
  return { x: bullet.x, y: bullet.y, w: BULLET, h: BULLET };
}

function powerUpRect(powerUp: PowerUp): Rect {
  return { x: powerUp.x, y: powerUp.y, w: TILE, h: TILE };
}

function blockRange(rect: Rect): Array<{ x: number; y: number }> {
  const minX = clamp(Math.floor(rect.x / BLOCK), 0, BLOCK_BOARD - 1);
  const maxX = clamp(Math.floor((rect.x + rect.w - 1) / BLOCK), 0, BLOCK_BOARD - 1);
  const minY = clamp(Math.floor(rect.y / BLOCK), 0, BLOCK_BOARD - 1);
  const maxY = clamp(Math.floor((rect.y + rect.h - 1) / BLOCK), 0, BLOCK_BOARD - 1);
  const tiles: Array<{ x: number; y: number }> = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      tiles.push({ x, y });
    }
  }

  return tiles;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function addExplosion(x: number, y: number, size: number): void {
  game.explosions.push({ x, y, age: 0, duration: 0.36, size });
}

function drawTitleScreen(): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const highScoreLabel = 'HI-34100';
  pixelText(highScoreLabel, centeredScreenTextX(highScoreLabel, 1), 27, 1, '#fff');
  drawBrickLogoText('BATTLE', centeredLogoTextX('BATTLE', 5), 54, 5);
  drawBrickLogoText('CITY', centeredLogoTextX('CITY', 5), 102, 5);

  const menuIconWidth = 16;
  const menuGap = 7;
  const menuTextX = centeredMenuGroupX('2 PLAYERS', menuIconWidth, menuGap) + menuIconWidth + menuGap;
  drawTitleTankIcon(menuTextX - menuGap - menuIconWidth, 149);
  pixelText('1 PLAYER', menuTextX, 153, 1, '#fff');
  pixelText('2 PLAYERS', menuTextX, 166, 1, '#fff');
  pixelText(`STAGE ${String(game.stage).padStart(2, '0')}`, centeredScreenTextX('STAGE 01', 1), 184, 1, '#f7d451');
  pixelText('(C) 1980 1985 NAMCO LTD.', centeredScreenTextX('(C) 1980 1985 NAMCO LTD.', 1), 209, 1, '#fff');
  pixelText('ALL RIGHTS RESERVED', centeredScreenTextX('ALL RIGHTS RESERVED', 1), 224, 1, '#fff');
}

function centeredScreenTextX(text: string, scale: number): number {
  return Math.round((canvas.width - pixelTextWidth(text, scale)) / 2);
}

function centeredLogoTextX(text: string, cellSize: number): number {
  return Math.round((canvas.width - logoTextWidth(text, cellSize)) / 2);
}

function centeredMenuGroupX(widestText: string, iconWidth: number, gap: number): number {
  return Math.round((canvas.width - (iconWidth + gap + pixelTextWidth(widestText, 1))) / 2);
}

function drawBrickLogoText(text: string, x: number, y: number, cellSize: number): void {
  let cursorX = x;
  for (const char of text) {
    const glyph = LOGO_FONT[char];
    if (!glyph) {
      cursorX += 6 * cellSize;
      continue;
    }
    drawBrickLogoGlyph(glyph, cursorX, y, cellSize);
    cursorX += 6 * cellSize;
  }
}

function logoTextWidth(text: string, cellSize: number): number {
  return Math.max(0, text.length * 6 * cellSize - cellSize);
}

function drawBrickLogoGlyph(glyph: string[], x: number, y: number, cellSize: number): void {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] === '1') {
        drawLogoBrickCell(x + col * cellSize, y + row * cellSize, cellSize);
      }
    }
  }
}

function drawLogoBrickCell(x: number, y: number, size: number): void {
  ctx.fillStyle = '#d85028';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, 1, size);
  ctx.fillRect(x, y, size, 1);
  ctx.fillStyle = '#902818';
  ctx.fillRect(x, y + size - 1, size, 1);
  ctx.fillRect(x + size - 1, y, 1, size);
  ctx.fillRect(x + Math.floor(size / 2), y, 1, size);
}

function draw(): void {
  if (game.phase === 'title') {
    drawTitleScreen();
    return;
  }

  if (game.phase === 'stageIntro') {
    drawStageIntro();
    return;
  }

  ctx.fillStyle = '#747474';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawBattlefield();
  drawHud();
  drawOverlayMessage();
}

function drawStageIntro(): void {
  ctx.fillStyle = '#747474';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const label = `STAGE ${String(game.stage).padStart(2, '0')}`;
  pixelText(label, centeredScreenTextX(label, 2), 108, 2, '#000');
}

function drawBattlefield(): void {
  ctx.save();
  ctx.translate(0, BOARD_Y);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FIELD, FIELD);
  ctx.beginPath();
  ctx.rect(0, 0, FIELD, FIELD);
  ctx.clip();

  drawTiles(false);
  drawGridEdge();
  drawBullets();
  drawPowerUps();
  drawTanks();
  drawExplosions();
  drawTiles(true);

  ctx.restore();
}

function drawTiles(forestPass: boolean): void {
  const waterShift = Math.floor(game.messageBlink * 4) % 2;
  for (let y = 0; y < BLOCK_BOARD; y += 1) {
    for (let x = 0; x < BLOCK_BOARD; x += 1) {
      const tile = game.map[y][x];
      if ((tile === 'F') !== forestPass) {
        continue;
      }

      const px = x * BLOCK;
      const py = y * BLOCK;
      if (tile === 'B') {
        drawBrick(px, py);
      } else if (tile === 'S') {
        drawSteel(px, py);
      } else if (tile === 'W') {
        drawWater(px, py, waterShift);
      } else if (tile === 'F') {
        drawForest(px, py);
      } else if (tile === 'I') {
        drawIce(px, py);
      } else if (tile === 'E' && x % 2 === 0 && y % 2 === 0) {
        drawBase(px, py);
      }
    }
  }
}

function drawBrick(x: number, y: number): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, BLOCK, BLOCK);

  const patternX = Math.floor(x / TILE) * TILE;
  const patternY = Math.floor(y / TILE) * TILE;
  drawClippedBrickRect(x, y, patternX, patternY, 0, 0, 7, 3, '#d85028');
  drawClippedBrickRect(x, y, patternX, patternY, 8, 0, 7, 3, '#d85028');
  drawClippedBrickRect(x, y, patternX, patternY, 1, 4, 14, 3, '#d85028');
  drawClippedBrickRect(x, y, patternX, patternY, 0, 8, 7, 3, '#d85028');
  drawClippedBrickRect(x, y, patternX, patternY, 8, 8, 7, 3, '#d85028');
  drawClippedBrickRect(x, y, patternX, patternY, 1, 12, 14, 3, '#d85028');

  drawClippedBrickRect(x, y, patternX, patternY, 0, 3, 16, 1, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 0, 7, 16, 1, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 0, 11, 16, 1, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 0, 15, 16, 1, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 7, 0, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 15, 0, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 0, 4, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 15, 4, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 7, 8, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 15, 8, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 0, 12, 1, 3, '#902818');
  drawClippedBrickRect(x, y, patternX, patternY, 15, 12, 1, 3, '#902818');
}

function drawClippedBrickRect(
  cellX: number,
  cellY: number,
  patternX: number,
  patternY: number,
  localX: number,
  localY: number,
  width: number,
  height: number,
  color: string,
): void {
  const rectX = patternX + localX;
  const rectY = patternY + localY;
  const drawX = Math.max(cellX, rectX);
  const drawY = Math.max(cellY, rectY);
  const drawRight = Math.min(cellX + BLOCK, rectX + width);
  const drawBottom = Math.min(cellY + BLOCK, rectY + height);

  if (drawRight <= drawX || drawBottom <= drawY) {
    return;
  }

  ctx.fillStyle = color;
  ctx.fillRect(drawX, drawY, drawRight - drawX, drawBottom - drawY);
}

function drawSteel(x: number, y: number): void {
  ctx.fillStyle = '#bcbcbc';
  ctx.fillRect(x, y, BLOCK, BLOCK);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, 3, 3);
  ctx.fillRect(x + 4, y, 3, 3);
  ctx.fillRect(x, y + 4, 3, 3);
  ctx.fillRect(x + 4, y + 4, 3, 3);
  ctx.fillStyle = '#686868';
  ctx.fillRect(x + 3, y, 1, 8);
  ctx.fillRect(x + 7, y, 1, 8);
  ctx.fillRect(x, y + 3, 8, 1);
  ctx.fillRect(x, y + 7, 8, 1);
}

function drawWater(x: number, y: number, shift: number): void {
  ctx.fillStyle = '#2858a8';
  ctx.fillRect(x, y, BLOCK, BLOCK);
  ctx.fillStyle = '#74d8e8';
  for (let row = 0; row < 2; row += 1) {
    ctx.fillRect(x + ((row + shift) % 2) * 2, y + 2 + row * 4, 5, 1);
  }
}

function drawForest(x: number, y: number): void {
  ctx.fillStyle = '#30a038';
  ctx.fillRect(x, y, BLOCK, BLOCK);
  ctx.fillStyle = '#80e060';
  for (let i = 0; i < 5; i += 1) {
    const px = x + ((i * 3) % 7);
    const py = y + ((i * 5) % 7);
    ctx.fillRect(px, py, 2, 2);
  }
}

function drawIce(x: number, y: number): void {
  ctx.fillStyle = '#c8f0f0';
  ctx.fillRect(x, y, BLOCK, BLOCK);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y + 2, 5, 1);
  ctx.fillRect(x + 3, y + 5, 4, 1);
  ctx.fillStyle = '#78a8b8';
  ctx.fillRect(x, y, 1, 8);
  ctx.fillRect(x + 7, y, 1, 8);
}

function drawBase(x: number, y: number): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#8c7a28';
  ctx.fillRect(x + 1, y + 4, 3, 5);
  ctx.fillRect(x + 12, y + 4, 3, 5);
  ctx.fillRect(x + 2, y + 9, 3, 2);
  ctx.fillRect(x + 11, y + 9, 3, 2);
  ctx.fillStyle = '#d8c050';
  ctx.fillRect(x + 5, y + 2, 6, 9);
  ctx.fillRect(x + 4, y + 5, 8, 4);
  ctx.fillRect(x + 2, y + 6, 3, 3);
  ctx.fillRect(x + 11, y + 6, 3, 3);
  ctx.fillStyle = '#f4e07a';
  ctx.fillRect(x + 6, y + 3, 4, 5);
  ctx.fillRect(x + 5, y + 9, 6, 2);
  ctx.fillStyle = '#303030';
  ctx.fillRect(x + 5, y + 12, 2, 3);
  ctx.fillRect(x + 9, y + 12, 2, 3);
  ctx.fillRect(x + 7, y + 10, 2, 2);
}

function drawTanks(): void {
  if (game.player.alive) {
    drawTank(game.player);
  }
  for (const enemy of game.enemies) {
    drawTank(enemy);
  }
}

function drawTank(tank: Tank): void {
  const x = Math.round(tank.x);
  const y = Math.round(tank.y);

  if (tank.spawnShield > 0 && Math.floor(tank.spawnShield * 12) % 2 === 0) {
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TANK - 1, TANK - 1);
  }

  ctx.fillStyle = tank.bonusCarrier && Math.floor(game.messageBlink * 8) % 2 === 0 ? '#f7d451' : tank.color;

  if (tank.dir === 'up' || tank.dir === 'down') {
    ctx.fillRect(x, y + 1, 4, 14);
    ctx.fillRect(x + 12, y + 1, 4, 14);
    ctx.fillStyle = tank.accent;
    ctx.fillRect(x + 5, y + 4, 6, 8);
    ctx.fillRect(x + 7, tank.dir === 'up' ? y : y + 8, 2, 8);
  } else {
    ctx.fillRect(x + 1, y, 14, 4);
    ctx.fillRect(x + 1, y + 12, 14, 4);
    ctx.fillStyle = tank.accent;
    ctx.fillRect(x + 4, y + 5, 8, 6);
    ctx.fillRect(tank.dir === 'left' ? x : x + 8, y + 7, 8, 2);
  }

  ctx.fillStyle = '#181818';
  if (tank.dir === 'up' || tank.dir === 'down') {
    for (let i = 2; i < TANK; i += 4) {
      ctx.fillRect(x + 1, y + i, 2, 1);
      ctx.fillRect(x + 13, y + i, 2, 1);
    }
  } else {
    for (let i = 2; i < TANK; i += 4) {
      ctx.fillRect(x + i, y + 1, 1, 2);
      ctx.fillRect(x + i, y + 13, 1, 2);
    }
  }
}

function drawPowerUps(): void {
  for (const powerUp of game.powerUps) {
    if (Math.floor((powerUp.duration - powerUp.age) * 4) % 2 === 1 && powerUp.age > powerUp.duration - 3) {
      continue;
    }

    const x = Math.round(powerUp.x);
    const y = Math.round(powerUp.y);
    drawPowerUpFrame(x, y);

    if (powerUp.type === 'grenade') {
      drawGrenadePowerUp(x, y);
    } else if (powerUp.type === 'helmet') {
      drawHelmetPowerUp(x, y);
    } else if (powerUp.type === 'shovel') {
      drawShovelPowerUp(x, y);
    } else if (powerUp.type === 'star') {
      drawStarPowerUp(x, y);
    } else if (powerUp.type === 'tank') {
      drawTankPowerUp(x, y);
    } else if (powerUp.type === 'timer') {
      drawTimerPowerUp(x, y);
    }
  }
}

function drawPowerUpFrame(x: number, y: number): void {
  ctx.fillStyle = '#f7d451';
  ctx.fillRect(x + 2, y + 2, 12, 12);
  ctx.fillStyle = '#181818';
  ctx.fillRect(x + 4, y + 4, 8, 8);
}

function drawGrenadePowerUp(x: number, y: number): void {
  ctx.fillStyle = '#6c8f40';
  ctx.fillRect(x + 5, y + 7, 6, 5);
  ctx.fillRect(x + 6, y + 6, 4, 7);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x + 6, y + 7, 2, 1);
  ctx.fillStyle = '#b8c0c8';
  ctx.fillRect(x + 8, y + 4, 3, 2);
  ctx.fillRect(x + 10, y + 5, 2, 1);
  ctx.fillStyle = '#d85028';
  ctx.fillRect(x + 12, y + 3, 2, 2);
}

function drawHelmetPowerUp(x: number, y: number): void {
  ctx.fillStyle = '#b8c0c8';
  ctx.fillRect(x + 5, y + 6, 6, 4);
  ctx.fillRect(x + 4, y + 8, 9, 3);
  ctx.fillStyle = '#eef8ff';
  ctx.fillRect(x + 6, y + 6, 3, 1);
  ctx.fillStyle = '#687880';
  ctx.fillRect(x + 4, y + 11, 9, 1);
  ctx.fillRect(x + 11, y + 9, 2, 2);
}

function drawShovelPowerUp(x: number, y: number): void {
  ctx.fillStyle = '#8c5a28';
  ctx.fillRect(x + 7, y + 4, 2, 7);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x + 6, y + 3, 4, 2);
  ctx.fillStyle = '#b8c0c8';
  ctx.fillRect(x + 5, y + 10, 6, 3);
  ctx.fillRect(x + 6, y + 13, 4, 1);
  ctx.fillStyle = '#687880';
  ctx.fillRect(x + 5, y + 12, 6, 1);
}

function drawStarPowerUp(x: number, y: number): void {
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x + 7, y + 3, 2, 3);
  ctx.fillRect(x + 6, y + 6, 4, 2);
  ctx.fillRect(x + 3, y + 8, 10, 2);
  ctx.fillRect(x + 5, y + 10, 6, 2);
  ctx.fillRect(x + 4, y + 12, 2, 2);
  ctx.fillRect(x + 10, y + 12, 2, 2);
  ctx.fillStyle = '#d8a828';
  ctx.fillRect(x + 7, y + 8, 2, 4);
}

function drawTankPowerUp(x: number, y: number): void {
  ctx.fillStyle = '#8fa8a2';
  ctx.fillRect(x + 3, y + 5, 3, 8);
  ctx.fillRect(x + 10, y + 5, 3, 8);
  ctx.fillStyle = '#d04f3f';
  ctx.fillRect(x + 6, y + 7, 5, 5);
  ctx.fillRect(x + 10, y + 8, 4, 2);
  ctx.fillStyle = '#181818';
  ctx.fillRect(x + 4, y + 6, 1, 1);
  ctx.fillRect(x + 4, y + 10, 1, 1);
  ctx.fillRect(x + 11, y + 6, 1, 1);
  ctx.fillRect(x + 11, y + 10, 1, 1);
}

function drawTimerPowerUp(x: number, y: number): void {
  ctx.fillStyle = '#b8c0c8';
  ctx.fillRect(x + 4, y + 3, 3, 2);
  ctx.fillRect(x + 9, y + 3, 3, 2);
  ctx.fillRect(x + 7, y + 4, 2, 1);
  ctx.fillRect(x + 5, y + 5, 6, 1);
  ctx.fillRect(x + 4, y + 6, 1, 5);
  ctx.fillRect(x + 11, y + 6, 1, 5);
  ctx.fillRect(x + 5, y + 11, 6, 1);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(x + 5, y + 6, 6, 5);
  ctx.fillStyle = '#181818';
  ctx.fillRect(x + 8, y + 7, 1, 3);
  ctx.fillRect(x + 8, y + 9, 3, 1);
  ctx.fillStyle = '#b8c0c8';
  ctx.fillRect(x + 5, y + 12, 2, 1);
  ctx.fillRect(x + 9, y + 12, 2, 1);
}

function drawBullets(): void {
  for (const bullet of game.bullets) {
    ctx.fillStyle = bullet.side === 'player' ? '#fff' : '#f8f8f8';
    ctx.fillRect(Math.round(bullet.x), Math.round(bullet.y), BULLET, BULLET);
  }
}

function drawExplosions(): void {
  for (const explosion of game.explosions) {
    const progress = explosion.age / explosion.duration;
    const size = explosion.size * (0.45 + progress);
    const x = explosion.x - size / 2;
    const y = explosion.y - size / 2;
    ctx.fillStyle = progress < 0.5 ? '#f7d451' : '#d95032';
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(size), Math.round(size));
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(Math.round(explosion.x - size / 5), Math.round(explosion.y - size / 5), Math.round(size / 2.5), Math.round(size / 2.5));
  }
}

function drawGridEdge(): void {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FIELD, 1);
  ctx.fillRect(0, FIELD - 1, FIELD, 1);
  ctx.fillRect(0, 0, 1, FIELD);
}

function drawHud(): void {
  ctx.fillStyle = '#747474';
  ctx.fillRect(HUD_X, 0, canvas.width - HUD_X, canvas.height);

  const enemyCount = game.enemyReserve + game.enemies.length;
  for (let i = 0; i < Math.min(enemyCount, 20); i += 1) {
    const x = HUD_X + 9 + (i % 2) * 16;
    const y = 16 + Math.floor(i / 2) * 8;
    drawEnemyCounterIcon(x, y);
  }

  pixelText('IP', HUD_X + 10, 112, 1, '#111');
  drawTankIcon(HUD_X + 11, 128, '#b86020');
  pixelText(String(Math.max(0, game.lives)), HUD_X + 27, 129, 1, '#111');
  drawFlag(HUD_X + 12, 169);
  pixelText(String(game.stage).padStart(2, '0'), HUD_X + 27, 171, 1, '#111');
  pixelText(String(game.score).padStart(6, '0'), HUD_X + 5, 224, 1, '#d8c050');
}

function drawTankIcon(x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 3, 8);
  ctx.fillRect(x + 7, y, 3, 8);
  ctx.fillRect(x + 4, y + 2, 2, 5);
  ctx.fillRect(x + 5, y - 1, 1, 5);
}

function drawTitleTankIcon(x: number, y: number): void {
  ctx.fillStyle = '#d8c050';
  ctx.fillRect(x, y + 1, 4, 14);
  ctx.fillRect(x + 12, y + 1, 4, 14);
  ctx.fillRect(x + 5, y + 4, 6, 8);
  ctx.fillRect(x + 7, y, 2, 8);
  ctx.fillStyle = '#fff2a3';
  ctx.fillRect(x + 6, y + 5, 4, 5);
  ctx.fillStyle = '#181818';
  for (let i = 2; i < 15; i += 4) {
    ctx.fillRect(x + 1, y + i, 2, 1);
    ctx.fillRect(x + 13, y + i, 2, 1);
  }
}

function drawEnemyCounterIcon(x: number, y: number): void {
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y, 2, 8);
  ctx.fillRect(x + 6, y, 2, 8);
  ctx.fillRect(x + 3, y + 1, 2, 6);
  ctx.fillRect(x + 4, y, 1, 4);
}

function drawFlag(x: number, y: number): void {
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y, 2, 11);
  ctx.fillStyle = '#d87818';
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 1);
  ctx.lineTo(x + 11, y + 4);
  ctx.lineTo(x + 2, y + 7);
  ctx.closePath();
  ctx.fill();
}

function drawOverlayMessage(): void {
  if (game.phase === 'playing') {
    return;
  }

  if (Math.floor(game.messageBlink * 2) % 2 === 1 && game.phase !== 'paused') {
    return;
  }

  const label =
    game.phase === 'title'
      ? 'PRESS ENTER'
      : game.phase === 'paused'
        ? 'PAUSE'
        : game.phase === 'won'
          ? 'STAGE CLEAR'
          : 'GAME OVER';

  const subLabel = game.phase === 'won' ? 'ENTER NEXT' : game.phase === 'gameover' ? 'ENTER RETRY' : '';
  const labelWidth = pixelTextWidth(label, 1);
  const subLabelWidth = subLabel ? pixelTextWidth(subLabel, 1) : 0;
  const width = Math.max(labelWidth, subLabelWidth) + 20;
  const x = Math.round((FIELD - width) / 2);
  const y = BOARD_Y + 88;

  ctx.fillStyle = '#050505';
  ctx.fillRect(x, y, width, subLabel ? 40 : 24);
  ctx.strokeStyle = '#f8f8f8';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y + 2, width - 4, subLabel ? 36 : 20);
  pixelText(label, centeredTextX(x, width, label, 1), y + 8, 1, '#f8f8f8');
  if (subLabel) {
    pixelText(subLabel, centeredTextX(x, width, subLabel, 1), y + 25, 1, '#f8f8f8');
  }
}

function centeredTextX(containerX: number, containerWidth: number, text: string, scale: number): number {
  return Math.round(containerX + (containerWidth - pixelTextWidth(text, scale)) / 2);
}

function pixelText(text: string, x: number, y: number, scale: number, color: string): void {
  ctx.fillStyle = color;
  const upper = text.toUpperCase();
  for (let index = 0; index < upper.length; index += 1) {
    const glyph = PIXEL_FONT[upper[index]] ?? PIXEL_FONT[' '];
    for (let row = 0; row < glyph.length; row += 1) {
      for (let col = 0; col < glyph[row].length; col += 1) {
        if (glyph[row][col] === '1') {
          ctx.fillRect(x + index * 6 * scale + col * scale, y + row * scale, scale, scale);
        }
      }
    }
  }
}

function pixelTextWidth(text: string, scale: number): number {
  return Math.max(0, text.length * 6 * scale - scale);
}
