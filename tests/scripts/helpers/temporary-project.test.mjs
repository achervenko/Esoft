import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import test from 'node:test';

import { createTemporaryProject } from './temporary-project.mjs';

test('createTemporaryProject writes nested files and removes them', async () => {
  const project = await createTemporaryProject({
    'backend/prisma/schema.prisma': 'datasource db {}',
  });

  try {
    const filePath = join(project.root, 'backend/prisma/schema.prisma');

    assert.equal(await readFile(filePath, 'utf8'), 'datasource db {}');
  } finally {
    await project.remove();
  }

  await assert.rejects(() => access(project.root));
});

test('createTemporaryProject validates files argument', async () => {
  await assert.rejects(
    () => createTemporaryProject(null),
    /files must be an object/,
  );
  await assert.rejects(
    () => createTemporaryProject([]),
    /files must be an object/,
  );
});

test('createTemporaryProject rejects paths outside the temporary root', async () => {
  await assert.rejects(
    () => createTemporaryProject({ '../outside.txt': 'nope' }),
    /file path must stay inside/,
  );
});

test('createTemporaryProject rejects absolute paths', async () => {
  const absolutePath = isAbsolute('/tmp/outside.txt')
    ? '/tmp/outside.txt'
    : 'C:\\outside.txt';

  await assert.rejects(
    () => createTemporaryProject({ [absolutePath]: 'nope' }),
    /file path must be relative/,
  );
});
