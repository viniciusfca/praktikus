import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from './product.entity';
import { PriceTableEntity } from '../price-tables/price-table.entity';
import { numericTransformer } from '../common/numeric-transformer';

@Entity({ name: 'product_prices' })
export class ProductPriceEntity {
  @PrimaryColumn({ name: 'product_id', type: 'uuid' })
  productId: string;

  @PrimaryColumn({ name: 'price_table_id', type: 'uuid' })
  priceTableId: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  price: number;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(() => PriceTableEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'price_table_id' })
  priceTable: PriceTableEntity;
}
