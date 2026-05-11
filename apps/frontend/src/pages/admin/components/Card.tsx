import type { ReactNode } from 'react';

interface Props {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className = '', children }: Props) {
  return (
    <section className={`adm-card ${className}`}>
      {title && <h3 className="adm-card__title">{title}</h3>}
      {children}
    </section>
  );
}
