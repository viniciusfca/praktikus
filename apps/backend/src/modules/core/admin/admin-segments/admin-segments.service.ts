import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantEntity } from '../../tenancy/tenant.entity';
import { TenantSegment } from '@praktikus/shared';
import { SegmentBreakdown, SegmentsResponseDto } from './dto/segments-response.dto';

@Injectable()
export class AdminSegmentsService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly repo: Repository<TenantEntity>,
  ) {}

  async list(): Promise<SegmentsResponseDto> {
    type ByStatusRow = { segment: string; status: string; count: string };
    type CountRow = { segment: string; count: string };

    const [total, byStatusRows, whatsappRows, newRows]: [
      number,
      ByStatusRow[],
      CountRow[],
      CountRow[],
    ] = await Promise.all([
      this.repo.count(),
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect('t.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.segment')
        .addGroupBy('t.status')
        .getRawMany(),
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect('COUNT(*)', 'count')
        .where('t.whatsapp_enabled = true')
        .groupBy('t.segment')
        .getRawMany(),
      this.repo
        .createQueryBuilder('t')
        .select('t.segment', 'segment')
        .addSelect('COUNT(*)', 'count')
        .where(`t.created_at >= NOW() - INTERVAL '30 days'`)
        .groupBy('t.segment')
        .getRawMany(),
    ]);

    const segments = new Map<TenantSegment, SegmentBreakdown>();
    for (const seg of Object.values(TenantSegment)) {
      segments.set(seg, {
        segment: seg,
        total: 0,
        byStatus: {},
        whatsappCount: 0,
        newLast30Days: 0,
        mrr: null,
      });
    }

    for (const r of byStatusRows) {
      const seg = segments.get(r.segment as TenantSegment);
      if (!seg) continue;
      const c = Number(r.count);
      seg.total += c;
      seg.byStatus[r.status] = c;
    }
    for (const r of whatsappRows) {
      const seg = segments.get(r.segment as TenantSegment);
      if (seg) seg.whatsappCount = Number(r.count);
    }
    for (const r of newRows) {
      const seg = segments.get(r.segment as TenantSegment);
      if (seg) seg.newLast30Days = Number(r.count);
    }

    return {
      totalTenants: total,
      segments: Array.from(segments.values()),
    };
  }
}
