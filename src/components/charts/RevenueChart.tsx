import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { toINR } from '@/lib/money';
import { chartThemeColors, chartTooltipProps } from '@/lib/chartTheme';
import type { MonthPoint } from '@/lib/reports';
import { useThemeStore } from '@/store/useThemeStore';
import { ChartDataTable } from '@/components/charts/ChartDataTable';

const SERIES = [
  { key: 'revenue' as const, label: 'Revenue', colorKey: 'brand' as const },
  { key: 'cogs' as const, label: 'COGS', colorKey: 'warning' as const },
  { key: 'expenses' as const, label: 'Expenses', colorKey: 'danger' as const },
  { key: 'profit' as const, label: 'Profit', colorKey: 'success' as const },
];

export function RevenueChart({ data }: { data: MonthPoint[] }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = chartThemeColors();
  const tooltip = chartTooltipProps(colors);

  return (
    <div>
      <ResponsiveContainer width="100%" height={220} key={theme}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: colors.surfaceHover }}
          {...tooltip}
          formatter={(value: number, name: string) => [toINR(value), name]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: colors.muted, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        {SERIES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={colors[s.colorKey]}
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
      <ChartDataTable
        caption="Monthly revenue, COGS, expenses, and profit"
        columns={[
          { key: 'month', label: 'Month', format: 'text' },
          { key: 'revenue', label: 'Revenue', format: 'money' },
          { key: 'cogs', label: 'COGS', format: 'money' },
          { key: 'expenses', label: 'Expenses', format: 'money' },
          { key: 'profit', label: 'Profit', format: 'money' },
        ]}
        rows={data}
      />
    </div>
  );
}
