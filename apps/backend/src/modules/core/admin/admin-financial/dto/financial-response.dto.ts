export interface FinancialResponseDto {
  kpis: {
    mrr: null;
    arr: null;
    averageTicket: null;
    churn30d: null;
  };
  basicDistribution: {
    active: number;
    overdue: number;
    suspended: number;
    suspendedLast30Days: number;
  };
  recentCharges: []; // sempre vazio em Fase 1
}
