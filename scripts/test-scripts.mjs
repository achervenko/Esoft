import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const TEST_ROOT = 'tests/scripts';

const mode = parseMode(process.argv.slice(2));
const files = await findTestFiles(TEST_ROOT);
const selectedFiles = selectFiles(files, mode);

if (selectedFiles.length === 0) {
  console.log(`No ${mode} script tests found.`);
  process.exitCode = 0;
} else {
  process.exitCode = await runNodeTest(selectedFiles);
}

function parseMode(args) {
  const modeArg = args[0] ?? '--all';

  switch (modeArg) {
    case '--all':
      return 'all';
    case '--integration':
      return 'integration';
    case '--unit':
      return 'unit';
    default:
      throw new Error(`Unknown script test mode: ${modeArg}`);
  }
}

async function findTestFiles(root) {
  const entries = await readdir(root, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findTestFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(relative(process.cwd(), entryPath));
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function selectFiles(files, mode) {
  if (mode === 'all') {
    return files;
  }

  const isIntegration = (file) => file.endsWith('.integration.test.mjs');

  return mode === 'integration'
    ? files.filter(isIntegration)
    : files.filter((file) => !isIntegration(file));
}

function runNodeTest(files) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, ['--test', ...files], {
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });

    child.once('error', () => {
      resolveRun(1);
    });

    child.once('close', (code) => {
      resolveRun(code ?? 1);
    });
  });
}
