import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
  children: ReactNode;
}

export function Button({
  variant = 'default',
  className = '',
  children,
  ...rest
}: Props) {
  const cls = variant === 'primary' ? 'adm-btn adm-btn--primary' : 'adm-btn';
  return (
    <button className={`${cls} ${className}`} {...rest}>
      {children}
    </button>
  );
}
