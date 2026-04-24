import { CFormInput, CInputGroup, CInputGroupText } from '@coreui/react';
import type { CFormInputProps } from '@coreui/react/dist/esm/components/form/CFormInput';
import { useEffect, useState } from 'react';
import { formatDecimal, parseDecimal } from '../../utils/masks';

type BaseProps = Omit<CFormInputProps, 'type' | 'value' | 'onChange'>;

export interface NumericInputProps extends BaseProps {
  value: number | null;
  onChange: (value: number | null) => void;
  decimals?: number;
  prefix?: string;
  min?: number;
  max?: number;
}

export function NumericInput({
  value,
  onChange,
  decimals = 2,
  prefix,
  min,
  max,
  size,
  ...rest
}: NumericInputProps) {
  const [text, setText] = useState<string>(
    value === null || value === undefined ? '' : formatDecimal(value, decimals),
  );

  useEffect(() => {
    const nextFormatted =
      value === null || value === undefined ? '' : formatDecimal(value, decimals);
    const parsedCurrent = parseDecimal(text, decimals);
    if (parsedCurrent !== value) {
      setText(nextFormatted);
    }
  }, [value, decimals]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (decimals > 0 && e.key === '.') {
      e.preventDefault();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const allowed = decimals > 0 ? /^[\d.,]*$/ : /^[\d.]*$/;
    if (!allowed.test(raw)) return;
    setText(raw);
    const parsed = parseDecimal(raw, decimals);
    onChange(parsed);
  }

  function handleBlur() {
    const parsed = parseDecimal(text, decimals);
    if (parsed === null) {
      setText('');
      onChange(null);
      return;
    }
    let bounded = parsed;
    if (min !== undefined) bounded = Math.max(min, bounded);
    if (max !== undefined) bounded = Math.min(max, bounded);
    setText(formatDecimal(bounded, decimals));
    onChange(bounded);
  }

  const input = (
    <CFormInput
      {...rest}
      size={size}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  );

  if (!prefix) return input;

  return (
    <CInputGroup size={size}>
      <CInputGroupText>{prefix}</CInputGroupText>
      {input}
    </CInputGroup>
  );
}
