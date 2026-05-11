interface Props {
  width?: number | string;
  height?: number | string;
}

export function Skeleton({ width = '100%', height = 16 }: Props) {
  return (
    <span
      className="adm-skeleton"
      style={{ width, height, display: 'inline-block' }}
      aria-hidden="true"
    />
  );
}
