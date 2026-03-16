import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CustomerEntity } from './customer.entity';
import { VehicleEntity } from '../vehicles/vehicle.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async withSchema<T>(
    tenantId: string,
    fn: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const schemaName = this.getSchemaName(tenantId);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      return await fn(qr.manager);
    } finally {
      await qr.release();
    }
  }

  async list(tenantId: string, page: number, limit: number, search?: string) {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const qb = repo.createQueryBuilder('c');
      if (search) {
        qb.where('c.nome ILIKE :s OR c.cpf_cnpj ILIKE :s', {
          s: `%${search}%`,
        });
      }
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('c.nome', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<CustomerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      return customer;
    });
  }

  async create(tenantId: string, dto: CreateCustomerDto): Promise<CustomerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const customer = repo.create({
        nome: dto.nome,
        cpfCnpj: dto.cpfCnpj,
        whatsapp: dto.whatsapp ?? null,
        email: dto.email ?? null,
      });
      return repo.save(customer);
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(CustomerEntity);
      const customer = await repo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');
      const patch = dto as Partial<CreateCustomerDto>;
      Object.assign(customer, {
        ...(patch.nome !== undefined && { nome: patch.nome }),
        ...(patch.cpfCnpj !== undefined && { cpfCnpj: patch.cpfCnpj }),
        ...(patch.whatsapp !== undefined && { whatsapp: patch.whatsapp }),
        ...(patch.email !== undefined && { email: patch.email }),
      });
      return repo.save(customer);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const customerRepo = manager.getRepository(CustomerEntity);
      const vehicleRepo = manager.getRepository(VehicleEntity);

      const customer = await customerRepo.findOne({ where: { id } });
      if (!customer) throw new NotFoundException('Cliente não encontrado.');

      const vehicleCount = await vehicleRepo.count({
        where: { customerId: id },
      });
      if (vehicleCount > 0) {
        throw new ConflictException(
          'Não é possível excluir um cliente com veículos cadastrados.',
        );
      }

      await customerRepo.remove(customer);
    });
  }
}
