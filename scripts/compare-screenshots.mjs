import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run compare -- <filename>');
  process.exit(1);
}

const originalPath = join('reference', 'original', input);
const currentPath = join('reference', 'current', input);

if (!existsSync(originalPath)) {
  console.error(`Missing original screenshot: ${originalPath}`);
  process.exit(1);
}

if (!existsSync(currentPath)) {
  console.error(`Missing current screenshot: ${currentPath}`);
  process.exit(1);
}

const name = basename(input, extname(input));
const outputPath = join('reference', `compare-${name}.html`);
mkdirSync('reference', { recursive: true });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Battle City Compare - ${escapeHtml(name)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        padding: 24px;
        background: #181818;
        color: #eee;
        font-family: Menlo, Consolas, monospace;
      }
      h1 { margin: 0 0 18px; font-size: 18px; }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px;
      }
      figure { margin: 0; }
      figcaption { margin-bottom: 8px; color: #bdbdbd; }
      img {
        width: 100%;
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        background: #000;
        border: 1px solid #555;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(input)}</h1>
    <div class="grid">
      <figure>
        <figcaption>Original reference</figcaption>
        <img src="original/${encodeURI(input)}" alt="Original reference" />
      </figure>
      <figure>
        <figcaption>Current implementation</figcaption>
        <img src="current/${encodeURI(input)}" alt="Current implementation" />
      </figure>
    </div>
  </body>
</html>
`;

writeFileSync(outputPath, html);
console.log(`Wrote ${outputPath}`);

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
