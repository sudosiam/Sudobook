/** Download a CSV file in the browser. */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (cell: string): string => {
    if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  };

  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
