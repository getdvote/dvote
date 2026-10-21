import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Category codes the app sends, with the label written to the sheet. */
export const FEEDBACK_CATEGORIES = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  points_rewards: 'Points & rewards',
  account: 'Account',
  other: 'Other',
} as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;

export const FEEDBACK_MAX_LENGTH = 2000;

export class CreateFeedbackDto {
  @ApiProperty({ enum: Object.keys(FEEDBACK_CATEGORIES) })
  @IsIn(Object.keys(FEEDBACK_CATEGORIES))
  category: FeedbackCategory;

  @ApiProperty({
    maxLength: FEEDBACK_MAX_LENGTH,
    example: 'My points did not show up after my last coffee.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(FEEDBACK_MAX_LENGTH)
  message: string;
}

/** How the merchant feels about dvote, picked with the quick feedback (label written to the sheet). */
export const MERCHANT_MOODS = { love: 'Loves it', okay: 'Okay', unhappy: 'Unhappy' } as const;
export type MerchantMood = keyof typeof MERCHANT_MOODS;

export class MerchantFeedbackDto {
  @ApiPropertyOptional({ enum: Object.keys(MERCHANT_MOODS) })
  @IsOptional()
  @IsIn(Object.keys(MERCHANT_MOODS))
  mood?: MerchantMood;

  @ApiProperty({ maxLength: FEEDBACK_MAX_LENGTH, example: 'The rewards page is great, but I miss a print button.' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(FEEDBACK_MAX_LENGTH)
  message: string;
}
