import { Injectable } from '@nestjs/common';
import { BUCKETS, StorageService } from './storage.service';
import { toWalletLogo, walletLogoPath } from './wallet-logo';
import { IMAGE_CONTENT_TYPE } from './images';

@Injectable()
export class WalletLogoService {
  private readonly pending = new Map<string, Promise<string>>();
  constructor(private readonly storage: StorageService) {}

  /** Also upgrades older uploads on demand; only server-owned storage paths are downloaded. */
  async ensure(path: string, original?: Buffer): Promise<string> {
    const existing = this.pending.get(path);
    if (existing) return existing;
    const job = this.create(path, original);
    this.pending.set(path, job);
    try { return await job; } finally { this.pending.delete(path); }
  }

  private async create(path: string, original?: Buffer): Promise<string> {
    const target = walletLogoPath(path);
    if (target === path) throw new Error('Wallet logo requires an uploaded WebP path');
    if (!await this.storage.download(BUCKETS.vendors, target)) {
      const input = original ?? await this.storage.download(BUCKETS.vendors, path);
      if (!input) throw new Error('Uploaded logo not found');
      const output = await toWalletLogo(input);
      try { await this.storage.upload(BUCKETS.vendors, target, output, IMAGE_CONTENT_TYPE); } catch (error) {
        // Another process may have created the same immutable derivative first.
        if (!await this.storage.download(BUCKETS.vendors, target)) throw error;
      }
    }
    return this.storage.publicUrl(BUCKETS.vendors, target);
  }
}
