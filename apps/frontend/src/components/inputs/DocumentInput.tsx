import { CFormInput } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { useEffect, useState } from 'react';
import { formatDocument, stripDigits } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface DocumentInputProps extends BaseProps {
  type: 'CPF' | 'CNPJ';
  value: string;
  onChange: (digits: string) => void;
}

export function DocumentInput({ type, value, onChange, ...rest }: DocumentInputProps) {
  const maxDigits = type === 'CPF' ? 11 : 14;
  const [displayValue, setDisplayValue] = useState<string>(
    formatDocument(value.slice(0, maxDigits), type),
  );

  useEffect(() => {
    const formatted = formatDocument(value.slice(0, maxDigits), type);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync display when parent value or type changes
    setDisplayValue(formatted);
  }, [value, type, maxDigits]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, maxDigits);
    const formatted = formatDocument(digits, type);
    setDisplayValue(formatted);
    onChange(digits);
  }

  return (
    <CFormInput
      {...rest}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
