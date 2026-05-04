import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TenantSegment } from '@praktikus/shared';
import { TenantStatus } from '../../../tenancy/tenant.entity';

export class ListTenantsQueryDto {
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsEnum(TenantSegment)
  segment?: TenantSegment;

  @IsOptional()
  @IsIn(['yes', 'no'])
  wpp?: 'yes' | 'no';

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 25;
}
