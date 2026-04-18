import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CFormInput,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilPlus,
  cilSearch,
  cilHistory,
  cilPen,
  cilTrash,
  cilCarAlt,
  cilArrowRight,
} from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

function VehicleCard({
  v,
  onHistory,
  onEdit,
  onDelete,
}: {
  v: Vehicle;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 14,
        border: '1px solid var(--cui-border-color)',
        background: 'var(--cui-card-bg)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.15s ease, box-shadow 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(52,142,145,0.35)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(10,12,13,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cui-border-color)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(52,142,145,0.1)',
            color: 'var(--cui-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CIcon icon={cilCarAlt} size="lg" />
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid var(--cui-border-color)',
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.06em',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--cui-body-color)',
            background: 'var(--cui-card-cap-bg)',
          }}
        >
          {v.placa}
        </span>
      </div>

      <div style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--cui-body-color)', letterSpacing: '-0.01em' }}>
        {v.marca} {v.modelo}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
        {v.ano} · {v.km.toLocaleString('pt-BR')} km
      </div>

      <div style={{ margin: '16px 0', height: 1, background: 'var(--cui-border-color)' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <CButton
          color="primary"
          variant="ghost"
          size="sm"
          onClick={onHistory}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
        >
          Histórico <CIcon icon={cilArrowRight} size="sm" />
        </CButton>
        <div style={{ display: 'flex', gap: 2 }}>
          <CButton color="secondary" variant="ghost" size="sm" title="Prontuário" onClick={onHistory}>
            <CIcon icon={cilHistory} />
          </CButton>
          <CButton color="secondary" variant="ghost" size="sm" title="Editar" onClick={onEdit}>
            <CIcon icon={cilPen} />
          </CButton>
          <CButton color="danger" variant="ghost" size="sm" title="Excluir" onClick={onDelete}>
            <CIcon icon={cilTrash} />
          </CButton>
        </div>
      </div>
    </div>
  );
}

export function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
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

  const totalPages = Math.ceil(total / rowsPerPage) || 1;
  const shownFrom = total === 0 ? 0 : page * rowsPerPage + 1;
  const shownTo = Math.min((page + 1) * rowsPerPage, total);

  return (
    <>
      <PageHead
        title="Veículos"
        subtitle={total > 0 ? `${total} ${total === 1 ? 'veículo cadastrado' : 'veículos cadastrados'}` : 'Gerencie a frota dos seus clientes'}
        actions={
          <CButton
            color="primary"
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={() => navigate('/workshop/vehicles/new')}
          >
            <CIcon icon={cilPlus} size="sm" /> Novo veículo
          </CButton>
        }
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {/* Search bar */}
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 360 }}>
        <CIcon
          icon={cilSearch}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--cui-secondary-color)',
            pointerEvents: 'none',
            width: 14,
            height: 14,
          }}
        />
        <CFormInput
          placeholder="Buscar por placa, marca ou modelo..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ paddingLeft: 36 }}
          size="sm"
          aria-label="Buscar veículos"
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <CSpinner size="sm" color="primary" />
        </div>
      ) : vehicles.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            border: '1px dashed var(--cui-border-color)',
            borderRadius: 14,
            background: 'var(--cui-card-cap-bg)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(52,142,145,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CIcon icon={cilCarAlt} size="xl" style={{ color: 'var(--cui-primary)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhum veículo encontrado</div>
            <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
              {search ? 'Tente ajustar sua busca.' : 'Cadastre o primeiro veículo para começar.'}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
              marginBottom: 16,
            }}
          >
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                v={v}
                onHistory={() => navigate(`/workshop/vehicles/${v.id}/history`)}
                onEdit={() => navigate(`/workshop/vehicles/${v.id}/edit`)}
                onDelete={() => handleDelete(v.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--cui-card-bg)',
              border: '1px solid var(--cui-border-color)',
              borderRadius: 12,
              fontSize: 12.5,
              color: 'var(--cui-secondary-color)',
            }}
          >
            <span>Mostrando {shownFrom}–{shownTo} de {total}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                className="form-select form-select-sm"
                style={{ width: 72 }}
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                aria-label="Itens por página"
              >
                {[12, 24, 48].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 4 }}>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label="Página anterior"
                >
                  ‹
                </CButton>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 10px', fontWeight: 500, color: 'var(--cui-body-color)' }}>
                  {page + 1} / {totalPages}
                </span>
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Próxima página"
                >
                  ›
                </CButton>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
