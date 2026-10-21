/* eslint-disable */
/**
 * Backs up dvote (the project DATABASE_URL / SUPABASE_URL in apps/api/.env point to):
 *
 *   npm run db:backup                        (from apps/api, or `npm run db:backup` at the repo root)
 *   npm run db:backup -- --out "D:/backups"  another folder for this run
 *
 * Into BACKUP_DIR (apps/api/.env, e.g. the Google Drive for desktop folder "G:/My Drive/dvote";
 * default apps/api/backups, git-ignored):
 *   database/dvote-<project>-<date>-<time>.dump  every table of our app (schema public) plus the
 *                                                Supabase sign-in accounts (schema auth); a new file each run
 *   images/<bucket>/...                          every Storage image in Supabase's own folders;
 *                                                only new files are downloaded (scripts/backup-images.cjs)
 * Read-only: nothing in Supabase is changed.
 *
 * Restore (into an EMPTY database, e.g. a new Supabase project, never over live data):
 *   pg_restore --no-owner --no-privileges --schema=public -d "<database url>" <file>.dump
 *   (public = our tables; restoring auth into Supabase needs care: ask before doing it)
 *
 * Needs pg_dump 17 or newer (PostgreSQL 18 on this PC: found automatically; else set PG_DUMP).
 * Uses the session pooler (port 5432): pg_dump does not work through the transaction pooler.
 * The password is passed in the environment, never printed or put on the command line.
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { backupImages } = require('./backup-images.cjs');

function findPgDump() {
  if (process.env.PG_DUMP) return process.env.PG_DUMP;
  const root = 'C:/Program Files/PostgreSQL';
  if (fs.existsSync(root)) {
    const versions = fs.readdirSync(root).filter((v) => /^\d+$/.test(v)).sort((a, b) => b - a);
    for (const v of versions) {
      const exe = path.join(root, v, 'bin', 'pg_dump.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return 'pg_dump'; // on the PATH (Mac / Linux)
}

function backupDatabase(dir) {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set in apps/api/.env');
  const url = new URL(raw.replace('.pooler.supabase.com:6543/', '.pooler.supabase.com:5432/'));
  const password = decodeURIComponent(url.password);
  url.password = '';
  url.search = '';

  fs.mkdirSync(dir, { recursive: true });
  const project = (url.username.split('.')[1] || url.hostname.split('.')[0]).slice(0, 12);
  const stamp = new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '');
  const file = path.join(dir, `dvote-${project}-${stamp}.dump`);

  console.log(`Database: backing up project ${project} ...`);
  const res = spawnSync(
    findPgDump(),
    ['--format=custom', '--no-owner', '--no-privileges', '--schema=public', '--schema=auth', `--file=${file}`, url.toString()],
    { env: { ...process.env, PGPASSWORD: password }, stdio: ['ignore', 'inherit', 'inherit'] },
  );
  if (res.error) throw new Error(`could not run pg_dump (${res.error.message}). Install PostgreSQL 17+ tools or set PG_DUMP.`);
  if (res.status !== 0) {
    fs.rmSync(file, { force: true });
    throw new Error('pg_dump failed (see the message above). Nothing was saved.');
  }
  console.log(`Database: saved ${file} (${(fs.statSync(file).size / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  const outArg = process.argv.indexOf('--out');
  const base = outArg > 0 ? process.argv[outArg + 1] : process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
  console.log(`Backing up into ${base}`);

  backupDatabase(path.join(base, 'database'));

  console.log('Images: checking Supabase Storage ...');
  const r = await backupImages(path.join(base, 'images'));
  console.log(`Images: ${r.added} new, ${r.kept} already there${r.failed ? `, ${r.failed} FAILED` : ''} -> ${path.join(base, 'images')}`);
  if (r.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`Backup failed: ${e.message}`);
  process.exit(1);
});
