declare module 'sql.js' {
  export interface SqlValue {
    [key: number]: string | number | Uint8Array | null;
    length: number;
  }

  export interface QueryExecResult {
    columns: string[];
    values: SqlValue[];
  }

  export interface Database {
    run(sql: string, params?: SqlValue | SqlValue[]): void;
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface Statement {
    bind(params?: SqlValue | SqlValue[]): boolean;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

  const initSqlJs: InitSqlJs;
  export default initSqlJs;
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const url: string;
  export default url;
}
