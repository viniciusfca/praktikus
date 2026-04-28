import { Controller } from 'react-hook-form';
import type { Control, FieldErrors, FieldValues, UseFormSetValue, Path } from 'react-hook-form';
import { CFormFeedback, CFormInput, CFormLabel, CSpinner } from '@coreui/react';
import { useCepLookup } from '../../hooks/useCepLookup';

const labelStyle: React.CSSProperties = { fontWeight: 500, fontSize: 13 };

interface AddressFieldsProps<T extends FieldValues> {
  control: Control<T>;
  setValue: UseFormSetValue<T>;
  errors?: FieldErrors<T>;
  disabled?: boolean;
}

export function AddressFields<T extends FieldValues>({
  control,
  setValue,
  disabled,
}: AddressFieldsProps<T>) {
  const { onCepChange, isLoading, error } = useCepLookup<T>({ setValue });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
      <div style={{ gridColumn: 'span 4' }}>
        <CFormLabel style={labelStyle} htmlFor="address-zip">
          CEP
        </CFormLabel>
        <div style={{ position: 'relative' }}>
          <Controller
            control={control}
            name={'zip' as Path<T>}
            render={({ field }) => (
              <CFormInput
                id="address-zip"
                placeholder="00000-000"
                disabled={disabled}
                value={(field.value as string) ?? ''}
                onChange={(e) => {
                  field.onChange(e);
                  onCepChange(e.target.value);
                }}
                onBlur={field.onBlur}
                invalid={!!error}
              />
            )}
          />
          {isLoading && (
            <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <CSpinner size="sm" />
            </div>
          )}
        </div>
        {error && <CFormFeedback invalid>{error}</CFormFeedback>}
      </div>

      <div style={{ gridColumn: 'span 8' }}>
        <CFormLabel style={labelStyle} htmlFor="address-street">
          Rua
        </CFormLabel>
        <Controller
          control={control}
          name={'street' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-street" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 3' }}>
        <CFormLabel style={labelStyle} htmlFor="address-number">
          Número
        </CFormLabel>
        <Controller
          control={control}
          name={'number' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-number" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 5' }}>
        <CFormLabel style={labelStyle} htmlFor="address-neighborhood">
          Bairro
        </CFormLabel>
        <Controller
          control={control}
          name={'neighborhood' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-neighborhood" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 4' }}>
        <CFormLabel style={labelStyle} htmlFor="address-complement">
          Complemento
        </CFormLabel>
        <Controller
          control={control}
          name={'complement' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-complement" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 10' }}>
        <CFormLabel style={labelStyle} htmlFor="address-city">
          Cidade
        </CFormLabel>
        <Controller
          control={control}
          name={'city' as Path<T>}
          render={({ field }) => (
            <CFormInput id="address-city" disabled={disabled} value={(field.value as string) ?? ''} onChange={field.onChange} />
          )}
        />
      </div>

      <div style={{ gridColumn: 'span 2' }}>
        <CFormLabel style={labelStyle} htmlFor="address-state">
          Estado
        </CFormLabel>
        <Controller
          control={control}
          name={'state' as Path<T>}
          render={({ field }) => (
            <CFormInput
              id="address-state"
              maxLength={2}
              placeholder="SP"
              disabled={disabled}
              value={(field.value as string) ?? ''}
              onChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
