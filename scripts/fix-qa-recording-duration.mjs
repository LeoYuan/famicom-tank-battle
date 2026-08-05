import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const [, , inputArgument, outputArgument, durationArgument] = process.argv;
if (!inputArgument || !outputArgument || !durationArgument) {
  console.error('Usage: node scripts/fix-qa-recording-duration.mjs <input.webm> <output.webm> <duration-seconds>');
  process.exit(1);
}

const durationSeconds = Number(durationArgument);
if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
  console.error(`Invalid duration: ${durationArgument}`);
  process.exit(1);
}

globalThis.FileReader = class FileReader {
  result = null;
  onloadend = null;

  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const require = createRequire(import.meta.url);
const fixWebmDuration = require('fix-webm-duration');
const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
const input = await readFile(inputPath);
const fixedBlob = await fixWebmDuration(
  new Blob([input], { type: 'video/webm' }),
  durationSeconds * 1000,
  { logger: false },
);
const fixed = Buffer.from(await fixedBlob.arrayBuffer());
await writeFile(outputPath, fixed);

console.log(JSON.stringify({
  inputPath,
  outputPath,
  inputBytes: input.byteLength,
  outputBytes: fixed.byteLength,
  durationSeconds,
}));
