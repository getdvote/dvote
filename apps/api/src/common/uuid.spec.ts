import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsUuid, ParseUuidPipe } from './uuid';

class Dto {
  @IsUuid()
  id: string;
}

const ok = [
  '11111111-0000-0000-0000-000000000001', // hand-written seed ids (version digit 0)
  '22222222-0000-0000-0000-000000000001',
  '78D45557-13B6-4340-8426-306064639785', // random v4, any case
];
const bad = [
  '',
  'abc',
  '22222222-0000-0000-0000-00000000000',
  '22222222000000000000000000000001',
  'zzzzzzzz-0000-0000-0000-000000000001',
];

describe('UUID validation (matches what PostgreSQL accepts)', () => {
  it.each(ok)('accepts %s', (id) => {
    expect(validateSync(plainToInstance(Dto, { id }))).toHaveLength(0);
    expect(new ParseUuidPipe().transform(id)).toBe(id);
  });

  it.each(bad)('rejects %j', (id) => {
    expect(validateSync(plainToInstance(Dto, { id }))[0]?.constraints).toEqual({
      matches: 'id must be a UUID',
    });
    expect(() => new ParseUuidPipe().transform(id)).toThrow(
      BadRequestException,
    );
  });
});
