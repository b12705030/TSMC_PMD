import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class UpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  value: string

  // Admin only: override which region to update
  @IsOptional()
  @IsString()
  regionId?: string
}
