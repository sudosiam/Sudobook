import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import {
  getDataFolderRecord,
  readDatabaseFile,
  writeDatabaseFile,
} from '@/lib/dataFolder';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS records (
  table_name TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (table_name, id)
);
CREATE INDEX IF NOT EXISTS idx_records_table ON records(table_name);
`;

let sqlModulePromise: ReturnType<typeof initSqlJs> | null = null;
let dbInstance: Database | null = null;
let folderHandle: FileSystemDirectoryHandle | null = null;
let persistChain: Promise<void> = Promise.resolve();
let changeListeners = new Set<() => void>();
let transactionDepth = 0;

export function isInsideTransaction(): boolean {
  return transactionDepth > 0;
}

async function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlModulePromise;
}

export function subscribeDbChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function notifyDbChange(): void {
  for (const listener of changeListeners) {
    try {
      listener();
    } catch (err) {
      console.error('[notifyDbChange]', err);
    }
  }
}

function schedulePersist(): void {
  if (!dbInstance || !folderHandle) return;
  const bytes = dbInstance.export();
  const handle = folderHandle;
  persistChain = persistChain
    .then(async () => {
      await writeDatabaseFile(handle, bytes);
    })
    .catch((err) => {
      console.error('[schedulePersist]', err);
    });
}

export async function flushDatabase(): Promise<void> {
  await persistChain;
}

export function getSqlDatabase(): Database {
  if (!dbInstance) {
    throw new Error('Database not initialised — choose a data folder first');
  }
  return dbInstance;
}

export function isDatabaseReady(): boolean {
  return dbInstance != null;
}

export async function initDatabaseFromFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  const SQL = await getSqlModule();
  const existing = await readDatabaseFile(handle);
  dbInstance = existing ? new SQL.Database(existing) : new SQL.Database();
  folderHandle = handle;
  dbInstance.run(SCHEMA_SQL);
  if (!existing) {
    schedulePersist();
  }
}

export async function reopenDatabaseFromFolder(): Promise<void> {
  const record = await getDataFolderRecord();
  if (!record) throw new Error('No data folder configured');
  const SQL = await getSqlModule();
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  const existing = await readDatabaseFile(record.handle);
  dbInstance = existing ? new SQL.Database(existing) : new SQL.Database();
  folderHandle = record.handle;
  dbInstance.run(SCHEMA_SQL);
}

export function closeDatabase(): void {
  dbInstance?.close();
  dbInstance = null;
  folderHandle = null;
}

export function runInTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
  if (transactionDepth > 0) {
    return Promise.resolve(fn());
  }

  const sql = getSqlDatabase();
  transactionDepth++;
  sql.run('BEGIN IMMEDIATE');
  const finish = async (result: T): Promise<T> => {
    sql.run('COMMIT');
    transactionDepth--;
    schedulePersist();
    notifyDbChange();
    await persistChain;
    return result;
  };
  const fail = (err: unknown): Promise<never> => {
    try {
      sql.run('ROLLBACK');
    } catch {
      /* ignore */
    }
    transactionDepth--;
    return Promise.reject(err);
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(finish).catch(fail);
    }
    return finish(result);
  } catch (err) {
    return fail(err);
  }
}

export function sqlGetAllRows(tableName: string): unknown[] {
  const sql = getSqlDatabase();
  const stmt = sql.prepare('SELECT data FROM records WHERE table_name = ?');
  stmt.bind([tableName]);
  const rows: unknown[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { data: string };
    rows.push(JSON.parse(row.data));
  }
  stmt.free();
  return rows;
}

export function sqlGetRow(tableName: string, id: string): unknown | undefined {
  const sql = getSqlDatabase();
  const stmt = sql.prepare('SELECT data FROM records WHERE table_name = ? AND id = ?');
  stmt.bind([tableName, id]);
  if (!stmt.step()) {
    stmt.free();
    return undefined;
  }
  const row = stmt.getAsObject() as { data: string };
  stmt.free();
  return JSON.parse(row.data);
}

export function sqlPutRow(tableName: string, id: string, data: unknown): void {
  const sql = getSqlDatabase();
  const json = JSON.stringify(data);
  sql.run('INSERT OR REPLACE INTO records (table_name, id, data) VALUES (?, ?, ?)', [
    tableName,
    id,
    json,
  ] as SqlValue[]);
}

export function sqlDeleteRow(tableName: string, id: string): void {
  const sql = getSqlDatabase();
  sql.run('DELETE FROM records WHERE table_name = ? AND id = ?', [tableName, id] as SqlValue[]);
}

export function sqlClearTable(tableName: string): void {
  const sql = getSqlDatabase();
  sql.run('DELETE FROM records WHERE table_name = ?', [tableName] as SqlValue[]);
}

export function sqlCountTable(tableName: string): number {
  const sql = getSqlDatabase();
  const stmt = sql.prepare('SELECT COUNT(*) AS c FROM records WHERE table_name = ?');
  stmt.bind([tableName]);
  stmt.step();
  const row = stmt.getAsObject() as { c: number };
  stmt.free();
  return row.c;
}
