import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../validation';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsStrongPassword()
  newPassword: string;
}
