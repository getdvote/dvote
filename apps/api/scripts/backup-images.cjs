/* eslint-disable */
/**
 * Copies every image in Supabase Storage to a local folder, keeping Supabase's layout:
 *   <dir>/vendors/<vendorId>/logo/…, menu/…, branches/<branchId>/…, rewards/…, card/…
 *   <dir>/avatars/<userId>/…
 * Only new files are downloaded: Storage file names are random and never reused, so a file
 * already there (same size) is the same file. Files deleted in Storage stay in the copy (a backup
 * keeps history). Read-only for Supabase. Run by scripts/backup-db.cjs (npm run db:backup).
 *
 * Uses SUPABASE_URL + SUPABASE_SECRET_KEY from apps/api/.env (the secret key is needed for the
 * private avatars bucket; it is never printed).
 */
require('dotenv/config');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

/** Every file path in a bucket (Storage lists one folder level at a time). */
async function listAll(storage, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAll(storage, bucket, full))); // a folder
      else if (item.name !== '.emptyFolderPlaceholder') files.push({ path: full, size: item.metadata?.size ?? null });
    }
    if (data.length < 1000) return files;
  }
}

async function backupImages(dir) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are not set in apps/api/.env');
  const storage = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } }).storage;
  const { data: buckets, error } = await storage.listBuckets();
  if (error) throw new Error(error.message);

  let added = 0, kept = 0, failed = 0;
  for (const bucket of buckets) {
    const files = await listAll(storage, bucket.name);
    for (const f of files) {
      const target = path.join(dir, bucket.name, ...f.path.split('/'));
      if (fs.existsSync(target) && (f.size === null || fs.statSync(target).size === f.size)) { kept++; continue; }
      const { data, error: dlError } = await storage.from(bucket.name).download(f.path);
      if (dlError) { failed++; console.warn(`  could not download ${bucket.name}/${f.path}: ${dlError.message}`); continue; }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(await data.arrayBuffer()));
      added++;
    }
    console.log(`  ${bucket.name}: ${files.length} file(s) in Supabase`);
  }
  return { added, kept, failed };
}

module.exports = { backupImages };

if (require.main === module) {
  const dir = process.argv[2] || path.join(__dirname, '..', 'backups', 'images');
  backupImages(dir).then(
    (r) => console.log(`Images: ${r.added} new, ${r.kept} already there, ${r.failed} failed → ${dir}`),
    (e) => { console.error(`Image backup failed: ${e.message}`); process.exit(1); },
  );
}
