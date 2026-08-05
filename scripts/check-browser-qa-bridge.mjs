import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const failures = [];

for (const [pattern, label] of [
  ["searchParams.get('qa') === '1'", 'QA bridge must be gated by ?qa=1'],
  ["'/scripts/qa-autoplay.mjs'", 'browser QA must reuse the seeded autoplay policy'],
  ['window.dispatchEvent(new KeyboardEvent', 'autoplay must use the normal keyboard input path'],
  ['captureStream(30)', 'recording must capture the rendered canvas at 30fps'],
  ['new MediaRecorder', 'recording must use the browser media recorder'],
  ['__tankQa', 'QA bridge must expose a browser control surface'],
  ['game.stage === LEVELS_13_DRAFT.length', 'autoplay must stop after the final shipped stage'],
  ["qaParameters.get('autostart') === '1'", 'QA recording must support URL-driven browser startup'],
  ["method: 'POST'", 'recording must support uploading the finished artifact'],
]) {
  if (!source.includes(pattern)) {
    failures.push(label);
  }
}

if (failures.length > 0) {
  console.error(`Browser QA bridge check failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('Browser QA bridge contracts pass');
