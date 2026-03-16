import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Button, Card, CardContent, Chip, Divider, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Typography, Paper, CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      customersService.getById(id),
      vehiclesService.list({ search: undefined }),
    ]).then(([c, v]) => {
      setCustomer(c);
      setVehicles(v.data.filter((veh) => veh.customerId === id));
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
  if (!customer) return <Typography>Cliente não encontrado.</Typography>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/workshop/customers')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight="bold">{customer.nome}</Typography>
        <Button
          startIcon={<EditIcon />}
          onClick={() => navigate(`/workshop/customers/${id}/edit`)}
          sx={{ ml: 'auto' }}
        >
          Editar
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">CPF / CNPJ</Typography>
          <Typography mb={1}>{customer.cpfCnpj}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">WhatsApp</Typography>
          <Typography mb={1}>{customer.whatsapp ?? '—'}</Typography>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" color="text.secondary">E-mail</Typography>
          <Typography>{customer.email ?? '—'}</Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Veículos</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navigate(`/workshop/vehicles/new?customerId=${id}`)}
        >
          Novo Veículo
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Placa</TableCell>
              <TableCell>Marca / Modelo</TableCell>
              <TableCell>Ano</TableCell>
              <TableCell>KM</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">Nenhum veículo cadastrado.</TableCell>
              </TableRow>
            ) : vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell><Chip label={v.placa} size="small" /></TableCell>
                <TableCell>{v.marca} {v.modelo}</TableCell>
                <TableCell>{v.ano}</TableCell>
                <TableCell>{v.km.toLocaleString()} km</TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
