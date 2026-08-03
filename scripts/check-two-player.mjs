import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').replace("import './styles.css';", '');

const instrumented = `${source}
globalThis.__twoPlayerTest = {
  createGame,
  tryShoot,
  hitTank,
  update,
  handleStartPause,
  tankRect,
  getGame: () => game,
  setGame: (next) => {
    game = next;
  },
};
`;

const noop = () => {};
const context2d = new Proxy(
  { canvas: {} },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      return noop;
    },
    set() {
      return true;
    },
  },
);

const context = {
  console,
  Math,
  performance: { now: () => 0 },
  requestAnimationFrame: noop,
  window: { addEventListener: noop, setTimeout: noop },
  document: {
    documentElement: { style: { setProperty: noop } },
    querySelector: () => ({ width: 256, height: 240, getContext: () => context2d }),
  },
};
context.globalThis = context;

const { outputText } = ts.transpileModule(instrumented, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
vm.createContext(context);
vm.runInContext(outputText, context);

const api = context.__twoPlayerTest;

function assert(condition, message) {
  if (!condition) {
    console.error(`Two-player check failed: ${message}`);
    process.exit(1);
  }
}

function enemyBulletAt(tank) {
  return {
    side: 'enemy',
    x: tank.x + 6,
    y: tank.y + 6,
    dir: 'down',
    speed: 120,
    alive: true,
    ownerId: 99,
  };
}

// 1. 2p game state is initialized with a distinct second player
{
  const game = api.createGame(3, '2p');
  assert(game.mode === '2p', 'mode should be 2p');
  assert(game.menuIndex === 1, 'menu index should point at 2 PLAYERS');
  assert(game.player2, 'player2 should exist');
  assert(game.lives2 === 3, 'player2 should start with 3 lives');
  assert(game.player2.id !== game.player.id, 'player2 id must differ from player1 id');
  assert(game.player2.x !== game.player.x, 'player2 should spawn at its own tile');
}

// 2. 1p game keeps player2 empty
{
  const game = api.createGame(1);
  assert(game.player2 === null, '1p game should not create player2');
  assert(game.mode === '1p', 'default mode should be 1p');
}

// 3. selecting 2 PLAYERS on the title screen starts a 2p game
{
  const game = api.createGame(2);
  game.menuIndex = 1;
  api.setGame(game);
  api.handleStartPause();
  const next = api.getGame();
  assert(next.mode === '2p', 'menu selection should switch to 2p mode');
  assert(next.phase === 'stageIntro', 'menu selection should start the stage intro');
  assert(next.stage === 2, 'menu selection should preserve the chosen stage');
}

// 4. both players can hold one bullet each at the same time
{
  const game = api.createGame(1, '2p');
  game.phase = 'playing';
  game.player.cooldown = 0;
  game.player2.cooldown = 0;
  api.setGame(game);
  api.tryShoot(game.player);
  api.tryShoot(game.player2);
  const owners = game.bullets.map((bullet) => bullet.ownerId).sort();
  assert(game.bullets.length === 2, `expected 2 live bullets, got ${game.bullets.length}`);
  assert(owners[0] !== owners[1], 'player bullets must track distinct owners');
}

// 5. losing player1 does not end a 2p game while player2 has lives
{
  const game = api.createGame(1, '2p');
  game.phase = 'playing';
  game.player.spawnShield = 0;
  game.lives = 1;
  api.setGame(game);
  api.hitTank(enemyBulletAt(game.player));
  assert(game.lives === 0, 'player1 lives should drop to 0');
  assert(game.phase === 'playing', 'game should continue while player2 has lives');
}

// 6. the game ends only when both players are out of lives
{
  const game = api.createGame(1, '2p');
  game.phase = 'playing';
  game.player2.spawnShield = 0;
  game.lives = 0;
  game.lives2 = 1;
  api.setGame(game);
  api.hitTank(enemyBulletAt(game.player2));
  assert(game.lives2 === 0, 'player2 lives should drop to 0');
  assert(game.phase === 'gameover', 'game should end when both players are out');
}

// 7. player2 respawns on its own timer after losing a life
{
  const game = api.createGame(1, '2p');
  game.phase = 'playing';
  game.player2.spawnShield = 0;
  api.setGame(game);
  api.hitTank(enemyBulletAt(game.player2));
  assert(!game.player2.alive, 'player2 should be dead after a fatal hit');
  assert(game.player2RespawnTimer > 0, 'player2 respawn timer should be scheduled');
  for (let frame = 0; frame < 90 && !api.getGame().player2?.alive; frame += 1) {
    api.update(1 / 60);
  }
  const current = api.getGame();
  assert(current.player2.alive, 'player2 should respawn while lives remain');
  assert(current.player2.x !== current.player.x || current.player2.y !== current.player.y, 'player2 should respawn at its own tile');
}

// 8. enemy kills credit the shooting player
{
  const game = api.createGame(1, '2p');
  game.phase = 'playing';
  api.setGame(game);
  const enemy = {
    ...game.player2,
    id: 42,
    side: 'enemy',
    kind: 'armor',
    hp: 1,
    scoreValue: 400,
    spawnShield: 0,
    x: 32,
    y: 32,
    alive: true,
    bonusCarrier: false,
  };
  game.enemies = [enemy];
  const p2Bullet = {
    side: 'player',
    x: enemy.x + 6,
    y: enemy.y + 6,
    dir: 'down',
    speed: 148,
    alive: true,
    ownerId: game.player2.id,
  };
  api.hitTank(p2Bullet);
  assert(game.score2 === 400, `player2 should be credited, got score2=${game.score2}`);
  assert(game.score === 0, 'player1 score should stay untouched');
}

console.log('Two-player contracts pass');
