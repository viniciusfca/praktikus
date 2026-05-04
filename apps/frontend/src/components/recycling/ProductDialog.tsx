import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CButton,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CFormLabel,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheck, cilLayers } from '@coreui/icons';
import type { PriceTable } from '@praktikus/shared';
import type { Unit } from '../../services/recycling/units.service';
import type { Product } from '../../services/recycling/products.service';
import { buildProductSchema } from '../../schemas/recycling/product.schema';
import { PriceRow } from './PriceRow';

export interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    unitId: string;
    active: boolean;
    prices: Record<string, number | null>;
  }) => Promise<void> | void;
  priceTables: PriceTable[];
  units: Unit[];
  product: Product | null;
}

export function ProductDialog({
  open,
  onClose,
  onSave,
  priceTables,
  units,
  product,
}: ProductDialogProps) {
  const sorted = useMemo(
    () => [...priceTables].sort((a, b) => a.sortOrder - b.sortOrder),
    [priceTables],
  );
  const defaultTable = sorted.find((t) => t.isDefault);
  const schema = useMemo(() => buildProductSchema(sorted), [sorted]);

  const initialPrices = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const t of sorted) {
      const v = product?.prices?.[t.id];
      obj[t.id] = v == null ? '' : String(v);
    }
    return obj;
  }, [sorted, product]);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isValid, isSubmitting, errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      name: product?.name ?? '',
      unitId: product?.unitId ?? '',
      active: product?.active ?? true,
      prices: initialPrices,
    },
  });

  const defaultValue = defaultTable
    ? watch(`prices.${defaultTable.id}` as const)
    : '';
  const canReplicate = !!defaultValue;

  const replicate = () => {
    if (!defaultTable || !canReplicate) return;
    for (const t of sorted) {
      if (t.id === defaultTable.id) continue;
      setValue(`prices.${t.id}` as const, defaultValue, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    const prices: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(data.prices)) {
      prices[k] = v == null || v === '' ? null : Number(v);
    }
    await onSave({
      name: data.name,
      unitId: data.unitId,
      active: data.active,
      prices,
    });
  });

  const isNew = product == null;
  const unit = units.find((u) => u.id === watch('unitId'));
  const unitSymbol = unit?.abbreviation ?? 'un';

  return (
    <CModal
      visible={open}
      onClose={onClose}
      size="xl"
      className="pk-product-dialog"
    >
      <CModalHeader>
        <CModalTitle>{isNew ? 'Novo produto' : 'Editar produto'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={onSubmit}>
      <CModalBody>
          <div className="pk-product-grid">
            {/* Coluna esquerda */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SectionLabel icon={cilLayers}>Informações do material</SectionLabel>

              <div>
                <CFormLabel htmlFor="product-name">Nome *</CFormLabel>
                <Controller
                  control={control}
                  name="name"
                  render={({ field }) => (
                    <CFormInput
                      id="product-name"
                      placeholder="Ex.: Alumínio latinha"
                      {...field}
                      invalid={!!errors.name}
                    />
                  )}
                />
                {errors.name && (
                  <small style={{ color: 'var(--cui-danger)' }}>
                    {errors.name.message as string}
                  </small>
                )}
              </div>

              <div>
                <CFormLabel htmlFor="product-unit">Unidade de medida *</CFormLabel>
                <Controller
                  control={control}
                  name="unitId"
                  render={({ field }) => (
                    <CFormSelect id="product-unit" {...field} invalid={!!errors.unitId}>
                      <option value="">Selecione...</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.abbreviation})
                        </option>
                      ))}
                    </CFormSelect>
                  )}
                />
              </div>

              <div>
                <CFormLabel>Status</CFormLabel>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    border: '1px solid var(--cui-border-color)',
                    borderRadius: 6,
                    background: 'var(--cui-tertiary-bg)',
                  }}
                >
                  <Controller
                    control={control}
                    name="active"
                    render={({ field }) => (
                      <CFormSwitch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    )}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 13, fontWeight: 540 }}>
                      {watch('active') ? 'Ativo' : 'Inativo'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                      {watch('active')
                        ? 'Disponível para compra e venda.'
                        : 'Oculto nas operações de caixa.'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Coluna direita */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <SectionLabel>Preços por tabela</SectionLabel>
                <CButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!canReplicate}
                  onClick={replicate}
                >
                  Replicar Tabela 1
                </CButton>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: 'var(--cui-secondary-color)' }}>
                Defina o preço deste material em cada tabela. A Tabela 1 (Padrão) é
                obrigatória; as demais são opcionais.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {sorted.map((t, idx) => (
                  <Controller
                    key={t.id}
                    control={control}
                    name={`prices.${t.id}` as const}
                    render={({ field }) => (
                      <PriceRow
                        index={idx + 1}
                        name={t.name}
                        description={t.description}
                        unitSymbol={unitSymbol}
                        required={t.isDefault}
                        value={field.value as string | null}
                        onChange={field.onChange}
                        error={
                          (errors.prices as Record<string, { message?: string }> | undefined)?.[t.id]
                            ?.message as string | undefined
                        }
                      />
                    )}
                  />
                ))}
              </div>

              <div
                style={{
                  marginTop: 4,
                  padding: '10px 12px',
                  background:
                    'var(--cui-primary-bg-subtle, rgba(50,108,114,0.08))',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <CIcon icon={cilCheck} size="sm" style={{ marginTop: 2, flexShrink: 0 }} />
                <span>
                  As tabelas são gerenciadas em{' '}
                  <strong>Configurações → Tabelas de preço</strong>. Tabelas em
                  branco aparecerão como "—" na listagem.
                </span>
              </div>
            </section>
          </div>
      </CModalBody>
      <CModalFooter>
        <CButton variant="ghost" onClick={onClose}>
          Cancelar
        </CButton>
        <CButton
          type="submit"
          color="primary"
          disabled={!isValid || isSubmitting}
        >
          <CIcon icon={cilCheck} size="sm" style={{ marginRight: 6 }} />
          {isNew ? 'Salvar produto' : 'Salvar alterações'}
        </CButton>
      </CModalFooter>
      </form>
    </CModal>
  );
}

function SectionLabel({
  icon,
  children,
}: {
  icon?: string[] | undefined;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--cui-secondary-color)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {icon && <CIcon icon={icon} size="sm" />}
      {children}
    </div>
  );
}
