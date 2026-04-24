import { NumericInput, type NumericInputProps } from './NumericInput';

export type CurrencyInputProps = Omit<NumericInputProps, 'decimals' | 'prefix'>;

export function CurrencyInput(props: CurrencyInputProps) {
  return <NumericInput {...props} decimals={2} prefix="R$" />;
}
