import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MaxLength(10)
  abbreviation: string;
}
