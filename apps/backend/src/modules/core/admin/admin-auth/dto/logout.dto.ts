import { IsNotEmpty, IsString } from 'class-validator';

export class PlatformLogoutDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
