import { IsUuid } from '../../common/uuid';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { account_status, staff_role } from '../../generated/prisma/enums.js';

/** Email can't change (it's the login); invite a new account instead. */
export class UpdateStaffDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name?: string;

  @ApiPropertyOptional({ enum: staff_role, enumName: 'StaffRole' })
  @IsOptional()
  @IsEnum(staff_role)
  role?: staff_role;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Move to another branch (branch roles only).',
  })
  @IsOptional()
  @IsUuid()
  branchId?: string;

  @ApiPropertyOptional({
    enum: account_status,
    enumName: 'AccountStatus',
    description: 'disabled = soft delete (blocked on their next request).',
  })
  @IsOptional()
  @IsEnum(account_status)
  status?: account_status;
}
