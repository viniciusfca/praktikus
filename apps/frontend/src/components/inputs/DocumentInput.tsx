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
  const [text, setText] = useState<string>(formatDocument(value.slice(0, maxDigits), type));

  useEffect(() => {
    const formatted = formatDocument(value.slice(0, maxDigits), type);
    setText(formatted);
  }, [type, value, maxDigits]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, maxDigits);
    const formatted = formatDocument(digits, type);
    setText(formatted);
    onChange(digits);
  }

  return (
    <CFormInput
      {...rest}
      type="text"
      inputMode="numeric"
      value={text}
      onChange={handleChange}
    />
  );
}
