import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRewardDto, UpdateRewardDto, RewardResponseDto } from './dto/reward.dto';
import { RewardsService } from './rewards.service';
import { Prisma } from '../generated/prisma/client.js';

describe('Reward retail value', () => {
  it('accepts optional, cleared and two-decimal prices; rejects invalid prices', async () => {
    for (const retailValue of [undefined, null, 70, 70.25]) {
      expect(await validate(plainToInstance(CreateRewardDto, { name: 'Coffee', pointsCost: 300, retailValue }))).toHaveLength(0);
    }
    for (const retailValue of [0, -1, 70.123, 100000000, 'no', Infinity]) {
      expect((await validate(plainToInstance(CreateRewardDto, { name: 'Coffee', pointsCost: 300, retailValue }))).length).toBeGreaterThan(0);
    }
    expect(await validate(plainToInstance(UpdateRewardDto, { retailValue: null }))).toHaveLength(0);
  });

  it('preserves decimal prices and null in responses', () => {
    const row = { retail_value: new Prisma.Decimal('70.25'), created_at: new Date() };
    expect(RewardResponseDto.from(row as never).retailValue).toBe('70.25');
    expect(RewardResponseDto.from({ ...row, retail_value: null } as never).retailValue).toBeNull();
  });

  it('creates, updates and explicitly clears the value while omitted updates leave it alone', async () => {
    const calls: any[] = [];
    const prisma = {
      vendors: { findUnique: async () => ({ id: 'vendor' }) },
      rewards: {
        aggregate: async () => ({ _max: { sort_order: 0 } }),
        findUnique: async () => ({ id: 'reward', vendor_id: 'vendor' }),
        create: async (args: any) => { calls.push(args.data); return args.data; },
        update: async (args: any) => { calls.push(args.data); return args.data; },
      },
    };
    const service = new RewardsService(prisma as never, {} as never);
    await service.create('vendor', { name: 'Coffee', pointsCost: 300, retailValue: 70 });
    await service.update('reward', { retailValue: 75 }, 'vendor');
    await service.update('reward', { retailValue: null }, 'vendor');
    await service.update('reward', { name: 'Tea' }, 'vendor');
    expect(calls.map((c) => c.retail_value)).toEqual([70, 75, null, undefined]);
  });
});
