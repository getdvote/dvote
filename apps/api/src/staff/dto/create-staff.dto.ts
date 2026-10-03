import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { staff_role } from '../../generated/prisma/enums.js';

export class CreateStaffDto {
  @ApiProperty({ maxLength: 120, example: 'Sara Hassan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiProperty({ maxLength: 255, example: 'sara@joycorner.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({ enum: staff_role, enumName: 'StaffRole' })
  @IsEnum(staff_role)
  role: staff_role;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for branch_manager and staff; must be omitted for vendor_admin. ' +
      'Branch managers may omit it (defaults to their own branch).',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
