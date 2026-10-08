import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { validateEnv } from '../config/env.validation';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackService } from './feedback.service';

function service(env: Record<string, string | undefined>) {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new FeedbackService(config as never);
}

const configured = {
  FEEDBACK_SHEET_URL: 'https://script.google.com/macros/s/abc/exec',
  FEEDBACK_SHEET_SECRET: 'shh',
};

function mockFetch(status: number, body: unknown) {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

afterEach(() => jest.restoreAllMocks());

describe('FeedbackService', () => {
  it('posts the row to the sheet script with the secret and category label', async () => {
    const fetch = mockFetch(200, { ok: true });
    await service(configured).send('u1', {
      category: 'points_rewards',
      message: 'Points missing',
    });
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(configured.FEEDBACK_SHEET_URL);
    expect(JSON.parse(init.body as string)).toMatchObject({
      secret: 'shh',
      userId: 'u1',
      category: 'Points & rewards',
      message: 'Points missing',
    });
  });

  it('503 feedback_not_configured when the sheet is not set up', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    await expect(
      service({}).send('u1', { category: 'bug', message: 'x' }),
    ).rejects.toMatchObject({
      response: { code: 'feedback_not_configured' },
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('503 feedback_unavailable when the script rejects (e.g. wrong secret)', async () => {
    mockFetch(200, { ok: false, error: 'unauthorized' });
    await expect(
      service(configured).send('u1', { category: 'bug', message: 'x' }),
    ).rejects.toMatchObject({ response: { code: 'feedback_unavailable' } });
  });

  it('503 feedback_unavailable when Google cannot be reached', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    await expect(
      service(configured).send('u1', { category: 'bug', message: 'x' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('CreateFeedbackDto', () => {
  const errors = (body: object) =>
    validateSync(plainToInstance(CreateFeedbackDto, body)).map(
      (e) => e.property,
    );

  it('accepts a known category and trims the message', () => {
    const dto = plainToInstance(CreateFeedbackDto, {
      category: 'bug',
      message: '  App froze  ',
    });
    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.message).toBe('App froze');
  });

  it('rejects unknown categories, blank and over-long messages', () => {
    expect(errors({ category: 'spam', message: 'hi' })).toEqual(['category']);
    expect(errors({ category: 'bug', message: '   ' })).toEqual(['message']);
    expect(errors({ category: 'bug', message: 'x'.repeat(2001) })).toEqual([
      'message',
    ]);
  });
});

describe('FEEDBACK_SHEET_URL env', () => {
  const base = {
    DATABASE_URL: 'postgresql://x',
    SUPABASE_URL: 'https://p.supabase.co',
  };

  it('treats an empty value as unset, so the API still boots', () => {
    expect(
      validateEnv({ ...base, FEEDBACK_SHEET_URL: '' }).FEEDBACK_SHEET_URL,
    ).toBeUndefined();
  });

  it('rejects a value that is not a URL', () => {
    expect(() =>
      validateEnv({ ...base, FEEDBACK_SHEET_URL: 'not a url' }),
    ).toThrow(/FEEDBACK_SHEET_URL/);
  });
});
