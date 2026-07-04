/** Chromium File System Access API (folder picker + persistent handles). */
interface FileSystemDirectoryHandlePermissionDescriptor {
  mode: 'read' | 'readwrite';
}

interface FileSystemDirectoryHandle {
  queryPermission(descriptor: FileSystemDirectoryHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor: FileSystemDirectoryHandlePermissionDescriptor): Promise<PermissionState>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
}

interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: FileSystemHandle | WellKnownDirectory;
  }): Promise<FileSystemDirectoryHandle>;
}

type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
