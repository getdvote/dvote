import { config } from './config';
import { supabase } from './supabase';

/**
 * Typed calls to the dvote API used by the staff app.
 * TODO: replace these hand-written types with packages/api-client once it is generated.
 */

export interface StaffMe {
  id: string;
  name: string;
  email: string;
  role: 'vendor_admin' | 'branch_manager' | 'staff';
  vendor: { id: string; name: string; logoUrl: string | null; currency: string };
  branch: { id: string; name: string } | null;
  branches: { id: string; name: string }[];
  activeRule: {
    version: number;
    spendAmount: string;
    pointsPerSpend: number;
    minPurchase: string;
    maxPointsPerPurchase: number | null;
  } | null;
}

export interface ScanPreview {
  purpose: 'collect' | 'redeem';
  usable: boolean;
  reason: string | null;
  vendorQr: boolean;
  expiresAt: string;
}

export interface CollectResult {
  pointEventId: string;
  pointsAdded: number;
  purchaseAmount: string;
  currency: string;
  ruleVersion: number;
  branchId: string;
  branchName: string;
  receiptRef: string | null;
  at: string;
}

/** An error from the API, carrying its stable `code` (e.g. qr_used). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', "Can't reach the server. Check the connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string | string[];
  };
  if (!res.ok) {
    const code = json.code ?? (res.status === 400 ? 'invalid_input' : `http_${res.status}`);
    const serverMessage = Array.isArray(json.message) ? json.message.join(', ') : json.message;
    throw new ApiError(res.status, code, friendlyMessage(code, serverMessage));
  }
  return json as T;
}

export const api = {
  me: () => call<StaffMe>('GET', '/api/vendor/staff/me'),
  preview: (code: string) => call<ScanPreview>('POST', '/api/vendor/scans/preview', { code }),
  collect: (body: {
    code: string;
    amount: number;
    branchId?: string;
    idempotencyKey: string;
  }) => call<CollectResult>('POST', '/api/vendor/scans/collect', body),
};

/** What staff see for each error code. */
export function friendlyMessage(code: string, serverMessage?: string): string {
  const messages: Record<string, string> = {
    qr_invalid: 'This is not a dvote QR code.',
    qr_used: 'This QR was already used. Ask the customer to show a new one.',
    qr_expired: 'This QR has expired. Ask the customer to show a new one.',
    qr_cancelled: 'The customer opened a newer QR. Please scan the new one.',
    wrong_qr_type: 'This QR is not for collecting points.',
    vendor_mismatch: 'This QR belongs to another shop.',
    user_blocked: "This customer's account is blocked.",
    no_active_rule: 'Your shop has no point rule yet. Ask your manager to set one.',
    duplicate_receipt: 'This receipt already earned points.',
    branch_required: 'Choose your branch first.',
    invalid_branch: 'This branch is not available.',
    forbidden_branch: 'You can only add points at your own branch.',
    not_staff: 'This account is not a staff account.',
    staff_disabled: 'Your staff account is disabled. Ask your manager.',
    vendor_suspended: 'Your shop is suspended on dvote.',
    branch_closed: 'Your branch is closed on dvote.',
    token_expired: 'Your session expired. Please log in again.',
    invalid_token: 'Please log in again.',
    missing_token: 'Please log in again.',
  };
  return messages[code] ?? serverMessage ?? 'Something went wrong. Please try again.';
}

/** Codes that mean the login is no longer valid: go back to the login page. */
export const SIGN_OUT_CODES = new Set([
  'token_expired',
  'invalid_token',
  'missing_token',
  'not_staff',
  'staff_disabled',
  'vendor_suspended',
  'branch_closed',
]);
