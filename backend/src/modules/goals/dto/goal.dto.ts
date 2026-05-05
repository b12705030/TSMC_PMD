import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator'
import { GoalType, GoalStatus } from '@prisma/client'

export class CreateGoalDto {
  @IsString() @IsNotEmpty()
  title: string

  @IsString() @IsNotEmpty()
  description: string

  @IsString() @IsNotEmpty()
  metric: string

  @IsString() @IsNotEmpty()
  targetValue: string

  @IsString() @IsNotEmpty()
  relevance: string

  @IsDateString()
  dueDate: string

  @IsEnum(GoalType)
  @IsOptional()
  type?: GoalType

  @IsString()
  @IsOptional()
  cycleId?: string
}

export class UpdateGoalDto {
  @IsString() @IsNotEmpty() @IsOptional()
  title?: string

  @IsString() @IsNotEmpty() @IsOptional()
  description?: string

  @IsString() @IsNotEmpty() @IsOptional()
  metric?: string

  @IsString() @IsNotEmpty() @IsOptional()
  targetValue?: string

  @IsString() @IsNotEmpty() @IsOptional()
  relevance?: string

  @IsDateString() @IsOptional()
  dueDate?: string

  @IsEnum(GoalType) @IsOptional()
  type?: GoalType

  @IsEnum(GoalStatus) @IsOptional()
  status?: GoalStatus
}
