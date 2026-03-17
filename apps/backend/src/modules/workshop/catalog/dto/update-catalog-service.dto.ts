import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogServiceDto } from './create-catalog-service.dto';

export class UpdateCatalogServiceDto extends PartialType(CreateCatalogServiceDto) {}
