import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { toINR } from '@/lib/money';
import { chartThemeColors, chartTooltipProps } from '@/lib/chartTheme';
import type { MonthPoint } from '@/lib/reports';
import { useThemeStore } from '@/store/useThemeStore';
import { ChartDataTable } from '@/components/charts/ChartDataTable';

export function ProfitTrendChart({ data }: { data: MonthPoint[] }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = chartThemeColors();
  const tooltip = chartTooltipProps(colors);
  const gradientId = useId();

  return (
    <div>
      <ResponsiveContainer width="100%" height={200} key={theme}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`${gradientId}-profit`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.success} stopOpacity={0.35} />
            <stop offset="100%" stopColor={colors.success} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${gradientId}-expenses`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.danger} stopOpacity={0.25} />
            <stop offset="100%" stopColor={colors.danger} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.border} vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip {...tooltip} formatter={(value: number, name: string) => [toINR(value), name]} />
        <Area
          type="monotone"
          dataKey="profit"
          name="Net Profit"
          stroke={colors.success}
          strokeWidth={2}
          fill={`url(#${gradientId}-profit)`}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          name="Op. Expenses"
          stroke={colors.danger}
          strokeWidth={2}
          fill={`url(#${gradientId}-expenses)`}
          dot={false}
        />
      </AreaChart>
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
