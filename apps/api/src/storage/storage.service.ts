import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Env } from '../config/env.validation';

/**
 * Supabase Storage buckets (created by `npm run storage:setup`).
 * - vendors: PUBLIC. Logos, menu pages, branch photos: meant to be seen by anyone.
 * - avatars: PRIVATE. Customer photos; only shown to their owner through short-lived signed URLs.
 */
export const BUCKETS = {
  vendors: 'vendors',
  avatars: 'avatars',
} as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** How long a signed avatar URL works. */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Files in Supabase Storage, written with the server-only SECRET key: the apps never upload
 * to Storage directly. Every file name is unique, so a file never changes after upload and
 * can be cached forever. Tests replace this provider with an in-memory fake.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: SupabaseClient | null;
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('SUPABASE_URL', { infer: true }).replace(/\/+$/, '');
    const secret = config.get('SUPABASE_SECRET_KEY', { infer: true })?.trim();
    this.client = secret
      ? createClient(this.baseUrl, secret, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;
  }

  /**
   * Creates the buckets, or brings their settings up to date (safe to run again).
   * Both only accept the WebP files the API produces, at most 2 MB each.
   */
  async ensureBuckets(): Promise<string[]> {
    const storage = this.storage();
    const report: string[] = [];
    for (const [name, isPublic] of [
      [BUCKETS.vendors, true],
      [BUCKETS.avatars, false],
    ] as const) {
      const options = { public: isPublic, fileSizeLimit: '2MB', allowedMimeTypes: ['image/webp'] };
      const { data: existing } = await storage.getBucket(name);
      const { error } = existing
        ? await storage.updateBucket(name, options)
        : await storage.createBucket(name, options);
      if (error) throw this.failed(`set up bucket ${name}`, error);
      report.push(`${name}: ${existing ? 'updated' : 'created'} (${isPublic ? 'public' : 'private'})`);
    }
    return report;
  }

  async upload(bucket: Bucket, path: string, data: Buffer, contentType: string): Promise<void> {
    const { error } = await this.storage()
      .from(bucket)
      .upload(path, data, { contentType, cacheControl: '31536000', upsert: false });
    if (error) throw this.failed(`upload ${bucket}/${path}`, error);
  }

  /** Deletes files. Missing files are not an error (the goal, "gone", is reached). */
  async remove(bucket: Bucket, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.storage().from(bucket).remove(paths);
    if (error) throw this.failed(`remove from ${bucket}`, error);
  }

  /** Permanent URL of a file in a PUBLIC bucket (no network call). */
  publicUrl(bucket: Bucket, path: string): string {
    return `${this.baseUrl}/storage/v1/object/public/${bucket}/${encodePath(path)}`;
  }

  /** Short-lived URL of a file in a PRIVATE bucket. */
  async signedUrl(bucket: Bucket, path: string): Promise<string> {
    const { data, error } = await this.storage()
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_SECONDS);
    if (error) throw this.failed(`sign ${bucket}/${path}`, error);
    return data.signedUrl;
  }

  /** Deletes without failing the request: for clean-up after the main change already succeeded. */
  async removeQuietly(bucket: Bucket, paths: string[]): Promise<void> {
    try {
      await this.remove(bucket, paths);
    } catch (err) {
      this.logger.warn(`Leftover file(s) not removed from ${bucket}: ${paths.join(', ')} (${String(err)})`);
    }
  }

  private storage() {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'storage_not_configured',
        message: 'SUPABASE_SECRET_KEY is not set on the API server',
      });
    }
    return this.client.storage;
  }

  private failed(action: string, error: { message: string }) {
    this.logger.error(`Storage ${action} failed: ${error.message}`);
    return new ServiceUnavailableException({
      code: 'storage_error',
      message: error.message,
    });
  }
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
