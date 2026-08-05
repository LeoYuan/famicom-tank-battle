import { createServer } from 'node:http';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const outputPath = resolve(process.argv[2] ?? 'artifacts/famicom-tank-battle-stages-1-8.webm');
const port = Number(process.env.QA_RECORDING_PORT ?? 4174);

await mkdir(dirname(outputPath), { recursive: true });

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method !== 'POST' || request.url !== '/recording') {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    await pipeline(request, createWriteStream(outputPath));
    const file = await stat(outputPath);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ path: outputPath, bytes: file.size }));
    process.nextTick(() => server.close());
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`QA recording receiver listening on http://127.0.0.1:${port}/recording`);
  console.log(`Writing recording to ${outputPath}`);
});
