import { IsOptional, IsString, MinLength } from 'class-validator'

export class CreateAppealDto {
  @IsString() reviewId: string
  @IsString() @MinLength(10) reason: string
}

export class RespondAppealDto {
  @IsString() @MinLength(5) response: string
  @IsOptional() @IsString() newGrade?: string
}
