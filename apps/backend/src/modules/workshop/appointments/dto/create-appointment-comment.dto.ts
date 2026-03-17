import { IsString, MinLength } from 'class-validator';

export class CreateAppointmentCommentDto {
  @IsString()
  @MinLength(1)
  texto: string;
}
