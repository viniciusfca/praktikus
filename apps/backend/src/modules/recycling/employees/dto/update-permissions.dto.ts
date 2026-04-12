import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePermissionsDto {
  @IsOptional() @IsBoolean() canManageSuppliers?: boolean;
  @IsOptional() @IsBoolean() canManageBuyers?: boolean;
  @IsOptional() @IsBoolean() canManageProducts?: boolean;
  @IsOptional() @IsBoolean() canOpenCloseCash?: boolean;
  @IsOptional() @IsBoolean() canViewStock?: boolean;
  @IsOptional() @IsBoolean() canViewReports?: boolean;
  @IsOptional() @IsBoolean() canRegisterPurchases?: boolean;
  @IsOptional() @IsBoolean() canRegisterSales?: boolean;
}
