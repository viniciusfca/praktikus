import { IsNumber, Max, Min } from 'class-validator';

export class OpenCashSessionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  openingBalance: number;
}
