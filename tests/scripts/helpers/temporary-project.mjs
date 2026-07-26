import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export async function createTemporaryProject(files = {}) {
  if (
    files === null ||
    typeof files !== 'object' ||
    Array.isArray(files)
  ) {
    throw new TypeError('files must be an object');
  }

  const root = await mkdtemp(join(tmpdir(), 'esoft-scripts-test-'));

  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = resolveProjectPath(root, relativePath);

      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    }
  } catch (error) {
    try {
      await rm(root, {
        force: true,
        recursive: true,
      });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Failed to create and clean up temporary project',
      );
    }

    throw error;
  }

  return {
    root,
    async remove() {
      await rm(root, {
        force: true,
        recursive: true,
      });
    },
  };
}

function resolveProjectPath(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath === '') {
    throw new TypeError('file path must be a non-empty string');
  }

  if (isAbsolute(relativePath)) {
    throw new TypeError(`file path must be relative: ${relativePath}`);
  }

  const filePath = resolve(root, relativePath);
  const pathFromRoot = relative(root, filePath);

  if (
    pathFromRoot === '' ||
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`)
  ) {
    throw new TypeError(
      `file path must stay inside the temporary project: ${relativePath}`,
    );
  }

  return filePath;
}
