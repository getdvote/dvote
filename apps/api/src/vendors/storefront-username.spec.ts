import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '../generated/prisma/client.js';
import { StorefrontUsernameDto } from './dto/storefront-username.dto';
import { VendorsService } from './vendors.service';

function setup() {
  const db = {
    $queryRaw: jest.fn().mockResolvedValue([{ reserved: false }]),
    vendors: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: 'mine', slug: 'my-shop' }),
    },
  };
  return {
    db,
    service: new VendorsService(db as never, {} as never, {} as never),
  };
}
describe('Storefront usernames', () => {
  it('validates and normalizes both query and save values', () => {
    const dto = plainToInstance(StorefrontUsernameDto, {
      username: ' My-Shop ',
    });
    expect(dto.username).toBe('my-shop');
    expect(validateSync(dto)).toHaveLength(0);
    for (const username of [
      null,
      '',
      'a',
      '-shop',
      'shop--test',
      'shop/name',
      'x'.repeat(51),
    ]) {
      expect(
        validateSync(plainToInstance(StorefrontUsernameDto, { username }))
          .length,
      ).toBeGreaterThan(0);
    }
  });
  it('rejects reserved names and another merchant’s username', async () => {
    const { db, service } = setup();
    db.$queryRaw.mockResolvedValueOnce([{ reserved: true }]);
    expect(await service.usernameAvailability('mine', 'admin')).toEqual({
      available: false,
    });
    db.vendors.findUnique.mockResolvedValue({ id: 'other' });
    await expect(
      service.reserveUsername('mine', 'other-shop'),
    ).rejects.toMatchObject({ response: { code: 'username_taken' } });
    expect(db.vendors.update).not.toHaveBeenCalled();
  });
  it('allows keeping your own username and scopes updates to your merchant', async () => {
    const { db, service } = setup();
    db.vendors.findUnique.mockResolvedValue({ id: 'mine' });
    expect(await service.usernameAvailability('mine', 'my-shop')).toEqual({
      available: true,
    });
    await service.reserveUsername('mine', 'my-shop');
    expect(db.vendors.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mine' },
        data: { slug: 'my-shop' },
      }),
    );
  });
  it('handles a race when another merchant reserves the name after the availability check', async () => {
    const { db, service } = setup();
    db.vendors.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: '7.10.0',
      }),
    );
    await expect(
      service.reserveUsername('mine', 'my-shop'),
    ).rejects.toMatchObject({ response: { code: 'username_taken' } });
  });
});
