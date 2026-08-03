import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';

import { SECRET_MARKERS } from '../../helpers/operation-result.mjs';
import { createTemporaryProject } from '../../helpers/temporary-project.mjs';

export async function createRestoreProject({
  manifest = createManifest(),
  storageFiles = {
    'equipment/equipment_card/42/equipment_photo/photo.webp': 'photo-bytes',
    'manuals/manual.pdf': 'manual-bytes',
  },
  dumpContent = 'dump',
} = {}) {
  const project = await createTemporaryProject({
    'package.json': JSON.stringify({
      version: '0.0.1-test',
    }),
  });
  const backupPath = join(project.root, 'backups', '2026-08-03_09-30-00');

  await mkdir(join(backupPath, 'storage'), { recursive: true });

  if (manifest !== null) {
    await writeFile(join(backupPath, 'backup.json'), JSON.stringify(manifest));
  }

  if (dumpContent !== null) {
    await writeFile(join(backupPath, 'database.dump'), dumpContent);
  }

  if (storageFiles !== null) {
    for (const [relativePath, content] of Object.entries(storageFiles)) {
      const filePath = join(backupPath, 'storage', ...relativePath.split('/'));
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    }
  }

  return {
    ...project,
    backupPath,
  };
}

export function createManifest(overrides = {}) {
  return {
    formatVersion: overrides.formatVersion ?? 1,
    createdAt: overrides.createdAt ?? '2026-08-03T09:30:00.000Z',
    appVersion: overrides.appVersion ?? '0.0.1-test',
    database: {
      file: 'database.dump',
      ...(overrides.database ?? {}),
    },
    storage: {
      bucket: 'esoft',
      directory: 'storage',
      objectCount: 2,
      totalBytes: 'photo-bytes'.length + 'manual-bytes'.length,
      ...(overrides.storage ?? {}),
    },
  };
}

export function createConfig(project) {
  return {
    backup: {
      dir: join(project.root, 'backups'),
      pgDumpPath: null,
      pgRestorePath: null,
    },
    database: {
      url: `postgresql://esoft:${SECRET_MARKERS[0]}@127.0.0.1:5432/esoft?schema=public`,
    },
    minio: {
      accessKey: 'esoft_access',
      bucket: 'esoft',
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      secretKey: SECRET_MARKERS[1],
    },
    nodeEnv: 'production',
  };
}

export function createTestRuntime({
  argv = [],
  projectRoot = 'C:/project',
  runCommand = async () => {
    throw new Error('runCommand should be mocked');
  },
  runtimeDependencies = createS3Runtime().runtimeDependencies,
} = {}) {
  return {
    argv,
    projectRoot,
    runCommand,
    runtimeDependencies: {
      PgClient: createPgClient(),
      ...runtimeDependencies,
    },
  };
}

export function createPgRestoreRunner({ calls = [], result = null } = {}) {
  return async (command, args, options = {}) => {
    calls.push({ args, command, options });

    if (args.includes('--version')) {
      return {
        ok: true,
        stderr: '',
        stdout: 'pg_restore (PostgreSQL) 17.0',
      };
    }

    if (result) {
      return result;
    }

    return {
      ok: true,
      stderr: '',
      stdout: '',
    };
  };
}

export function createPgClient({ failConnect = false } = {}) {
  return class PgClient {
    constructor(config) {
      this.config = config;
    }

    async connect() {
      if (failConnect) {
        throw new Error('connect failed');
      }
    }

    async query() {
      return { rows: [{ '?column?': 1 }] };
    }

    async end() {}
  };
}

export function createS3Runtime({
  headError = null,
  objects = new Map(),
  pages = null,
} = {}) {
  const calls = [];

  class HeadBucketCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class ListObjectsV2Command {
    constructor(input) {
      this.input = input;
    }
  }

  class DeleteObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class PutObjectCommand {
    constructor(input) {
      this.input = input;
    }
  }

  class S3Client {
    async send(command) {
      if (command instanceof HeadBucketCommand) {
        calls.push({ input: command.input, type: 'head' });

        if (headError) {
          throw headError;
        }

        return {};
      }

      if (command instanceof ListObjectsV2Command) {
        calls.push({ input: command.input, type: 'list' });

        if (pages) {
          const pageIndex = command.input.ContinuationToken ? 1 : 0;
          return pages[pageIndex];
        }

        return {
          Contents: [...objects.entries()].map(([Key, value]) => ({
            Key,
            Size: Buffer.byteLength(value),
          })),
          IsTruncated: false,
        };
      }

      if (command instanceof DeleteObjectCommand) {
        calls.push({ input: command.input, type: 'delete' });
        objects.delete(command.input.Key);
        return {};
      }

      if (command instanceof PutObjectCommand) {
        calls.push({ input: command.input, type: 'put' });
        objects.set(command.input.Key, await readBody(command.input.Body));
        return {};
      }

      throw new Error('Unexpected command');
    }

    destroy() {
      calls.push({ type: 'destroy' });
    }
  }

  return {
    calls,
    objects,
    runtimeDependencies: {
      DeleteObjectCommand,
      HeadBucketCommand,
      ListObjectsV2Command,
      PutObjectCommand,
      S3Client,
    },
  };
}

export function createOutput() {
  const lines = [];

  return {
    lines,
    log(value = '') {
      lines.push(String(value));
    },
  };
}

async function readBody(body) {
  const chunks = [];
  const stream = body instanceof Readable ? body : Readable.from(body);

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
}
