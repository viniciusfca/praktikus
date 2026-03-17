import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { VehicleEntity } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
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

  async list(
    tenantId: string,
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ data: VehicleEntity[]; total: number; page: number; limit: number }> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const qb = repo.createQueryBuilder('v');
      if (search) {
        qb.where(
          'v.placa ILIKE :s OR v.marca ILIKE :s OR v.modelo ILIKE :s',
          { s: `%${search}%` },
        );
      }
      const [data, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('v.placa', 'ASC')
        .getManyAndCount();
      return { data, total, page, limit };
    });
  }

  async getById(tenantId: string, id: string): Promise<VehicleEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = await repo.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
      return vehicle;
    });
  }

  async create(tenantId: string, dto: CreateVehicleDto): Promise<VehicleEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = repo.create({
        customerId: dto.customerId,
        placa: dto.placa,
        marca: dto.marca,
        modelo: dto.modelo,
        ano: dto.ano,
        km: dto.km,
      });
      return repo.save(vehicle);
    });
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<CreateVehicleDto>,
  ): Promise<VehicleEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = await repo.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
      Object.assign(vehicle, {
        ...(dto.placa !== undefined && { placa: dto.placa }),
        ...(dto.marca !== undefined && { marca: dto.marca }),
        ...(dto.modelo !== undefined && { modelo: dto.modelo }),
        ...(dto.ano !== undefined && { ano: dto.ano }),
        ...(dto.km !== undefined && { km: dto.km }),
      });
      return repo.save(vehicle);
    });
  }

  async delete(tenantId: string, id: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(VehicleEntity);
      const vehicle = await repo.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Veículo não encontrado.');
      await repo.remove(vehicle);
    });
  }
}
