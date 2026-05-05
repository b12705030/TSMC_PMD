import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export class ReviewAnswerDto {
  @IsString() questionId: string
  @IsString() answer: string
}

export class SaveAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewAnswerDto)
  answers: ReviewAnswerDto[]
}

export class SaveSupervisorReviewDto {
  @IsOptional() @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewAnswerDto)
  answers?: ReviewAnswerDto[]

  @IsOptional() @IsString()
  comment?: string

  @IsOptional() @IsEnum(['O', 'S_Plus', 'S', 'S_Minus', 'I', 'U'])
  grade?: 'O' | 'S_Plus' | 'S' | 'S_Minus' | 'I' | 'U'
}

export class CalibrateDto {
  @IsEnum(['O', 'S_Plus', 'S', 'S_Minus', 'I', 'U'])
  grade: 'O' | 'S_Plus' | 'S' | 'S_Minus' | 'I' | 'U'

  @IsOptional() @IsNumber()
  rank?: number
}
