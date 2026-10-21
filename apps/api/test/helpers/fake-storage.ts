import type { Bucket } from '../../src/storage/storage.service';

/** In-memory stand-in for StorageService: e2e tests never touch the real Supabase Storage. */
export class FakeStorage {
  readonly files = new Map<string, { data: Buffer; contentType: string }>();

  has(bucket: Bucket, path: string) {
    return this.files.has(`${bucket}/${path}`);
  }

  get(bucket: Bucket, path: string) {
    return this.files.get(`${bucket}/${path}`);
  }

  /** Paths in a bucket that start with prefix. */
  list(bucket: Bucket, prefix = '') {
    return [...this.files.keys()]
      .filter((k) => k.startsWith(`${bucket}/${prefix}`))
      .map((k) => k.slice(bucket.length + 1));
  }

  /** Every file under a folder (StorageService.listFolder). */
  listFolder(bucket: Bucket, prefix: string) {
    return Promise.resolve(this.list(bucket, `${prefix}/`));
  }

  ensureBuckets() {
    return Promise.resolve([]);
  }

  upload(bucket: Bucket, path: string, data: Buffer, contentType: string) {
    if (this.has(bucket, path)) throw new Error(`exists: ${bucket}/${path}`);
    this.files.set(`${bucket}/${path}`, { data, contentType });
    return Promise.resolve();
  }

  download(bucket: Bucket, path: string) {
    return Promise.resolve(this.get(bucket, path)?.data ?? null);
  }

  remove(bucket: Bucket, paths: string[]) {
    for (const p of paths) this.files.delete(`${bucket}/${p}`);
    return Promise.resolve();
  }

  removeQuietly(bucket: Bucket, paths: string[]) {
    return this.remove(bucket, paths);
  }

  publicUrl(bucket: Bucket, path: string) {
    return `https://test-project.supabase.co/storage/v1/object/public/${bucket}/${path}`;
  }

  signedUrl(bucket: Bucket, path: string) {
    return Promise.resolve(`https://test-project.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=test`);
  }
}
