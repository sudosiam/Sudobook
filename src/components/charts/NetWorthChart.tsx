import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toINR } from '@/lib/money';
import { chartThemeColors, chartTooltipProps } from '@/lib/chartTheme';
import type { NetWorthPoint } from '@/lib/reports';
import { useThemeStore } from '@/store/useThemeStore';
import { ChartDataTable } from '@/components/charts/ChartDataTable';

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = chartThemeColors();
  const tooltip = chartTooltipProps(colors);

  return (
    <div>
      <ResponsiveContainer width="100%" height={176} key={theme}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="month"
          tick={{ fill: colors.muted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ stroke: colors.border }}
          {...tooltip}
          formatter={(value: number) => [toINR(value), 'Net Worth']}
        />
        <Line type="monotone" dataKey="netWorth" stroke={colors.brandLight} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
      <ChartDataTable
        caption="Net worth over time"
        columns={[
          { key: 'month', label: 'Month', format: 'text' },
          { key: 'netWorth', label: 'Net Worth', format: 'money' },
        ]}
        rows={data}
      />
    </div>
  );
}
