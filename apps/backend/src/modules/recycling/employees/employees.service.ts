import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from '../../core/auth/user.entity';
import { EmployeePermissionsEntity } from './employee-permissions.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdatePermissionsDto } from './dto/update-permissions.dto';

@Injectable()
export class EmployeesService {
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

  async list(tenantId: string): Promise<UserEntity[]> {
    return this.withSchema(tenantId, async (manager) => {
      const repo = manager.getRepository(UserEntity);
      return repo.find({ where: { tenantId, role: UserRole.EMPLOYEE } });
    });
  }

  async create(tenantId: string, dto: CreateEmployeeDto): Promise<UserEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const permRepo = manager.getRepository(EmployeePermissionsEntity);

      const existing = await userRepo.findOne({ where: { tenantId, email: dto.email } });
      if (existing) throw new ConflictException('E-mail já cadastrado neste tenant.');

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const user = userRepo.create({
        tenantId,
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: UserRole.EMPLOYEE,
      });
      const saved = await userRepo.save(user);

      const perms = permRepo.create({ userId: saved.id });
      await permRepo.save(perms);

      return saved;
    });
  }

  async delete(tenantId: string, userId: string): Promise<void> {
    return this.withSchema(tenantId, async (manager) => {
      const userRepo = manager.getRepository(UserEntity);
      const user = await userRepo.findOne({
        where: { id: userId, tenantId, role: UserRole.EMPLOYEE },
      });
      if (!user) throw new NotFoundException('Funcionário não encontrado.');
      await userRepo.remove(user);
    });
  }

  async getPermissions(tenantId: string, userId: string): Promise<EmployeePermissionsEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const permRepo = manager.getRepository(EmployeePermissionsEntity);
      const perms = await permRepo.findOne({ where: { userId } });
      if (!perms) throw new NotFoundException('Permissões não encontradas.');
      return perms;
    });
  }

  async updatePermissions(
    tenantId: string,
    userId: string,
    dto: UpdatePermissionsDto,
  ): Promise<EmployeePermissionsEntity> {
    return this.withSchema(tenantId, async (manager) => {
      const permRepo = manager.getRepository(EmployeePermissionsEntity);
      const perms = await permRepo.findOne({ where: { userId } });
      if (!perms) throw new NotFoundException('Permissões não encontradas.');
      Object.assign(perms, dto);
      return permRepo.save(perms);
    });
  }
}
