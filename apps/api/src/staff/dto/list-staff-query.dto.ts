import { IsUuid } from '../../common/uuid';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { account_status, staff_role } from '../../generated/prisma/enums.js';

export class ListStaffQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiPropertyOptional({ enum: staff_role, enumName: 'StaffRole' })
  @IsOptional()
  @IsEnum(staff_role)
  role?: staff_role;

  @ApiPropertyOptional({ enum: account_status, enumName: 'AccountStatus' })
  @IsOptional()
  @IsEnum(account_status)
  status?: account_status;
}
