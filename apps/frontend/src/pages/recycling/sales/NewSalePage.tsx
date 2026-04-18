import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilTrash } from '@coreui/icons';
import { salesService } from '../../../services/recycling/sales.service';
import { buyersService, type Buyer } from '../../../services/recycling/buyers.service';
import { productsService, type Product } from '../../../services/recycling/products.service';
import { stockService, type StockBalance } from '../../../services/recycling/stock.service';

const itemSchema = z.object({
  productId: z.string().uuid('Selecione um produto'),
  quantity: z.number().positive('Quantidade deve ser positiva'),
  unitPrice: z.number().positive('Preço deve ser positivo').max(999999.9999, 'Preço máximo excedido'),
});

const schema = z.object({
  buyerId: z.string().uuid('Selecione um comprador'),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NewSalePage() {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      buyersService.list(1, 100),
      productsService.list(),
      stockService.getBalances(),
    ])
      .then(([buyersRes, productsRes, balancesRes]) => {
        setBuyers(buyersRes.data);
        setProducts(productsRes);
        setBalances(balancesRes);
      })
      .catch(() => setLoadError('Erro ao carregar dados'))
      .finally(() => setLoadingData(false));
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      buyerId: '',
      items: [{ productId: '', quantity: 1, unitPrice: 0 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.pricePerUnit);
    }
  };

  const getBalance = (productId: string): number | null => {
    const b = balances.find((b) => b.productId === productId);
    return b ? b.balance : null;
  };

  const totalAmount = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await salesService.create({
        buyerId: data.buyerId,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: data.notes || undefined,
      });
      navigate('/recycling/sales');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao registrar venda.'));
    }
  };

  if (loadingData) {
    return (
      <div className="text-center py-5">
        <CSpinner />
      </div>
    );
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Nova Venda</h5>
        <CButton color="secondary" variant="outline" size="sm" onClick={() => navigate('/recycling/sales')}>
          Cancelar
        </CButton>
      </div>

      {(loadError || submitError) && (
        <CAlert color="danger" className="mb-3">{loadError ?? submitError}</CAlert>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <CCard className="mb-4">
          <CCardHeader>Dados da Venda</CCardHeader>
          <CCardBody>
            <div className="mb-3">
              <CFormLabel>Comprador *</CFormLabel>
              <CFormSelect {...register('buyerId')} invalid={!!errors.buyerId}>
                <option value="">Selecione um comprador...</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </CFormSelect>
              {errors.buyerId && <CFormFeedback invalid>{errors.buyerId.message}</CFormFeedback>}
            </div>

            <div>
              <CFormLabel>Observacoes</CFormLabel>
              <CFormTextarea
                {...register('notes')}
                rows={2}
                placeholder="Observacoes opcionais..."
              />
            </div>
          </CCardBody>
        </CCard>

        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <span>Itens da Venda</span>
            <CButton
              type="button"
              color="primary"
              size="sm"
              variant="outline"
              onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}
            >
              <CIcon icon={cilPlus} className="me-1" />
              Adicionar Item
            </CButton>
          </CCardHeader>
          <CCardBody className="p-0">
            {errors.items && !Array.isArray(errors.items) && (
              <CAlert color="danger" className="m-3">{errors.items.message}</CAlert>
            )}
            <CTable hover responsive className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Produto</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 130 }}>Quantidade</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 150 }}>Preco Unit. (R$)</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 130 }} className="text-end">Subtotal</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 60 }}></CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {fields.map((field, index) => {
                  const qty = Number(watchedItems[index]?.quantity) || 0;
                  const price = Number(watchedItems[index]?.unitPrice) || 0;
                  const subtotal = qty * price;
                  const currentProductId = watchedItems[index]?.productId;
                  const balance = currentProductId ? getBalance(currentProductId) : null;
                  return (
                    <CTableRow key={field.id}>
                      <CTableDataCell>
                        <Controller
                          control={control}
                          name={`items.${index}.productId`}
                          render={({ field: f }) => (
                            <>
                              <CFormSelect
                                value={f.value}
                                onChange={(e) => {
                                  f.onChange(e);
                                  handleProductChange(index, e.target.value);
                                }}
                                invalid={!!errors.items?.[index]?.productId}
                              >
                                <option value="">Selecione...</option>
                                {products.map((p) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </CFormSelect>
                              {errors.items?.[index]?.productId && (
                                <CFormFeedback invalid>
                                  {errors.items[index]?.productId?.message}
                                </CFormFeedback>
                              )}
                              {balance !== null && (
                                <small className="text-muted">Estoque disponível: {balance}</small>
                              )}
                            </>
                          )}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          invalid={!!errors.items?.[index]?.quantity}
                        />
                        {errors.items?.[index]?.quantity && (
                          <CFormFeedback invalid>
                            {errors.items[index]?.quantity?.message}
                          </CFormFeedback>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CFormInput
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                          invalid={!!errors.items?.[index]?.unitPrice}
                        />
                        {errors.items?.[index]?.unitPrice && (
                          <CFormFeedback invalid>
                            {errors.items[index]?.unitPrice?.message}
                          </CFormFeedback>
                        )}
                      </CTableDataCell>
                      <CTableDataCell className="text-end align-middle">
                        {formatCurrency(subtotal)}
                      </CTableDataCell>
                      <CTableDataCell className="text-center align-middle">
                        {fields.length > 1 && (
                          <CButton
                            type="button"
                            color="danger"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                          >
                            <CIcon icon={cilTrash} />
                          </CButton>
                        )}
                      </CTableDataCell>
                    </CTableRow>
                  );
                })}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>

        <div className="d-flex justify-content-between align-items-center">
          <div className="fw-bold fs-5">
            Total: {formatCurrency(totalAmount)}
          </div>
          <CButton type="submit" color="primary" disabled={isSubmitting}>
            {isSubmitting ? <CSpinner size="sm" className="me-2" /> : null}
            Registrar Venda
          </CButton>
        </div>
      </form>
    </>
  );
}
