import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  StorefrontFeedbackService,
  SubmitStorefrontFeedbackDto,
} from './storefront-feedback.module';

function setup() {
  const db = {
    vendors: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: 'merchant',
          status: 'active',
          storefront: { sections: [{ type: 'feedback' }] },
        }),
    },
    branches: { findFirst: jest.fn() },
    cards: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    users: { create: jest.fn(), update: jest.fn() },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  return { db, service: new StorefrontFeedbackService(db as never) };
}
const input = { name: 'Mona', message: 'Lovely coffee' };

describe('Storefront feedback', () => {
  it('accepts a guest without phone, without creating a customer or card', async () => {
    const { db, service } = setup();
    expect(await service.submit('coffee', input)).toEqual({ received: true });
    expect(db.cards.findFirst).not.toHaveBeenCalled();
    expect(db.users.create).not.toHaveBeenCalled();
    expect(db.cards.create).not.toHaveBeenCalled();
    expect(db.$executeRaw).toHaveBeenCalledWith(
      expect.anything(),
      'merchant',
      null,
      null,
      'Mona',
      null,
      'Lovely coffee',
    );
  });
  it('normalizes a supplied phone and matches cards only within this merchant, without exposing the match', async () => {
    const { db, service } = setup();
    db.cards.findFirst.mockResolvedValue({ id: 'card' });
    expect(
      await service.submit('coffee', { ...input, phone: '010 1234 5678' }),
    ).toEqual({ received: true });
    expect(db.cards.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vendor_id: 'merchant', users: { phone: '+201012345678' } },
      }),
    );
    expect(db.$executeRaw).toHaveBeenCalledWith(
      expect.anything(),
      'merchant',
      null,
      'card',
      'Mona',
      '+201012345678',
      'Lovely coffee',
    );
    expect(db.users.update).not.toHaveBeenCalled();
  });
  it('rejects invalid phone numbers without inserting feedback', async () => {
    const { db, service } = setup();
    await expect(
      service.submit('coffee', { ...input, phone: 'bad' }),
    ).rejects.toMatchObject({ response: { code: 'invalid_phone' } });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it('rejects suspended shops and disabled sections', async () => {
    const { db, service } = setup();
    db.vendors.findUnique.mockResolvedValueOnce({
      id: 'merchant',
      status: 'suspended',
    });
    await expect(service.submit('coffee', input)).rejects.toMatchObject({
      response: { code: 'vendor_not_found' },
    });
    db.vendors.findUnique.mockResolvedValueOnce({
      id: 'merchant',
      status: 'active',
      storefront: null,
    });
    await expect(service.submit('coffee', input)).rejects.toMatchObject({
      response: { code: 'feedback_unavailable' },
    });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it('rejects another merchant’s branch', async () => {
    const { db, service } = setup();
    db.branches.findFirst.mockResolvedValue(null);
    await expect(
      service.submit('coffee', { ...input, branchId: 'branch' }),
    ).rejects.toMatchObject({ response: { code: 'invalid_branch' } });
    expect(db.branches.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'branch', vendor_id: 'merchant', status: 'active' },
      }),
    );
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
  it('uses the branch’s own section settings', async () => {
    const { db, service } = setup();
    db.branches.findFirst.mockResolvedValue({
      id: 'branch',
      storefront: { sections: [{ type: 'loyalty' }] },
    });
    await expect(
      service.submit('coffee', { ...input, branchId: 'branch' }),
    ).rejects.toMatchObject({ response: { code: 'feedback_unavailable' } });
  });
  it('scopes listing to the merchant and assigned branch, and paginates', async () => {
    const { db, service } = setup();
    db.$queryRaw.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => ({ id: String(i) })),
    );
    const result = await service.list(
      {
        vendorId: 'merchant',
        branchId: 'branch',
        staffId: 'staff',
        role: 'branch_manager',
      },
      '2',
    );
    expect(result.items).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(db.$queryRaw).toHaveBeenCalledWith(
      expect.anything(),
      'merchant',
      'branch',
      'branch',
      20,
    );
  });
  it('validates required name/comment after trimming, length and branch UUID', () => {
    for (const body of [
      { name: '  ', message: 'ok' },
      { name: 'Mona', message: '  ' },
      { ...input, message: 'x'.repeat(2001) },
      { ...input, branchId: 'bad' },
    ]) {
      expect(
        validateSync(plainToInstance(SubmitStorefrontFeedbackDto, body)).length,
      ).toBeGreaterThan(0);
    }
    expect(
      validateSync(plainToInstance(SubmitStorefrontFeedbackDto, input)),
    ).toHaveLength(0);
  });
});
