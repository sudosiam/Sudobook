import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { toINR } from '@/lib/money';
import { chartThemeColors, chartTooltipProps } from '@/lib/chartTheme';
import type { MonthPoint } from '@/lib/reports';
import { useThemeStore } from '@/store/useThemeStore';
import { ChartDataTable } from '@/components/charts/ChartDataTable';

export function ProfitTrendChart({ data }: { data: MonthPoint[] }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = chartThemeColors();
  const tooltip = chartTooltipProps(colors);

  return (
    <div>
      <ResponsiveContainer width="100%" height={200} key={theme}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltip} formatter={(value: number, name: string) => [toINR(value), name]} />
        <Line type="monotone" dataKey="profit" name="Net Profit" stroke={colors.success} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="expenses" name="Op. Expenses" stroke={colors.danger} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
      <ChartDataTable
        caption="Monthly net profit and operating expenses"
        columns={[
          { key: 'month', label: 'Month', format: 'text' },
          { key: 'profit', label: 'Net Profit', format: 'money' },
          { key: 'expenses', label: 'Op. Expenses', format: 'money' },
        ]}
        rows={data}
      />
    </div>
  );
}
