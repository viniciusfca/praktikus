import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateColetaCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  texto: string;
}
