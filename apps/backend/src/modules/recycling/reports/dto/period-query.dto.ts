import { IsDateString, IsNotEmpty } from 'class-validator';

export class PeriodQueryDto {
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}
