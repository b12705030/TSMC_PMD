import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator'
import { ReviewGrade } from '@prisma/client'

export class CreateAppealDto {
  @IsString() reviewId: string
  @IsString() @MinLength(10) reason: string
}

export class RespondAppealDto {
  @IsString() @MinLength(5) response: string
  @IsOptional() @IsEnum(ReviewGrade) newGrade?: ReviewGrade
}
