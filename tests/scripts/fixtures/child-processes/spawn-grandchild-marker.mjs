import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const readyPath = process.argv[2];
const markerPath = process.argv[3];

if (!readyPath) {
  throw new Error('ready path is required');
}

if (!markerPath) {
  throw new Error('marker path is required');
}

const child = spawn(process.execPath, [
  '-e',
  `setTimeout(() => require('node:fs').writeFileSync(${JSON.stringify(markerPath)}, 'alive'), 1500)`,
], {
  stdio: 'ignore',
});

child.once('spawn', () => {
  writeFileSync(readyPath, 'ready');
  process.stdout.write('READY\n');
});

child.once('error', (error) => {
  console.error(error);
  process.exit(1);
});

setInterval(() => undefined, 1_000);
