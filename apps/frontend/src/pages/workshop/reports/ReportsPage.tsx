import { useCallback, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import axios from 'axios';
import { useAuthStore } from '../../../store/auth.store';
import { reportsApi, type ReportData } from '../../../services/reports.service';

const PIE_COLORS = ['#1976d2', '#9c27b0', '#ed6c02', '#2e7d32', '#d32f2f', '#0288d1'];

const STATUS_LABEL: Record<string, string> = {
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Computed once at module load — acceptable for a page that doesn't survive midnight.
const monthChips = (() => {
  const chips = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
    chips.push({
      label,
      dateStart: `${year}-${month}-01`,
      dateEnd: `${year}-${month}-${lastDay}`,
    });
  }
  return chips;
})();

export function ReportsPage() {
  const user = useAuthStore((s) => s.user);

  // All hooks must be declared before any conditional return.
  const [dateStart, setDateStart] = useState(monthChips[0].dateStart);
  const [dateEnd, setDateEnd] = useState(monthChips[0].dateEnd);
  const [activeChip, setActiveChip] = useState(0);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to cancel any in-flight request before starting a new one.
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSearch = useCallback(async (start = dateStart, end = dateEnd) => {
    // Cancel the previous request if still in-flight.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const result = await reportsApi.get(start, end, controller.signal);
      setData(result);
    } catch (err) {
      if (axios.isCancel(err)) {
        // A newer request is already in flight — let it manage loading/error state.
        return;
      }
      setError('Erro ao carregar relatório.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [dateStart, dateEnd]);

  if (user?.role !== 'OWNER') {
    return <Navigate to="/workshop/dashboard" replace />;
  }

  const handleChipClick = (index: number, chip: typeof monthChips[0]) => {
    setActiveChip(index);
    setDateStart(chip.dateStart);
    setDateEnd(chip.dateEnd);
    handleSearch(chip.dateStart, chip.dateEnd);
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Relatórios
      </Typography>

      {/* Filtros */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {monthChips.map((chip, i) => (
          <Chip
            key={chip.dateStart}
            label={chip.label}
            onClick={() => handleChipClick(i, chip)}
            color={activeChip === i ? 'primary' : 'default'}
            variant={activeChip === i ? 'filled' : 'outlined'}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
        <TextField
          label="De"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateStart}
          onChange={(e) => { setDateStart(e.target.value); setActiveChip(-1); }}
        />
        <TextField
          label="Até"
          type="date"
          size="small"
          InputLabelProps={{ shrink: true }}
          value={dateEnd}
          onChange={(e) => { setDateEnd(e.target.value); setActiveChip(-1); }}
        />
        <Button variant="contained" onClick={() => handleSearch()} disabled={loading}>
          Buscar
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}

      {data && !loading && (
        <>
          {data.totalOs === 0 && (
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Nenhuma OS encontrada para o período selecionado.
            </Typography>
          )}

          {/* KPIs */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            {[
              { label: 'Faturamento Total', value: fmt(data.faturamentoTotal) },
              { label: 'Serviços', value: fmt(data.faturamentoServicos) },
              { label: 'Peças', value: fmt(data.faturamentoPecas) },
              { label: 'Total de OS', value: String(data.totalOs) },
              { label: 'OS Pagas', value: String(data.osPagas) },
            ].map((kpi) => (
              <Card key={kpi.label} variant="outlined" sx={{ flex: '1 1 150px' }}>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography variant="caption" color="text.secondary">{kpi.label}</Typography>
                  <Typography variant="h6" fontWeight="bold">{kpi.value}</Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* Gráficos */}
          {data.totalOs > 0 && (
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Card variant="outlined" sx={{ flex: '2 1 400px' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                    Faturamento por Mês
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.faturamentoPorMes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" />
                      <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: ValueType | undefined) => {
                        if (typeof v !== 'number') return String(v ?? '');
                        return fmt(v);
                      }} />
                      <Legend />
                      <Bar dataKey="servicos" name="Serviços" stackId="a" fill="#1976d2" />
                      <Bar dataKey="pecas" name="Peças" stackId="a" fill="#9c27b0" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ flex: '1 1 280px' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                    OS por Status
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={data.osPorStatus}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        label={(props: any) => `${STATUS_LABEL[props.status] ?? props.status}: ${props.count}`}
                      >
                        {data.osPorStatus.map((entry, index) => (
                          <Cell key={entry.status} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: ValueType | undefined, name: NameType | undefined) => {
                        const label = STATUS_LABEL[String(name ?? '')] ?? String(name ?? '');
                        if (typeof v !== 'number') return [String(v ?? ''), label];
                        return [v, label];
                      }} />
                      <Legend formatter={(value: string) => STATUS_LABEL[value] ?? value} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Top 10 serviços */}
          {data.topServicos.length > 0 && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
                  Top 10 Serviços
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Serviço</TableCell>
                        <TableCell align="right">Qtd</TableCell>
                        <TableCell align="right">Receita</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topServicos.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{s.nomeServico}</TableCell>
                          <TableCell align="right">{s.quantidade}</TableCell>
                          <TableCell align="right">{fmt(s.receita)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
