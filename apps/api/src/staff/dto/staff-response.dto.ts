import { ApiProperty } from '@nestjs/swagger';
import type { staff_users } from '../../generated/prisma/client.js';
import { account_status, staff_role } from '../../generated/prisma/enums.js';

export class StaffResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  vendorId: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null for vendor_admin',
  })
  branchId: string | null;

  @ApiProperty({ example: 'Sara Hassan' })
  name: string;

  @ApiProperty({ example: 'sara@joycorner.com' })
  email: string;

  @ApiProperty({ enum: staff_role, enumName: 'StaffRole' })
  role: staff_role;

  @ApiProperty({ enum: account_status, enumName: 'AccountStatus' })
  status: account_status;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  static from(s: staff_users): StaffResponseDto {
    return {
      id: s.id,
      vendorId: s.vendor_id,
      branchId: s.branch_id,
      name: s.name,
      email: s.email,
      role: s.role,
      status: s.status,
      createdAt: s.created_at.toISOString(),
      updatedAt: s.updated_at.toISOString(),
    };
  }
}

export class CreateStaffResponseDto extends StaffResponseDto {
  @ApiProperty({
    description:
      'true: an invite email was sent. false: the email already had an account ' +
      '(e.g. Google sign-in), so no email was sent and they sign in with that.',
  })
  invited: boolean;
}
