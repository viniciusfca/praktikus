import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogPartDto } from './create-catalog-part.dto';

export class UpdateCatalogPartDto extends PartialType(CreateCatalogPartDto) {}
