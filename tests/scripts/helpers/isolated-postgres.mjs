import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { runCommand } from '../../../scripts/infrastructure/commands/run-command.mjs';

const { Client } = createRequire(import.meta.url)('pg');

export async function createIsolatedPostgres() {
  const root = await mkdtemp(join(tmpdir(), 'esoft-sql-equivalence-'));
  const data = join(root, 'postgres');
  const pgBin = process.env.ESOFT_TEST_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
  const exe = (name) => join(pgBin, process.platform === 'win32' ? `${name}.exe` : name);
  const listener = createServer();
  await new Promise((ok, fail) => { listener.once('error', fail); listener.listen(0, '127.0.0.1', ok); });
  const port = listener.address().port;
  await new Promise((ok, fail) => listener.close((error) => error ? fail(error) : ok()));
  let attempted = false;
  async function control(args) {
    await new Promise((ok, fail) => {
      const child = spawn(exe('pg_ctl'), args, { stdio: 'ignore', windowsHide: true });
      const timer = setTimeout(() => { child.kill(); fail(new Error(`pg_ctl timeout; retained ${root}`)); }, 30000);
      child.once('error', (error) => { clearTimeout(timer); fail(error); });
      child.once('exit', (code) => { clearTimeout(timer); code === 0 ? ok() : fail(new Error(`pg_ctl exit ${code}; retained ${root}`)); });
    });
  }
  const urlFor = (database, user = 'esoft_probe') => `postgresql://${user}@127.0.0.1:${port}/${database}`;
  let admin;
  const connections = [];
  async function close() {
    for (const client of connections) await client.end();
    await admin?.end();
    if (attempted) {
      let running = false;
      try { await access(join(data, 'postmaster.pid')); running = true; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (running) await control(['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop']);
    }
    const target = resolve(root);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('esoft-sql-equivalence-')) throw new Error('Unsafe cluster cleanup target');
    await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  try {
    const init = await runCommand(exe('initdb'), ['-D', data, '-U', 'esoft_probe', '-A', 'trust', '--encoding=UTF8', '--locale=C', '--locale-provider=icu', '--icu-locale=ru-RU'], { timeoutMs: 30000 });
    if (!init.ok) throw new Error(init.stderr || init.stdout);
    attempted = true;
    await control(['-D', data, '-l', join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', '-t', '20', 'start']);
    admin = new Client({ connectionString: urlFor('postgres') });
    await admin.connect();
    return {
      root, close, urlFor,
      adminQuery: (sql, params) => admin.query(sql, params),
      async database(name, { owner, unicode = false } = {}) {
        if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid probe database name');
        if (owner && !/^[a-z_]+$/.test(owner)) throw new Error('Invalid probe owner name');
        await admin.query(`CREATE DATABASE "${name}"${owner ? ` OWNER "${owner}"` : ''}${unicode ? " TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'ru-RU' LOCALE 'C'" : ''}`);
        const client = new Client({ connectionString: urlFor(name) });
        await client.connect();
        connections.push(client);
        return client;
      },
    };
  } catch (error) { await close(); throw error; }
}
