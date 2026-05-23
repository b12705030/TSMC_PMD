import { IsEnum, IsOptional, IsString } from 'class-validator'
import { Role } from '../../../common/enums/role.enum'

export class UpdateUserDto {
  @IsOptional() @IsEnum(Role)   role?: Role
  @IsOptional() @IsString()     regionId?: string
  @IsOptional() @IsString()     departmentId?: string
  @IsOptional() @IsString()     jobLevel?: string
  @IsOptional() @IsString()     jobTitle?: string
}
