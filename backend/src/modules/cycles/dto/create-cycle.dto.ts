import { IsEnum, IsString, IsDateString, IsNotEmpty, IsOptional, Validate } from 'class-validator'
import { CycleType } from '@prisma/client'
import { ValidatorConstraint } from 'class-validator'
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'dateRange' })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as CreateCycleDto
    const gStart = new Date(obj.goalSettingStart)
    const gEnd   = new Date(obj.goalSettingEnd)
    const rStart = new Date(obj.reviewStart)
    const rEnd   = new Date(obj.reviewEnd)
    return gEnd > gStart && rStart >= gEnd && rEnd > rStart
  }

  defaultMessage() {
    return 'Invalid date range: goalSettingEnd must be after goalSettingStart, reviewStart must be >= goalSettingEnd, reviewEnd must be after reviewStart'
  }
}

export class CreateCycleDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsEnum(CycleType)
  type: CycleType

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  regionId?: string

  @IsDateString()
  goalSettingStart: string

  @IsDateString()
  goalSettingEnd: string

  @IsDateString()
  reviewStart: string

  @IsDateString()
  @Validate(DateRangeConstraint)
  reviewEnd: string
}
