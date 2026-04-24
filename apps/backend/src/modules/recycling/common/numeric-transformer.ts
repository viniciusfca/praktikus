/**
 * TypeORM transformer that converts PostgreSQL NUMERIC/DECIMAL columns
 * (returned as string to preserve precision) into JS numbers when reading,
 * and passes numbers through unchanged when writing.
 */
export const numericTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => (value === null ? null : parseFloat(value)),
};
