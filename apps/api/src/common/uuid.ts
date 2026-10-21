import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { Matches } from 'class-validator';

/**
 * Any UUID PostgreSQL accepts (8-4-4-4-12 hex), not only RFC versions 1–8.
 * class-validator's IsUUID / Nest's ParseUUIDPipe reject ids like the seed's
 * 11111111-0000-0000-0000-000000000001 (version digit 0) although the DB stores them fine.
 */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DTO field validator: use instead of class-validator's @IsUUID(). */
export const IsUuid = () =>
  Matches(UUID_PATTERN, { message: '$property must be a UUID' });

/** Route param pipe: use instead of Nest's ParseUUIDPipe. */
@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID_PATTERN.test(value)) {
      throw new BadRequestException('Validation failed (uuid is expected)');
    }
    return value;
  }
}
