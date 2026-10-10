import { Controller, Get, Module, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module';
import { CurrentStaff } from '../auth/current-staff.decorator';
import { StaffRoles, type StaffContext } from '../auth/staff-auth.guard';
import { VendorApi } from '../auth/vendor-api.decorator';
import { ParseUuidPipe } from '../common/uuid';
import {
  CustomerListQuery,
  CustomerScopeQuery,
  MerchantCustomerListDto,
  MerchantCustomerDetailDto,
} from './customer.dto';
import { MerchantCustomersService } from './merchant-customers.service';

@VendorApi('vendor: customers')
@StaffRoles('vendor_admin', 'branch_manager')
@Controller('vendor/customers')
export class MerchantCustomersController {
  constructor(private readonly customers: MerchantCustomersService) {}

  @Get()
  @ApiOkResponse({ type: MerchantCustomerListDto })
  list(@CurrentStaff() ctx: StaffContext, @Query() q: CustomerListQuery) {
    return this.customers.list(ctx, q);
  }

  @Get(':id')
  @ApiOkResponse({ type: MerchantCustomerDetailDto })
  @ApiNotFoundResponse({
    description:
      'customer_not_found (including customers outside the merchant or branch)',
  })
  detail(
    @CurrentStaff() ctx: StaffContext,
    @Param('id', ParseUuidPipe) id: string,
    @Query() q: CustomerScopeQuery,
  ) {
    return this.customers.detail(ctx, id, q);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [MerchantCustomersController],
  providers: [MerchantCustomersService],
})
export class MerchantCustomersModule {}
