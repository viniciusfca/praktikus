import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft, cilPen, cilPlus } from '@coreui/icons';
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
      vehiclesService.list({ page: 1, limit: 1000, search: undefined }),
    ]).then(([c, v]) => {
      setCustomer(c);
      // TODO: replace with server-side customerId filter when backend supports it
      setVehicles(v.data.filter((veh) => veh.customerId === id));
    }).catch(() => {
      setCustomer(null);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-4">
        <CSpinner color="primary" />
      </div>
    );
  }
  if (!customer) return <p>Cliente não encontrado.</p>;

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-4">
        <CButton color="secondary" variant="ghost" size="sm" onClick={() => navigate('/workshop/customers')}>
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <h5 className="fw-bold mb-0">{customer.nome}</h5>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          className="ms-auto"
          onClick={() => navigate(`/workshop/customers/${id}/edit`)}
        >
          <CIcon icon={cilPen} className="me-1" />
          Editar
        </CButton>
      </div>

      <CCard className="mb-4">
        <CCardBody>
          <div className="mb-2">
            <small className="text-secondary">CPF / CNPJ</small>
            <div>{customer.cpfCnpj}</div>
          </div>
          <hr className="my-2" />
          <div className="mb-2">
            <small className="text-secondary">WhatsApp</small>
            <div>{customer.whatsapp ?? '—'}</div>
          </div>
          <hr className="my-2" />
          <div>
            <small className="text-secondary">E-mail</small>
            <div>{customer.email ?? '—'}</div>
          </div>
        </CCardBody>
      </CCard>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Veículos</h6>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/workshop/vehicles/new?customerId=${id}`)}
        >
          <CIcon icon={cilPlus} className="me-1" />
          Novo Veículo
        </CButton>
      </div>

      <CCard>
        <CTable small hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Placa</CTableHeaderCell>
              <CTableHeaderCell>Marca / Modelo</CTableHeaderCell>
              <CTableHeaderCell>Ano</CTableHeaderCell>
              <CTableHeaderCell>KM</CTableHeaderCell>
              <CTableHeaderCell />
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {vehicles.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center text-secondary">
                  Nenhum veículo cadastrado.
                </CTableDataCell>
              </CTableRow>
            ) : vehicles.map((v) => (
              <CTableRow key={v.id}>
                <CTableDataCell>
                  <CBadge color="secondary">{v.placa}</CBadge>
                </CTableDataCell>
                <CTableDataCell>{v.marca} {v.modelo}</CTableDataCell>
                <CTableDataCell>{v.ano}</CTableDataCell>
                <CTableDataCell>{v.km.toLocaleString()} km</CTableDataCell>
                <CTableDataCell>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCard>
    </>
  );
}
