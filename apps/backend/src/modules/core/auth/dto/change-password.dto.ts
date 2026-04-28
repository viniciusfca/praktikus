import { IsString, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../validation';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsStrongPassword()
  newPassword: string;
}
