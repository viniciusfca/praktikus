import { CFormInput } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { formatPhone, stripDigits } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface PhoneInputProps extends BaseProps {
  value: string;
  onChange: (digits: string) => void;
}

export function PhoneInput({ value, onChange, ...rest }: PhoneInputProps) {
  const displayValue = formatPhone(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, 11);
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
