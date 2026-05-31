import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { ReviewGrade } from '@prisma/client'

export class CreateAppealDto {
  @IsString() reviewId: string
  @IsString() @MinLength(10) @MaxLength(2000) reason: string
}

export class RespondAppealDto {
  @IsString() @MinLength(5) @MaxLength(2000) response: string
  @IsOptional() @IsEnum(ReviewGrade) newGrade?: ReviewGrade
}
