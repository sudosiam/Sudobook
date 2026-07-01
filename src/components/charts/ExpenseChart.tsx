import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toINR } from '@/lib/money';
import { chartPalette, chartThemeColors, chartTooltipProps } from '@/lib/chartTheme';
import { useThemeStore } from '@/store/useThemeStore';
import { ChartDataTable } from '@/components/charts/ChartDataTable';

export function ExpenseChart({ data }: { data: { name: string; value: number }[] }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = chartThemeColors();
  const palette = chartPalette(colors);
  const tooltip = chartTooltipProps(colors);

  return (
    <div>
      <ResponsiveContainer width="100%" height={220} key={theme}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} stroke={colors.app} />
          ))}
        </Pie>
        <Tooltip
          {...tooltip}
          formatter={(value: number, name: string) => [toINR(value), name]}
        />
      </PieChart>
    </ResponsiveContainer>
      <ChartDataTable
        caption="Expense breakdown by category"
        columns={[
          { key: 'name', label: 'Category', format: 'text' },
          { key: 'value', label: 'Amount', format: 'money' },
        ]}
        rows={data}
      />
    </div>
  );
}
