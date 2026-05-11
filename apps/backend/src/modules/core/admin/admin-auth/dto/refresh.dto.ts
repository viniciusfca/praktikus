import { IsNotEmpty, IsString } from 'class-validator';

export class PlatformRefreshDto {
  @IsString()
  @IsNotEmpty()
  refresh_token!: string;
}
