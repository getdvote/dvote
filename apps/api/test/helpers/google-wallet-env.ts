// Google Wallet set up with a throwaway key for google-wallet.e2e-spec. Imported before AppModule:
// ConfigModule reads the environment when the app module is first imported.
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const file = join(mkdtempSync(join(tmpdir(), 'dvote-gw-')), 'key.json');
writeFileSync(file, JSON.stringify({ client_email: 'wallet@test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }));

process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000099999999';
process.env.GOOGLE_WALLET_KEY_FILE = file;
process.env.WALLET_TOKEN_SECRET = 'test-wallet-secret-0123456789-abcdefghij';
export const walletPublicKey = publicKey;
