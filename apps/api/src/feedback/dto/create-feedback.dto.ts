import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
