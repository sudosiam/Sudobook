/** Chromium File System Access API (folder picker + persistent handles). */
interface FileSystemDirectoryHandlePermissionDescriptor {
  mode: 'read' | 'readwrite';
}

interface FileSystemDirectoryHandle {
  queryPermission(descriptor: FileSystemDirectoryHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor: FileSystemDirectoryHandlePermissionDescriptor): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker(options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: FileSystemHandle | WellKnownDirectory;
  }): Promise<FileSystemDirectoryHandle>;
}

type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
