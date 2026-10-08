import { ApiProperty } from '@nestjs/swagger';
import type { users } from '../../generated/prisma/client.js';
import { user_gender } from '../../generated/prisma/enums.js';

/** The signed-in customer's profile as returned to the mobile app. */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true, example: 'Mona Ali' })
  name: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'From the sign-in provider; null if the provider shared none',
  })
  email: string | null;

  @ApiProperty({ type: String, nullable: true, example: '+201001234567' })
  phone: string | null;

  @ApiProperty({
    enum: user_gender,
    enumName: 'UserGender',
    nullable: true,
  })
  gender: user_gender | null;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '1995-04-12',
  })
  birthDate: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  createdAt: string;

  static from(user: users): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      birthDate: user.birth_date?.toISOString().slice(0, 10) ?? null,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at.toISOString(),
    };
  }
}
