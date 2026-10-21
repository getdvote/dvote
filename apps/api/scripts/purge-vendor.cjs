/* eslint-disable */
/**
 * Permanently removes ONE vendor and everything that belongs to it (for test/fake vendors).
 * Real vendors should be suspended instead (admin dashboard → Suspend).
 *
 *   node scripts/purge-vendor.cjs <vendorId>            dry run: counts only, deletes nothing
 *   node scripts/purge-vendor.cjs <vendorId> --confirm  deletes, in one transaction
 *
 * Order (foreign keys): redemptions → point_events (append-only trigger switched off inside the
 * transaction only) → qr_codes → cards → fraud_flags → vendor_images → rewards → point_rules →
 * staff_users → branches → vendors. Then the vendor's files in Storage (bucket "vendors",
 * folder <vendorId>/). Customers themselves are kept (they may have cards at other shops).
 * Uses DATABASE_URL from apps/api/.env (the session pooler is used for the transaction).
 */
require('dotenv/config');
const { Client } = require('pg');

const vendorId = process.argv[2];
const confirm = process.argv.includes('--confirm');
if (!/^[0-9a-f-]{36}$/i.test(vendorId ?? '')) {
  console.error('Usage: node scripts/purge-vendor.cjs <vendorId> [--confirm]');
  process.exit(1);
}

const v = [vendorId];
const steps = [
  ['redemptions', 'DELETE FROM redemptions WHERE vendor_id = $1', 'SELECT count(*) FROM redemptions WHERE vendor_id = $1'],
  ['point_events', 'DELETE FROM point_events WHERE vendor_id = $1', 'SELECT count(*) FROM point_events WHERE vendor_id = $1'],
  ['qr_codes', 'DELETE FROM qr_codes WHERE vendor_id = $1 OR used_branch_id IN (SELECT id FROM branches WHERE vendor_id = $1)',
    'SELECT count(*) FROM qr_codes WHERE vendor_id = $1 OR used_branch_id IN (SELECT id FROM branches WHERE vendor_id = $1)'],
  ['cards', 'DELETE FROM cards WHERE vendor_id = $1', 'SELECT count(*) FROM cards WHERE vendor_id = $1'],
  ['fraud_flags', 'DELETE FROM fraud_flags WHERE vendor_id = $1 OR branch_id IN (SELECT id FROM branches WHERE vendor_id = $1) OR staff_id IN (SELECT id FROM staff_users WHERE vendor_id = $1)',
    'SELECT count(*) FROM fraud_flags WHERE vendor_id = $1 OR branch_id IN (SELECT id FROM branches WHERE vendor_id = $1) OR staff_id IN (SELECT id FROM staff_users WHERE vendor_id = $1)'],
  ['vendor_images', 'DELETE FROM vendor_images WHERE vendor_id = $1', 'SELECT count(*) FROM vendor_images WHERE vendor_id = $1'],
  ['rewards', 'DELETE FROM rewards WHERE vendor_id = $1', 'SELECT count(*) FROM rewards WHERE vendor_id = $1'],
  ['point_rules', 'DELETE FROM point_rules WHERE vendor_id = $1', 'SELECT count(*) FROM point_rules WHERE vendor_id = $1'],
  ['staff_users', 'DELETE FROM staff_users WHERE vendor_id = $1', 'SELECT count(*) FROM staff_users WHERE vendor_id = $1'],
  ['branches', 'DELETE FROM branches WHERE vendor_id = $1', 'SELECT count(*) FROM branches WHERE vendor_id = $1'],
  ['vendors', 'DELETE FROM vendors WHERE id = $1', 'SELECT count(*) FROM vendors WHERE id = $1'],
];

(async () => {
  const url = process.env.DATABASE_URL.replace('.pooler.supabase.com:6543/', '.pooler.supabase.com:5432/');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const vendor = (await db.query('SELECT name, status FROM vendors WHERE id = $1', v)).rows[0];
    if (!vendor) throw new Error('No vendor with this id.');
    console.log(`Vendor: ${vendor.name} (${vendor.status})  ${vendorId}`);
    for (const [table, , count] of steps) {
      console.log(`  ${table.padEnd(14)} ${(await db.query(count, v)).rows[0].count}`);
    }
    if (!confirm) {
      console.log('\nDry run: nothing deleted. Add --confirm to delete all of the above.');
      return;
    }

    await db.query('BEGIN');
    await db.query('ALTER TABLE point_events DISABLE TRIGGER point_events_no_update');
    for (const [table, del] of steps) {
      const r = await db.query(del, v);
      console.log(`deleted ${String(r.rowCount).padStart(5)}  ${table}`);
    }
    await db.query('ALTER TABLE point_events ENABLE TRIGGER point_events_no_update');
    // Every remaining card must still match its ledger.
    const bad = (await db.query(`SELECT count(*) FROM cards c
      WHERE c.balance <> COALESCE((SELECT sum(delta) FROM point_events e WHERE e.card_id = c.id), 0)`)).rows[0].count;
    if (Number(bad) > 0) throw new Error(`${bad} card(s) would not match their ledger: rolled back.`);
    await db.query('COMMIT');
    console.log('Database: done (trigger back on, all cards match their ledger).');

    // Files in Storage: bucket "vendors", folder <vendorId>/
    const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!base || !key) return console.log('Storage: SUPABASE_URL / SUPABASE_SECRET_KEY missing, files not removed.');
    const headers = { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' };
    const list = async (prefix) => {
      const res = await fetch(`${base}/storage/v1/object/list/vendors`, { method: 'POST', headers, body: JSON.stringify({ prefix, limit: 1000 }) });
      const items = await res.json();
      let files = [];
      for (const it of Array.isArray(items) ? items : []) {
        const path = `${prefix}${it.name}`;
        files = it.id ? files.concat(path) : files.concat(await list(`${path}/`));
      }
      return files;
    };
    const files = await list(`${vendorId}/`);
    if (files.length) {
      await fetch(`${base}/storage/v1/object/vendors`, { method: 'DELETE', headers, body: JSON.stringify({ prefixes: files }) });
    }
    console.log(`Storage: removed ${files.length} file(s).`);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Stopped, nothing changed in the database:', err.message.replace(/postgres(ql)?:\/\/\S+/g, '***'));
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
