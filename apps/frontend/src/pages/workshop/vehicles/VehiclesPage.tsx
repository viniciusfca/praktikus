import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TextField, Typography, CircularProgress, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await vehiclesService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setVehicles(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar veículos.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este veículo?')) return;
    try {
      await vehiclesService.delete(id);
      loadVehicles();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir.');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">Veículos</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/workshop/vehicles/new')}
        >
          Novo Veículo
        </Button>
      </Box>

      <TextField
        label="Buscar por placa, marca ou modelo"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        sx={{ mb: 2, width: 360 }}
        size="small"
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Placa</TableCell>
              <TableCell>Marca</TableCell>
              <TableCell>Modelo</TableCell>
              <TableCell>Ano</TableCell>
              <TableCell>KM</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell>
              </TableRow>
            ) : vehicles.map((v) => (
              <TableRow key={v.id}>
                <TableCell><Chip label={v.placa} size="small" /></TableCell>
                <TableCell>{v.marca}</TableCell>
                <TableCell>{v.modelo}</TableCell>
                <TableCell>{v.ano}</TableCell>
                <TableCell>{v.km.toLocaleString()} km</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(v.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página:"
        />
      </TableContainer>
    </Box>
  );
}
