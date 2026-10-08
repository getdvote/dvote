import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

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
}
