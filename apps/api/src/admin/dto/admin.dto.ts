import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { user_gender, user_status } from '../../generated/prisma/enums.js';

export class AdminMeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Karim' })
  name: string;

  @ApiProperty({ example: 'karim+admin@gmail.com' })
  email: string;
}

export class OverviewDayDto {
  @ApiProperty({ example: '2026-10-08', description: 'Day in Cairo time' })
  date: string;

  @ApiProperty({ example: 120 })
  pointsEarned: number;

  @ApiProperty({ example: 9 })
  collects: number;

  @ApiProperty({ example: 3 })
  newCustomers: number;
}

export class OverviewTopVendorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({ description: 'Points earned in the last 30 days' })
  pointsEarned: number;

  @ApiProperty({ description: 'Collects in the last 30 days' })
  collects: number;
}

/** The admin dashboard's home: totals, last 14 days, busiest shops. */
export class OverviewResponseDto {
  @ApiProperty() vendorsActive: number;
  @ApiProperty() vendorsSuspended: number;
  @ApiProperty() branchesOpen: number;
  @ApiProperty() customers: number;
  @ApiProperty() customersBlocked: number;
  @ApiProperty({ description: 'Signed up in the last 7 days' }) customersNew7d: number;
  @ApiProperty() cards: number;
  @ApiProperty({ description: 'All points ever earned' }) pointsEarned: number;
  @ApiProperty({ description: 'All points ever spent on rewards' }) pointsRedeemed: number;
  @ApiProperty({ description: 'Points customers hold right now' }) pointsOutstanding: number;
  @ApiProperty({ description: 'Collects today (Cairo time)' }) collectsToday: number;
  @ApiProperty({ type: [OverviewDayDto], description: 'Oldest first, 14 days including today' }) days: OverviewDayDto[];
  @ApiProperty({ type: [OverviewTopVendorDto] }) topVendors: OverviewTopVendorDto[];
}

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Name, email or phone (part of it)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: user_status, enumName: 'UserStatus' })
  @IsOptional()
  @IsIn(Object.values(user_status))
  status?: user_status;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class AdminUserListItemDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: String, nullable: true }) name: string | null;
  @ApiProperty({ type: String, nullable: true }) email: string | null;
  @ApiProperty({ type: String, nullable: true }) phone: string | null;
  @ApiProperty({ enum: user_status, enumName: 'UserStatus' }) status: user_status;
  @ApiProperty({ type: String, nullable: true, description: 'Sign-in provider photo' }) avatarUrl: string | null;
  @ApiProperty() cardsCount: number;
  @ApiProperty({ description: 'Points held across all cards' }) pointsBalance: number;
  @ApiProperty({ type: String, nullable: true }) lastActivityAt: string | null;
  @ApiProperty() createdAt: string;
}

export class AdminUserListDto {
  @ApiProperty({ type: [AdminUserListItemDto] }) items: AdminUserListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
}

export class AdminUserCardDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) vendorId: string;
  @ApiProperty() vendorName: string;
  @ApiProperty({ type: String, nullable: true }) vendorLogoUrl: string | null;
  @ApiProperty() balance: number;
  @ApiProperty() lifetimePoints: number;
  @ApiProperty() lastActivityAt: string;
}

export class AdminUserEventDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ['earn', 'redeem', 'adjust'] }) type: 'earn' | 'redeem' | 'adjust';
  @ApiProperty() delta: number;
  @ApiProperty() vendorName: string;
  @ApiProperty({ type: String, nullable: true }) branchName: string | null;
  @ApiProperty({ type: String, nullable: true, example: '95.00' }) purchaseAmount: string | null;
  @ApiProperty({ type: String, nullable: true }) rewardName: string | null;
  @ApiProperty({ type: String, nullable: true, description: 'Reason of an admin correction' }) reason: string | null;
  @ApiProperty() createdAt: string;
}

export class AdminUserDetailDto extends AdminUserListItemDto {
  @ApiProperty({ enum: user_gender, enumName: 'UserGender', nullable: true }) gender: user_gender | null;
  @ApiProperty({ type: String, nullable: true, format: 'date' }) birthDate: string | null;
  @ApiProperty({ type: [AdminUserCardDto] }) cards: AdminUserCardDto[];
  @ApiProperty({ type: [AdminUserEventDto], description: 'Latest 30 point events, newest first' }) events: AdminUserEventDto[];
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: user_status, enumName: 'UserStatus', description: 'blocked = can no longer use the app' })
  @IsIn(Object.values(user_status))
  status: user_status;
}
