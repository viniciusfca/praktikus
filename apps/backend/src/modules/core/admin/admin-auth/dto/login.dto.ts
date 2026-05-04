import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória.' })
  @MinLength(6, { message: 'Senha muito curta.' })
  password!: string;
}
