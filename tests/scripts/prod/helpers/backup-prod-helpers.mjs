import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';

import { SECRET_MARKERS } from '../../helpers/operation-result.mjs';
import { createTemporaryProject } from '../../helpers/temporary-project.mjs';

export async function createBackupProject() {
  return createTemporaryProject({
    'package.json': JSON.stringify({
      version: '0.0.1-test',
    }),
  });
}

export function createTestRuntime({
  output = createOutput(),
  projectRoot = 'C:/project',
  runCommand = async () => {
    throw new Error('runCommand should be mocked');
  },
  runtimeDependencies = createS3Runtime().runtimeDependencies,
} = {}) {
  return {
    clock: () => new Date('2026-08-03T09:30:00.000Z'),
    output,
    projectRoot,
    runCommand,
    runtimeDependencies,
  };
}

export function createConfig(project) {
  return {
    backup: {
      dir: join(project.root, 'backups'),
      pgDumpPath: null,
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

export function createPgDumpRunner({ calls = [], dumpContent = 'dump' } = {}) {
  return async (command, args, options = {}) => {
    calls.push({ args, command, options });

    if (args.includes('--version')) {
      return {
        ok: true,
        stderr: '',
        stdout: 'pg_dump (PostgreSQL) 17.0',
      };
    }

    const fileArg = args.find((arg) => arg.startsWith('--file='));

    if (fileArg && dumpContent !== undefined) {
      await writeTextFile(fileArg.slice('--file='.length), dumpContent);
    }

    return {
      ok: true,
      stderr: '',
      stdout: '',
    };
  };
}

export async function writeTextFile(filePath, content) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
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

  class GetObjectCommand {
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
            Size: typeof value === 'string' ? Buffer.byteLength(value) : 0,
          })),
          IsTruncated: false,
        };
      }

      if (command instanceof GetObjectCommand) {
        calls.push({ input: command.input, type: 'get' });
        const value = objects.get(command.input.Key);

        return {
          Body: value instanceof Readable ? value : Readable.from([value ?? '']),
        };
      }

      throw new Error('Unexpected command');
    }

    destroy() {
      calls.push({ type: 'destroy' });
    }
  }

  return {
    calls,
    runtimeDependencies: {
      GetObjectCommand,
      HeadBucketCommand,
      ListObjectsV2Command,
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
