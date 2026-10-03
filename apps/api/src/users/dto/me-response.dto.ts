import { ApiProperty } from '@nestjs/swagger';
import type { users } from '../../generated/prisma/client.js';

/** The signed-in customer's profile as returned to the mobile app. */
export class MeResponseDto {
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

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty()
  createdAt: string;

  static from(user: users): MeResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at.toISOString(),
    };
  }
}
