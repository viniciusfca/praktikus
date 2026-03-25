import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Divider, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  vehiclesService,
  type Vehicle,
  type VehicleServiceOrder,
} from '../../../services/vehicles.service';

const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<string, 'default' | 'info' | 'primary' | 'warning' | 'secondary' | 'success'> = {
  ORCAMENTO: 'default',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function VehicleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [orders, setOrders] = useState<VehicleServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [v, os] = await Promise.all([
        vehiclesService.getById(id),
        vehiclesService.getServiceOrders(id),
      ]);
      setVehicle(v);
      setOrders(os);
    } catch {
      setError('Erro ao carregar histórico do veículo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/workshop/vehicles')}
        sx={{ mb: 2 }}
      >
        Veículos
      </Button>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          {vehicle
            ? `${vehicle.placa} — ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`
            : 'Veículo'}
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Prontuário do Veículo
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {orders.length === 0 && !error && (
        <Typography color="text.secondary">
          Nenhuma ordem de serviço registrada para este veículo.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {orders.map((o) => {
          const services = o.itemsServices.map((s) => s.nomeServico).join(', ');
          const parts = o.itemsParts
            .map((p) => `${p.nomePeca} x${p.quantidade}`)
            .join(', ');

          return (
            <Card key={o.id} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Typography>
                  <Chip
                    label={STATUS_LABEL[o.status] ?? o.status}
                    color={STATUS_COLOR[o.status] ?? 'default'}
                    size="small"
                  />
                </Box>

                {o.kmEntrada && (
                  <Typography variant="body2" color="text.secondary">
                    KM entrada: {o.kmEntrada}
                  </Typography>
                )}

                {services && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    <strong>Serviços:</strong> {services}
                  </Typography>
                )}

                {parts && (
                  <Typography variant="body2">
                    <strong>Peças:</strong> {parts}
                  </Typography>
                )}

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography fontWeight="bold">
                    {fmt(o.total)}
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => navigate(`/workshop/service-orders/${o.id}`)}
                  >
                    Ver OS →
                  </Button>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
