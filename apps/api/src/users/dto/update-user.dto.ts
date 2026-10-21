import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { user_gender } from '../../generated/prisma/enums.js';

/** A real calendar date "YYYY-MM-DD", from 1900-01-01 up to today. */
export function isBirthDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false; // e.g. 2001-02-30
  // "today" anywhere on earth: allow up to UTC+14, so nobody born today is rejected
  const latest = new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10);
  return value >= '1900-01-01' && value <= latest;
}

const IsBirthDate = () =>
  ValidateBy({
    name: 'isBirthDate',
    validator: {
      validate: isBirthDate,
      defaultMessage: () =>
        'birthDate must be a real date YYYY-MM-DD, not in the future',
    },
  });

export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 120, example: 'Mona Ali' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255, example: 'mona@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'International format, digits with optional leading +',
    example: '+201001234567',
  })
  @IsOptional()
  @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be 7-15 digits' })
  phone?: string;

  @ApiPropertyOptional({
    enum: user_gender,
    enumName: 'UserGender',
    nullable: true,
    description: 'null clears it',
  })
  @IsOptional()
  @IsIn(Object.values(user_gender))
  gender?: user_gender | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    example: '1995-04-12',
    description: 'YYYY-MM-DD, not in the future; null clears it',
  })
  @IsOptional()
  @IsBirthDate()
  birthDate?: string | null;
}
