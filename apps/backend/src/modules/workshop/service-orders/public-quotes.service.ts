import { ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ServiceOrderEntity } from './service-order.entity';
import { SoItemServiceEntity } from './so-item-service.entity';
import { SoItemPartEntity } from './so-item-part.entity';

@Injectable()
export class PublicQuotesService {
  constructor(private readonly dataSource: DataSource) {}

  private getSchemaName(tenantId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('Invalid tenantId');
    }
    return `tenant_${tenantId.replace(/-/g, '')}`;
  }

  private async lookupToken(token: string) {
    const rows: Array<{ tenant_id: string; so_id: string; expires_at: string; used_at: string | null }> =
      await this.dataSource.query(
        `SELECT tenant_id, so_id, expires_at, used_at FROM public.service_order_approval_tokens WHERE token = $1`,
        [token],
      );
    if (!rows.length) throw new NotFoundException('Token inválido.');
    const row = rows[0];
    if (row.used_at) throw new ConflictException('Token já utilizado.');
    if (new Date(row.expires_at) < new Date()) throw new GoneException('Token expirado.');
    return row;
  }

  async getQuote(token: string) {
    const { tenant_id, so_id } = await this.lookupToken(token);
    const schemaName = this.getSchemaName(tenant_id);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const so = await qr.manager.getRepository(ServiceOrderEntity).findOne({ where: { id: so_id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      const itemsServices = await qr.manager.getRepository(SoItemServiceEntity).find({ where: { soId: so_id } });
      const itemsParts = await qr.manager.getRepository(SoItemPartEntity).find({ where: { soId: so_id } });
      const [clienteRows, veiculoRows, tenantRows] = await Promise.all([
        qr.query(`SELECT nome, cpf_cnpj FROM customers WHERE id = $1`, [so.clienteId]),
        qr.query(`SELECT placa, marca, modelo, ano FROM vehicles WHERE id = $1`, [so.veiculoId]),
        this.dataSource.query(`SELECT nome_fantasia FROM public.tenants WHERE id = $1`, [tenant_id]),
      ]);
      const totalServices = itemsServices.reduce((s, i) => s + Number(i.valor), 0);
      const totalParts = itemsParts.reduce((s, i) => s + Number(i.valorUnitario) * i.quantidade, 0);
      return {
        so: { id: so.id, status: so.status, createdAt: so.createdAt },
        empresa: tenantRows[0] ?? null,
        cliente: clienteRows[0] ?? null,
        veiculo: veiculoRows[0] ?? null,
        itemsServices,
        itemsParts,
        total: totalServices + totalParts,
      };
    } finally {
      await qr.release();
    }
  }

  async approve(token: string): Promise<void> {
    const { tenant_id, so_id } = await this.lookupToken(token);
    const schemaName = this.getSchemaName(tenant_id);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const repo = qr.manager.getRepository(ServiceOrderEntity);
      const so = await repo.findOne({ where: { id: so_id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      so.status = 'APROVADO';
      so.approvalToken = null;
      so.approvalExpiresAt = null;
      await repo.save(so);
    } finally {
      await qr.release();
    }
    await this.dataSource.query(
      `UPDATE public.service_order_approval_tokens SET used_at = NOW() WHERE token = $1`,
      [token],
    );
  }

  async reject(token: string): Promise<void> {
    const { tenant_id, so_id } = await this.lookupToken(token);
    const schemaName = this.getSchemaName(tenant_id);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`SET search_path TO "${schemaName}", public`);
      const repo = qr.manager.getRepository(ServiceOrderEntity);
      const so = await repo.findOne({ where: { id: so_id } });
      if (!so) throw new NotFoundException('OS não encontrada.');
      so.approvalToken = null;
      so.approvalExpiresAt = null;
      await repo.save(so);
    } finally {
      await qr.release();
    }
    await this.dataSource.query(
      `UPDATE public.service_order_approval_tokens SET used_at = NOW() WHERE token = $1`,
      [token],
    );
  }
}
