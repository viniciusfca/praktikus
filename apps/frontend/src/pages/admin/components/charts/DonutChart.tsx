import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Slice {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: Slice[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: Props) {
  return (
    <div style={{ width: size, height: size }}>
      <Doughnut
        data={{
          labels: data.map((d) => d.label),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: data.map((d) => d.color),
              borderWidth: 0,
            },
          ],
        }}
        options={{
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          maintainAspectRatio: false,
        }}
      />
    </div>
  );
}
