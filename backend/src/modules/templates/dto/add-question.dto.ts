import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { QuestionType } from '@prisma/client'

export class AddCustomQuestionDto {
  @IsString()
  @IsNotEmpty({ message: '題目內容不得為空' })
  questionText: string

  @IsEnum(QuestionType)
  questionType: QuestionType

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  options?: string[]

  @IsBoolean()
  required: boolean
}
