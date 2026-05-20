import { IsString, IsNotEmpty, IsDateString, IsOptional, IsArray, Validate } from 'class-validator'
import { ValidatorConstraint } from 'class-validator'
import type { ValidationArguments, ValidatorConstraintInterface } from 'class-validator'

@ValidatorConstraint({ name: 'updateDateRange' })
class UpdateDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as UpdateCycleDto
    if (!obj.goalSettingStart || !obj.goalSettingEnd || !obj.reviewStart || !obj.reviewEnd) return true
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

export class UpdateCycleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  regions?: string[]

  @IsOptional()
  @IsDateString()
  goalSettingStart?: string

  @IsOptional()
  @IsDateString()
  goalSettingEnd?: string

  @IsOptional()
  @IsDateString()
  reviewStart?: string

  @IsOptional()
  @IsDateString()
  @Validate(UpdateDateRangeConstraint)
  reviewEnd?: string
}
