import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { QuestionType } from '@prisma/client'

export class BaseQuestionDto {
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

  @IsInt()
  @Min(0)
  orderIndex: number

  @IsBoolean()
  @IsOptional()
  isGlobal?: boolean
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsString()
  @IsNotEmpty()
  cycleId: string

  @IsString()
  @IsOptional()
  regionId?: string

  @IsArray()
  @IsString({ each: true })
  appliesGrades: string[]

  @IsArray()
  @IsString({ each: true })
  applyTitles: string[]

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BaseQuestionDto)
  questions: BaseQuestionDto[]
}
