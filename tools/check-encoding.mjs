import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isStrict = process.argv.includes('--strict');

const ignoredDirectories = new Set([
  '.git',
  '.vscode',
  'coverage',
  'dist',
  'logs',
  'minio',
  'node_modules',
]);

const scannedExtensions = new Set([
  '.css',
  '.cjs',
  '.cmd',
  '.env',
  '.example',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.ps1',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);

const suspiciousPatterns = [
  /[\u00d0\u00d1\u00c2][\u0080-\u00ff\u0400-\u04ff]/u,
  /[\u0420\u0421][\u0080-\u00ff]/u,
  /\u0432[\u0402-\u040c]/u,
  /\u00ef\u00bf\u00bd/u,
];

const checkedFiles = [...walk(root)].filter(shouldScanFile);
const findings = [];

for (const file of checkedFiles) {
  const buffer = readFileSync(file);
  const text = buffer.toString('utf8');

  if (text.includes('\uFFFD')) {
    findings.push({
      file,
      reason: 'содержит символ замены UTF-8 U+FFFD',
    });
    continue;
  }

  if (suspiciousPatterns.some((pattern) => pattern.test(text))) {
    findings.push({
      file,
      reason: 'содержит признаки повреждённой кодировки',
    });
  }
}

if (findings.length === 0) {
  console.log(`Проверка кодировки пройдена: файлов проверено ${checkedFiles.length}.`);
  process.exit(0);
}

const changedFiles = getChangedFiles();
const changedFindings = findings.filter((finding) =>
  changedFiles.has(toRelativePath(finding.file)),
);

console.log(
  `Проверка кодировки нашла подозрительные файлы: ${findings.length} из ${checkedFiles.length}.`,
);

for (const finding of findings) {
  const relativePath = toRelativePath(finding.file);
  const marker = changedFiles.has(relativePath) ? 'изменён' : 'существующий';
  console.log(`- [${marker}] ${relativePath}: ${finding.reason}`);
}

if (isStrict || changedFindings.length > 0) {
  console.error(
    isStrict
      ? 'Строгая проверка кодировки не пройдена.'
      : 'Проверка кодировки не пройдена: изменённые файлы содержат подозрительные признаки.',
  );
  process.exit(1);
}

console.log(
  'Изменённые файлы не содержат подозрительных признаков. Существующие находки показаны для будущей очистки.',
);

function* walk(directory) {
  for (const entry of readDirectorySafe(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSafe(fullPath);

    if (!stat) {
      continue;
    }

    if (stat.isDirectory()) {
      if (!ignoredDirectories.has(entry)) {
        yield* walk(fullPath);
      }

      continue;
    }

    if (stat.isFile()) {
      yield fullPath;
    }
  }
}

function statSafe(targetPath) {
  try {
    return statSync(targetPath);
  } catch {
    return null;
  }
}

function readDirectorySafe(directory) {
  try {
    return readdirSync(directory);
  } catch {
    return [];
  }
}

function shouldScanFile(file) {
  const fileName = basename(file);

  if (fileName === '.env' || fileName.startsWith('.env.')) {
    return true;
  }

  return scannedExtensions.has(extname(file));
}

function getChangedFiles() {
  return new Set([
    ...readGitFileListSafe(['diff', '--name-only', 'HEAD', '--']),
    ...readGitFileListSafe(['ls-files', '--others', '--exclude-standard']),
  ]);
}

function readGitFileListSafe(args) {
  try {
    return readGitFileList(args);
  } catch {
    return [];
  }
}

function readGitFileList(args) {
  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter(Boolean);
}

function toRelativePath(file) {
  return relative(root, file).replace(/\\/g, '/');
}
