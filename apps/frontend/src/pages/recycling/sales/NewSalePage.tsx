import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
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
import { cilPlus, cilTrash, cilArrowLeft, cilWarning } from '@coreui/icons';
import { salesService } from '../../../services/recycling/sales.service';
import { buyersService, type Buyer } from '../../../services/recycling/buyers.service';
import { productsService, type Product } from '../../../services/recycling/products.service';
import { stockService, type StockBalance } from '../../../services/recycling/stock.service';

// ── Schema ──────────────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
const labelStyle = { fontWeight: 500, fontSize: 13 };

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatKg(value: number): string {
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg`;
}

// ── Local primitives ────────────────────────────────────────────────────────
function Card({
  children,
  header,
  padding = 20,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  padding?: number | string;
}) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

function CardTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
      {desc && (
        <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  big,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: big ? 16 : 13.5,
      }}
    >
      <span style={{ color: 'var(--cui-secondary-color)' }}>{label}</span>
      <span
        style={{
          fontWeight: bold ? 700 : 500,
          fontVariantNumeric: 'tabular-nums',
          color: accent ? 'var(--cui-primary)' : 'var(--cui-body-color)',
          fontSize: big ? 20 : 13.5,
          letterSpacing: big ? '-0.01em' : 'normal',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
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

  const totals = watchedItems.reduce(
    (acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      acc.volume += qty;
      acc.subtotal += qty * price;
      return acc;
    },
    { volume: 0, subtotal: 0 },
  );

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
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <CSpinner color="primary" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Page head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => navigate('/recycling/sales')}
          style={{ padding: '4px 10px', borderRadius: 8 }}
          aria-label="Voltar"
        >
          <CIcon icon={cilArrowLeft} size="sm" />
        </CButton>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--cui-body-color)',
            }}
          >
            Nova venda
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
            Registre uma saída de material para um comprador.
          </p>
        </div>
      </div>

      {(loadError || submitError) && (
        <CAlert color="danger" className="mb-0">
          {loadError ?? submitError}
        </CAlert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 320px',
            gap: 16,
          }}
          className="pk-dashboard-grid"
        >
          {/* ── Main column ───────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Dados da venda */}
            <Card header={<CardTitle title="Dados da venda" desc="Comprador e observações" />}>
              <div>
                <CFormLabel style={labelStyle}>Comprador *</CFormLabel>
                <CFormSelect {...register('buyerId')} invalid={!!errors.buyerId}>
                  <option value="">Selecione um comprador...</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </CFormSelect>
                {errors.buyerId && <CFormFeedback invalid>{errors.buyerId.message}</CFormFeedback>}
              </div>

              <div style={{ marginTop: 14 }}>
                <CFormLabel style={labelStyle}>Observações</CFormLabel>
                <CFormTextarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Observações sobre a venda..."
                />
              </div>
            </Card>

            {/* Itens */}
            <Card
              padding={0}
              header={
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <CardTitle title="Itens da venda" desc="Produtos, quantidade e preços" />
                  <CButton
                    type="button"
                    color="primary"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}
                    style={{
                      borderRadius: 8,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <CIcon icon={cilPlus} size="sm" /> Adicionar item
                  </CButton>
                </div>
              }
            >
              {errors.items && !Array.isArray(errors.items) && (
                <div style={{ padding: '12px 20px' }}>
                  <CAlert color="danger" className="mb-0">
                    {errors.items.message}
                  </CAlert>
                </div>
              )}

              <CTable hover responsive className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Produto</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 130 }}>Qtd (kg)</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 150 }}>Preço unit. (R$)</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 130, textAlign: 'right' }}>
                      Subtotal
                    </CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 48 }} />
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {fields.map((field, index) => {
                    const qty = Number(watchedItems[index]?.quantity) || 0;
                    const price = Number(watchedItems[index]?.unitPrice) || 0;
                    const subtotal = qty * price;
                    const currentProductId = watchedItems[index]?.productId;
                    const balance = currentProductId ? getBalance(currentProductId) : null;
                    const insufficient = balance !== null && qty > balance;
                    return (
                      <CTableRow key={field.id}>
                        <CTableDataCell style={{ verticalAlign: 'top' }}>
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
                                  size="sm"
                                >
                                  <option value="">Selecione...</option>
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </CFormSelect>
                                {errors.items?.[index]?.productId && (
                                  <CFormFeedback invalid>
                                    {errors.items[index]?.productId?.message}
                                  </CFormFeedback>
                                )}
                                {balance !== null && (
                                  <div
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      marginTop: 6,
                                      padding: '2px 8px',
                                      borderRadius: 999,
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: insufficient ? '#b45309' : 'var(--cui-secondary-color)',
                                      background: insufficient
                                        ? 'rgba(217, 119, 6, 0.12)'
                                        : 'var(--cui-card-cap-bg)',
                                      border: insufficient
                                        ? 'none'
                                        : '1px solid var(--cui-border-color)',
                                    }}
                                  >
                                    {insufficient && <CIcon icon={cilWarning} size="sm" />}
                                    Estoque: {formatKg(balance)}
                                  </div>
                                )}
                              </>
                            )}
                          />
                        </CTableDataCell>

                        <CTableDataCell style={{ verticalAlign: 'top' }}>
                          <CFormInput
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            size="sm"
                            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            invalid={!!errors.items?.[index]?.quantity || insufficient}
                          />
                          {errors.items?.[index]?.quantity && (
                            <CFormFeedback invalid>
                              {errors.items[index]?.quantity?.message}
                            </CFormFeedback>
                          )}
                        </CTableDataCell>

                        <CTableDataCell style={{ verticalAlign: 'top' }}>
                          <CFormInput
                            type="number"
                            step="0.0001"
                            min="0.0001"
                            size="sm"
                            {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                            invalid={!!errors.items?.[index]?.unitPrice}
                          />
                          {errors.items?.[index]?.unitPrice && (
                            <CFormFeedback invalid>
                              {errors.items[index]?.unitPrice?.message}
                            </CFormFeedback>
                          )}
                        </CTableDataCell>

                        <CTableDataCell
                          style={{
                            textAlign: 'right',
                            verticalAlign: 'top',
                            paddingTop: 10,
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 600,
                            color: 'var(--cui-body-color)',
                          }}
                        >
                          {formatCurrency(subtotal)}
                        </CTableDataCell>

                        <CTableDataCell
                          style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: 6 }}
                        >
                          {fields.length > 1 && (
                            <CButton
                              type="button"
                              color="danger"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              aria-label="Remover item"
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
            </Card>
          </div>

          {/* ── Sidebar sticky ────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
            <Card header={<CardTitle title="Resumo" desc="Totais da venda" />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SummaryRow
                  label={`${fields.length} ${fields.length === 1 ? 'item' : 'itens'}`}
                  value={formatKg(totals.volume)}
                />
                <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
                <div style={{ height: 1, background: 'var(--cui-border-color)', margin: '4px 0' }} />
                <SummaryRow label="Total" value={formatCurrency(totals.subtotal)} bold big accent />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
                <CButton
                  type="submit"
                  color="primary"
                  size="lg"
                  disabled={isSubmitting}
                  style={{
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {isSubmitting ? <CSpinner size="sm" /> : 'Registrar venda'}
                </CButton>
                <CButton
                  type="button"
                  color="secondary"
                  variant="ghost"
                  size="lg"
                  onClick={() => navigate('/recycling/sales')}
                  style={{ borderRadius: 8 }}
                >
                  Cancelar
                </CButton>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
