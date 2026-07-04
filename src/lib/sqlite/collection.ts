import {
  isInsideTransaction,
  runInTransaction,
  sqlClearTable,
  sqlDeleteRow,
  sqlGetAllRows,
  sqlGetRow,
  sqlPutRow,
} from '@/lib/sqlite/engine';

type RowPredicate<T> = (row: T) => boolean;

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function inRange(
  value: unknown,
  low: unknown,
  high: unknown,
  includeLow: boolean,
  includeHigh: boolean,
): boolean {
  const belowLow = compareValues(value, low) < 0;
  const aboveHigh = compareValues(value, high) > 0;
  if (belowLow) return false;
  if (aboveHigh) return false;
  if (!includeLow && compareValues(value, low) === 0) return false;
  if (!includeHigh && compareValues(value, high) === 0) return false;
  return true;
}

export class SqlCollection<T extends { id: string }> {
  readonly predicates: RowPredicate<T>[] = [];
  indexField?: string;
  indexValue?: unknown;
  rangeLow?: unknown;
  rangeHigh?: unknown;
  rangeLowOpen = true;
  rangeHighOpen = true;
  belowOrEqualValue?: unknown;
  reversed = false;
  limitN?: number;
  offsetN = 0;

  constructor(
    readonly tableName: string,
  ) {}

  equals(value: unknown): this {
    this.indexValue = value;
    return this;
  }

  between(low: unknown, high: unknown, lowOpen = true, highOpen = true): this {
    this.rangeLow = low;
    this.rangeHigh = high;
    this.rangeLowOpen = lowOpen;
    this.rangeHighOpen = highOpen;
    return this;
  }

  belowOrEqual(value: unknown): this {
    this.belowOrEqualValue = value;
    return this;
  }

  filter(predicate: RowPredicate<T>): this {
    this.predicates.push(predicate);
    return this;
  }

  reverse(): this {
    this.reversed = !this.reversed;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  offset(n: number): this {
    this.offsetN = n;
    return this;
  }

  private loadRows(): T[] {
    return sqlGetAllRows(this.tableName) as T[];
  }

  applyFilters(rows: T[]): T[] {
    let result = rows;

    if (this.indexField != null && this.indexValue !== undefined) {
      const field = this.indexField;
      const value = this.indexValue;
      result = result.filter((r) => (r as Record<string, unknown>)[field] === value);
    }

    if (this.rangeLow !== undefined && this.rangeHigh !== undefined && this.indexField) {
      const field = this.indexField;
      result = result.filter((r) =>
        inRange(
          (r as Record<string, unknown>)[field],
          this.rangeLow,
          this.rangeHigh,
          this.rangeLowOpen,
          this.rangeHighOpen,
        ),
      );
    }

    if (this.belowOrEqualValue !== undefined && this.indexField) {
      const field = this.indexField;
      const max = this.belowOrEqualValue;
      result = result.filter(
        (r) => compareValues((r as Record<string, unknown>)[field], max) <= 0,
      );
    }

    for (const pred of this.predicates) {
      result = result.filter(pred);
    }

    if (this.indexField) {
      const field = this.indexField;
      result = [...result].sort((a, b) =>
        compareValues((a as Record<string, unknown>)[field], (b as Record<string, unknown>)[field]),
      );
      if (this.reversed) result.reverse();
    }

    if (this.offsetN > 0) result = result.slice(this.offsetN);
    if (this.limitN != null) result = result.slice(0, this.limitN);

    return result;
  }

  async toArray(): Promise<T[]> {
    return this.applyFilters(this.loadRows());
  }

  async first(): Promise<T | undefined> {
    const rows = await this.toArray();
    return rows[0];
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }

  async each(callback: (row: T) => void | boolean | Promise<void | boolean>): Promise<void> {
    const rows = await this.toArray();
    for (const row of rows) {
      const stop = await callback(row);
      if (stop === false) break;
    }
  }

  async sortBy(field: keyof T & string): Promise<T[]> {
    const rows = await this.toArray();
    return [...rows].sort((a, b) =>
      compareValues((a as Record<string, unknown>)[field], (b as Record<string, unknown>)[field]),
    );
  }

  async delete(): Promise<number> {
    const rows = this.applyFilters(this.loadRows());
    const run = () => {
      for (const row of rows) {
        sqlDeleteRow(this.tableName, row.id);
      }
      return rows.length;
    };
    if (isInsideTransaction()) return run();
    return runInTransaction(run);
  }
}

export class SqlTable<T extends { id: string }> {
  constructor(readonly name: string) {}

  where(index: string): SqlCollection<T> {
    const col = new SqlCollection<T>(this.name);
    col.indexField = index;
    return col;
  }

  orderBy(index: string): SqlCollection<T> {
    const col = new SqlCollection<T>(this.name);
    col.indexField = index;
    return col;
  }

  filter(predicate: RowPredicate<T>): SqlCollection<T> {
    const col = new SqlCollection<T>(this.name);
    col.predicates.push(predicate);
    return col;
  }

  async get(id: string): Promise<T | undefined> {
    return sqlGetRow(this.name, id) as T | undefined;
  }

  async put(row: T): Promise<string> {
    const run = () => {
      sqlPutRow(this.name, row.id, row);
      return row.id;
    };
    if (isInsideTransaction()) return run();
    return runInTransaction(run);
  }

  async add(row: T): Promise<string> {
    return this.put(row);
  }

  async update(id: string, patch: Partial<T>): Promise<number> {
    const existing = await this.get(id);
    if (!existing) return 0;
    const merged = { ...existing, ...patch };
    await this.put(merged);
    return 1;
  }

  async delete(id: string): Promise<void> {
    const run = () => {
      sqlDeleteRow(this.name, id);
    };
    if (isInsideTransaction()) {
      run();
      return;
    }
    await runInTransaction(run);
  }

  async toArray(): Promise<T[]> {
    return sqlGetAllRows(this.name) as T[];
  }

  async clear(): Promise<void> {
    const run = () => {
      sqlClearTable(this.name);
    };
    if (isInsideTransaction()) {
      run();
      return;
    }
    await runInTransaction(run);
  }

  async bulkPut(rows: T[]): Promise<void> {
    const run = () => {
      for (const row of rows) {
        sqlPutRow(this.name, row.id, row);
      }
    };
    if (isInsideTransaction()) {
      run();
      return;
    }
    await runInTransaction(run);
  }

  async count(): Promise<number> {
    return (await this.toArray()).length;
  }
}

export type TransactionMode = 'r' | 'rw' | 'r!' | 'rw!' | 'readonly' | 'readwrite';

export async function runSqlTransaction<T>(
  _mode: TransactionMode,
  _tables: readonly unknown[],
  fn: () => T | Promise<T>,
): Promise<T> {
  void _tables;
  return runInTransaction(fn);
}
