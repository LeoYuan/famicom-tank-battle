import { createAutoplayController } from './qa-autoplay.mjs';

checkBlockedDodgeCountersInsteadOfRunningWithBullet();
checkDodgeContinuesUntilBulletLaneIsClear();
checkCloseEnemyAimTriggersProactiveEvasion();

console.log('QA autoplay projectile response contracts pass');

function checkBlockedDodgeCountersInsteadOfRunningWithBullet() {
  const map = Array.from({ length: 26 }, () => Array.from({ length: 26 }, () => '.'));
  map[8][3] = 'B';
  map[9][3] = 'B';

  const game = {
    stage: 6,
    phase: 'playing',
    player: {
      x: 9,
      y: 64,
      speed: 56,
      alive: true,
      cooldown: 0,
    },
    enemies: [],
    bullets: [
      {
        side: 'enemy',
        alive: true,
        x: 6.5,
        y: 40,
        dir: 'down',
      },
    ],
    powerUps: [],
    map,
  };

  const keys = createAutoplayController().decide(game, 1);
  assertEqual(keys.join(','), 'ArrowUp,Space', 'blocked dodge should counter the approaching bullet');
}

function checkDodgeContinuesUntilBulletLaneIsClear() {
  const game = {
    stage: 6,
    phase: 'playing',
    player: {
      x: 13,
      y: 96,
      speed: 56,
      alive: true,
      cooldown: 0,
    },
    enemies: [
      {
        id: 7,
        alive: true,
        x: 0,
        y: 96,
        bonusCarrier: false,
      },
    ],
    bullets: [
      {
        side: 'enemy',
        alive: true,
        x: 6.5,
        y: 80,
        dir: 'down',
      },
    ],
    powerUps: [],
    map: Array.from({ length: 26 }, () => Array.from({ length: 26 }, () => '.')),
  };
  const keys = createAutoplayController().decide(game, 1);
  assertEqual(keys[0], 'ArrowRight', 'dodge should remain active until the bullet lane is safely clear');
}

function checkCloseEnemyAimTriggersProactiveEvasion() {
  const game = {
    stage: 8,
    phase: 'playing',
    player: {
      x: 64,
      y: 135,
      speed: 56,
      alive: true,
      cooldown: 0,
    },
    enemies: [
      {
        id: 8,
        alive: true,
        x: 96,
        y: 128,
        dir: 'left',
        bonusCarrier: false,
      },
      {
        id: 9,
        alive: true,
        x: 64,
        y: 156,
        dir: 'up',
        bonusCarrier: false,
      },
    ],
    bullets: [],
    powerUps: [],
    map: Array.from({ length: 26 }, () => Array.from({ length: 26 }, () => '.')),
  };
  game.map[17][7] = 'S';
  game.map[18][7] = 'S';

  const keys = createAutoplayController().decide(game, 1);
  assertEqual(keys[0], 'ArrowUp', 'close aimed enemy should trigger movement out of its firing lane');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`${message}: expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}
