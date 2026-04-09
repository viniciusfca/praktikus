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
  CCol,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
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
import { purchasesService } from '../../../services/recycling/purchases.service';
import { suppliersService, type Supplier } from '../../../services/recycling/suppliers.service';
import { productsService, type Product } from '../../../services/recycling/products.service';

const itemSchema = z.object({
  productId: z.string().uuid('Selecione um produto'),
  quantity: z.number({ invalid_type_error: 'Quantidade deve ser um número' }).positive('Quantidade deve ser positiva'),
  unitPrice: z.number({ invalid_type_error: 'Preço deve ser um número' }).positive('Preço deve ser positivo').max(999999.9999, 'Preço máximo excedido'),
});

const schema = z.object({
  supplierId: z.string().uuid('Selecione um fornecedor'),
  paymentMethod: z.enum(['CASH', 'PIX', 'CARD'], { errorMap: () => ({ message: 'Selecione a forma de pagamento' }) }),
  items: z.array(itemSchema).min(1, 'Adicione ao menos um item'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function formatCurrency(value: number): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      supplierId: '',
      paymentMethod: 'CASH',
      items: [{ productId: '', quantity: 1, unitPrice: 0 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      try {
        const [suppliersResult, productsResult] = await Promise.all([
          suppliersService.list(1, 200),
          productsService.list(),
        ]);
        setSuppliers(suppliersResult.data);
        setProducts(productsResult);
      } catch {
        setSubmitError('Erro ao carregar dados. Recarregue a página.');
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, []);

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unitPrice`, product.pricePerUnit);
    }
  };

  const totalAmount = watchedItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await purchasesService.create({
        supplierId: data.supplierId,
        paymentMethod: data.paymentMethod,
        items: data.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        notes: data.notes || undefined,
      });
      navigate('/recycling/purchases');
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = anyErr?.response?.data?.message;
      setSubmitError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao registrar compra.'));
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
        <h5 className="fw-bold mb-0">Nova Compra</h5>
        <CButton color="secondary" variant="outline" size="sm" onClick={() => navigate('/recycling/purchases')}>
          Cancelar
        </CButton>
      </div>

      {submitError && <CAlert color="danger" className="mb-3">{submitError}</CAlert>}

      <form onSubmit={handleSubmit(onSubmit)}>
        <CCard className="mb-4">
          <CCardHeader>Dados da Compra</CCardHeader>
          <CCardBody>
            <CRow className="mb-3">
              <CCol md={6}>
                <CFormLabel>Fornecedor *</CFormLabel>
                <CFormSelect
                  {...register('supplierId')}
                  invalid={!!errors.supplierId}
                >
                  <option value="">Selecione um fornecedor...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </CFormSelect>
                {errors.supplierId && (
                  <CFormFeedback invalid>{errors.supplierId.message}</CFormFeedback>
                )}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Forma de Pagamento *</CFormLabel>
                <CFormSelect
                  {...register('paymentMethod')}
                  invalid={!!errors.paymentMethod}
                >
                  <option value="CASH">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="CARD">Cartao</option>
                </CFormSelect>
                {errors.paymentMethod && (
                  <CFormFeedback invalid>{errors.paymentMethod.message}</CFormFeedback>
                )}
              </CCol>
            </CRow>

            <CRow>
              <CCol>
                <CFormLabel>Observacoes</CFormLabel>
                <CFormTextarea
                  {...register('notes')}
                  rows={2}
                  placeholder="Observacoes opcionais..."
                />
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CCard className="mb-4">
          <CCardHeader className="d-flex justify-content-between align-items-center">
            <span>Itens da Compra</span>
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
            Registrar Compra
          </CButton>
        </div>
      </form>
    </>
  );
}
