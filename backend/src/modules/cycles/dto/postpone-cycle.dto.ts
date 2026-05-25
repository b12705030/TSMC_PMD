import { IsDateString } from 'class-validator'

export class PostponeCycleDto {
  @IsDateString()
  newReviewStart: string
}
