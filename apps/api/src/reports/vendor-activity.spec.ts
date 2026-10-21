import { VendorActivityService } from './vendor-activity';
describe('Activity history lookup', () => {
  it('scopes a single event to the merchant and manager branch without a date restriction', async () => {
    const db = {
      point_events: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new VendorActivityService(db as never);
    await service.list(
      {
        staffId: 'staff',
        vendorId: 'mine',
        branchId: 'assigned',
        role: 'branch_manager',
      },
      { eventId: 'event', branchId: 'other' },
    );
    expect(db.point_events.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event', vendor_id: 'mine', branch_id: 'assigned' },
      }),
    );
  });
});
