import { IsEmail, IsEnum, IsString } from 'class-validator'
import { Role } from '../../../common/enums/role.enum'

export class CreateUserDto {
  @IsString() employeeId: string
  @IsString() name: string
  @IsEmail()  email: string
  @IsEnum(Role) role: Role
  @IsString() regionId: string
  @IsString() departmentId: string
  @IsString() jobLevel: string
  @IsString() jobTitle: string
}
