import { toINR } from '@/lib/money';

type Column<T> = {
  key: keyof T & string;
  label: string;
  format?: 'money' | 'text';
};

export function ChartDataTable<T extends object>({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
}) {
  if (rows.length === 0) return null;

  // Wrap the table — `sr-only` on `<table>` alone does not collapse layout (tables
  // ignore 1×1 sizing), which was leaving visible month/value rows below charts.
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => {
                const raw = (row as Record<string, string | number>)[col.key];
                const text =
                  col.format === 'money' && typeof raw === 'number' ? toINR(raw) : String(raw);
                return <td key={col.key}>{text}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
