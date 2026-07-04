import Dexie, { type Table } from 'dexie';

/** Only stores the user-selected data-folder handle — not business data. */
export interface DataFolderRecord {
  id: 'singleton';
  folderName: string;
  handle: FileSystemDirectoryHandle;
}

class MetaDB extends Dexie {
  dataFolder!: Table<DataFolderRecord, string>;

  constructor() {
    super('SudoBooksMeta');
    this.version(1).stores({ dataFolder: 'id' });
  }
}

export const metaDb = new MetaDB();
