import { CFormInput } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { useEffect, useState } from 'react';
import { stripDigits } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface TimeInputProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
}

function formatTime(digits: string): string {
  const d = digits.slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function TimeInput({ value, onChange, ...rest }: TimeInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(
    formatTime(stripDigits(value)),
  );

  useEffect(() => {
    setDisplayValue(formatTime(stripDigits(value)));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = stripDigits(e.target.value).slice(0, 4);
    const formatted = formatTime(digits);
    setDisplayValue(formatted);
    onChange(formatted);
  }

  return (
    <CFormInput
      {...rest}
      type="text"
      inputMode="numeric"
      placeholder="HH:mm"
      value={displayValue}
      onChange={handleChange}
    />
  );
}
