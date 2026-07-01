import { useId } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toINR } from '@/lib/money';
import { chartPalette, chartThemeColors, chartTooltipProps } from '@/lib/chartTheme';
import { useThemeStore } from '@/store/useThemeStore';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';

export function ExpenseChart({ data }: { data: { name: string; value: number }[] }) {
  const theme = useThemeStore((s) => s.theme);
  const colors = chartThemeColors();
  const palette = chartPalette(colors);
  const tooltip = chartTooltipProps(colors);
  const gradientId = useId();

  return (
    <div>
      <ResponsiveContainer width="100%" height={220} key={theme}>
        <PieChart>
          <defs>
            {palette.map((color, i) => (
              <linearGradient key={i} id={`${gradientId}-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={1} />
                <stop offset="100%" stopColor={color} stopOpacity={0.7} />
              </linearGradient>
            ))}
          </defs>
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
              <Cell key={i} fill={`url(#${gradientId}-${i % palette.length})`} stroke={colors.app} />
            ))}
          </Pie>
          <Tooltip {...tooltip} formatter={(value: number, name: string) => [toINR(value), name]} />
        </PieChart>
      </ResponsiveContainer>

      <ul className="mt-3 space-y-2 border-t border-border-app/40 pt-3">
        {data.map((item, i) => (
          <li key={item.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: palette[i % palette.length] }}
                aria-hidden
              />
              <span className="truncate text-xs text-foreground">{item.name}</span>
            </span>
            <MoneyDisplay amount={item.value} className="shrink-0 text-xs text-muted" />
          </li>
        ))}
      </ul>

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
