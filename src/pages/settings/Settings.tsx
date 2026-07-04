import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Trash2, Upload, Wrench } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button, Field, Input } from '@/components/common/Field';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useSettings } from '@/hooks/useSettings';
import { db } from '@/lib/db';
import { downloadBackup, exportBackup, restoreBackup, type BackupFile } from '@/lib/backup';
import { factoryReset } from '@/lib/factoryReset';
import {
  AUTO_BACKUP_INTERVALS,
  deleteBackupSnapshot,
  formatBackupTimestamp,
  restoreBackupSnapshot,
  runManualBackupWithArchive,
  updateAutoBackupSettings,
  type AutoBackupInterval,
} from '@/lib/scheduledBackup';
import {
  clearBackupFolder,
  isBackupFolderSupported,
  pickBackupFolder,
} from '@/lib/backupFolder';
import {
  previewVoidReversalCleanup,
  repairVoidDoubleReversals,
} from '@/lib/migrations/voidReversalCleanup';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';
import { formatStorageBytes, getStorageEstimate, type StorageEstimate } from '@/lib/storageEstimate';
import { APP_VERSION } from '@/lib/version';

export default function Settings() {
  const settings = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [repairBusy, setRepairBusy] = useState(false);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [pendingSnapshotId, setPendingSnapshotId] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageEstimate | null>(null);

  const localSnapshots = useLiveQuery(
    () => db.backupSnapshots.orderBy('createdAt').reverse().limit(5).toArray(),
    [],
  );
  const backupFolder = useLiveQuery(() => db.backupFolder.get('singleton'), []);
  const folderSupported = isBackupFolderSupported();

  useEffect(() => {
    if (settings?.businessName) setBusinessName(settings.businessName);
  }, [settings?.businessName]);

  useEffect(() => {
    void getStorageEstimate().then(setStorageInfo);
  }, []);

  if (!settings) return <LoadingSpinner />;

  const saveName = async () => {
    try {
      await db.settings.update('singleton', { businessName: businessName.trim() });
      toast.success('Saved');
    } catch (err) {
      console.error('[saveName]', err);
      toast.error(getErrorMessage(err, 'Failed to save'));
    }
  };

  const handleExport = async () => {
    try {
      await runManualBackupWithArchive(settings);
      toast.success('Backup downloaded and saved on this device');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    }
  };

  const handleQuickExport = async () => {
    try {
      downloadBackup(await exportBackup());
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'));
    }
  };

  const handleFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as BackupFile;
      setPendingRestore(parsed);
    } catch {
      toast.error('Invalid backup file');
    }
  };

  const confirmRestore = async () => {
    if (!pendingRestore) return;
    try {
      await restoreBackup(pendingRestore);
      toast.success('Backup restored');
      setPendingRestore(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Restore failed'));
    }
  };

  const scanLedgerRepair = async () => {
    setRepairBusy(true);
    try {
      const { orphanedReversals } = await previewVoidReversalCleanup();
      setOrphanCount(orphanedReversals.length);
      if (orphanedReversals.length === 0) {
        toast.success('Ledger looks correct — no orphan reversals found');
      } else {
        toast.info(
          `Found ${orphanedReversals.length} orphan reversal entr${orphanedReversals.length === 1 ? 'y' : 'ies'} from the old void bug`,
        );
      }
    } catch (err) {
      console.error('[scanLedgerRepair]', err);
      toast.error(getErrorMessage(err, 'Scan failed'));
    } finally {
      setRepairBusy(false);
    }
  };

  const runLedgerRepair = async () => {
    setRepairBusy(true);
    try {
      const { voidedCount } = await repairVoidDoubleReversals();
      setOrphanCount(0);
      if (voidedCount === 0) {
        toast.success('Nothing to repair');
      } else {
        toast.success(
          `Repaired ${voidedCount} journal entr${voidedCount === 1 ? 'y' : 'ies'}`,
        );
      }
    } catch (err) {
      console.error('[runLedgerRepair]', err);
      toast.error(getErrorMessage(err, 'Repair failed'));
    } finally {
      setRepairBusy(false);
    }
  };

  const confirmFactoryReset = async () => {
    try {
      await factoryReset();
      toast.success('Factory reset complete — backup downloaded. Reloading…');
      setFactoryOpen(false);
      window.location.href = '/';
    } catch (err) {
      console.error('[confirmFactoryReset]', err);
      toast.error(getErrorMessage(err, 'Factory reset failed'));
    }
  };

  const saveAutoBackup = async (
    patch: Parameters<typeof updateAutoBackupSettings>[0],
  ): Promise<void> => {
    try {
      await updateAutoBackupSettings(patch);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save backup settings'));
    }
  };

  const chooseBackupFolder = async () => {
    try {
      const name = await pickBackupFolder();
      await saveAutoBackup({ autoBackupSaveToFolder: true });
      toast.success(`Backups will save to folder “${name}”`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error(getErrorMessage(err, 'Could not access folder'));
    }
  };

  const removeBackupFolder = async () => {
    try {
      await clearBackupFolder();
      await saveAutoBackup({ autoBackupSaveToFolder: false });
      toast.info('Backup folder removed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove folder'));
    }
  };

  const confirmSnapshotRestore = async () => {
    if (!pendingSnapshotId) return;
    try {
      await restoreBackupSnapshot(pendingSnapshotId);
      toast.success('Backup restored from on-device snapshot');
      setPendingSnapshotId(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Restore failed'));
    }
  };

  return (
    <>
      <TopBar title="Settings" />
      <PageContainer className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Appearance</h2>
            <div className="card">
              <ThemeToggle />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Business</h2>
            <div className="space-y-3 card">
              <Field label="Business Name">
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </Field>
              <Button onClick={saveName}>Save</Button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Data Management</h2>
            <div className="space-y-4 card">
              {storageInfo && (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wider text-muted">Device storage</p>
                  <p className="text-sm text-foreground">
                    {formatStorageBytes(storageInfo.usedBytes)} of{' '}
                    {formatStorageBytes(storageInfo.quotaBytes)} used
                  </p>
                  {storageInfo.quotaBytes > 0 && (
                    <div className="h-2 overflow-hidden rounded-full bg-app">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{
                          width: `${Math.min(100, (storageInfo.usedBytes / storageInfo.quotaBytes) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                  {storageInfo.quotaBytes > 0 && storageInfo.usedBytes / storageInfo.quotaBytes > 0.8 && (
                    <p className="text-xs text-warning">
                      Storage nearly full — enable automatic backup and export old data if needed.
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-3">
                <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
                  <span className="text-sm text-foreground">Automatic backup</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-brand"
                    checked={settings.autoBackupEnabled ?? false}
                    onChange={(e) => void saveAutoBackup({ autoBackupEnabled: e.target.checked })}
                  />
                </label>
                {settings.autoBackupEnabled && (
                  <>
                    <Field label="How often">
                      <select
                        className="min-h-[48px] w-full rounded-xl border border-border-app/60 bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                        value={String(settings.autoBackupIntervalDays ?? 7)}
                        onChange={(e) =>
                          void saveAutoBackup({
                            autoBackupIntervalDays: Number(e.target.value) as AutoBackupInterval,
                          })
                        }
                      >
                        {AUTO_BACKUP_INTERVALS.map(({ days, label }) => (
                          <option key={days} value={days}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
                      <span className="text-sm text-foreground">Download JSON file</span>
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-brand"
                        checked={settings.autoBackupDownload !== false}
                        onChange={(e) =>
                          void saveAutoBackup({ autoBackupDownload: e.target.checked })
                        }
                      />
                    </label>
                    <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
                      <span className="text-sm text-foreground">Keep copies on this device</span>
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-brand"
                        checked={settings.autoBackupStoreLocal !== false}
                        onChange={(e) =>
                          void saveAutoBackup({ autoBackupStoreLocal: e.target.checked })
                        }
                      />
                    </label>
                    {folderSupported ? (
                      <div className="space-y-2 rounded-xl border border-border-app/40 bg-app p-3">
                        <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3">
                          <span className="text-sm text-foreground">Save to folder</span>
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-brand"
                            checked={settings.autoBackupSaveToFolder === true}
                            disabled={!backupFolder}
                            onChange={(e) => {
                              if (e.target.checked && !backupFolder) {
                                void chooseBackupFolder();
                                return;
                              }
                              void saveAutoBackup({ autoBackupSaveToFolder: e.target.checked });
                            }}
                          />
                        </label>
                        {backupFolder ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <p className="min-w-0 flex-1 truncate text-xs text-muted">
                              Folder:{' '}
                              <span className="font-medium text-foreground">
                                {backupFolder.folderName}
                              </span>
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="secondary"
                                className="min-h-[40px] flex-1 px-3 py-2 text-xs sm:flex-none"
                                onClick={() => void chooseBackupFolder()}
                              >
                                Change
                              </Button>
                              <Button
                                variant="secondary"
                                className="min-h-[40px] flex-1 px-3 py-2 text-xs sm:flex-none"
                                onClick={() => void removeBackupFolder()}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            className="w-full min-h-[44px] text-sm"
                            onClick={() => void chooseBackupFolder()}
                          >
                            Choose backup folder…
                          </Button>
                        )}
                        <p className="text-[11px] text-muted">
                          Automatic and “Backup now” writes JSON files directly into the folder you
                          pick (Chrome / Edge). The app remembers your choice on this device.
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        Folder backup needs a browser with folder access (Chrome or Edge on desktop
                        or Android). Use “Download JSON file” on other devices.
                      </p>
                    )}
                    <p className="text-xs text-muted">
                      Last automatic backup:{' '}
                      <span className="text-foreground">
                        {formatBackupTimestamp(settings.lastAutoBackupAt)}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      Saves up to 5 rolling snapshots on this device. For phone resets or uninstall,
                      also keep downloaded JSON files in Google Drive or email.
                    </p>
                  </>
                )}
              </div>

              <Button variant="secondary" onClick={() => void handleExport()}>
                <Download className="h-4 w-4" /> Backup now (download + save locally)
              </Button>
              <Button variant="secondary" onClick={() => void handleQuickExport()}>
                <Download className="h-4 w-4" /> Download JSON only
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Restore from file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                  e.target.value = '';
                }}
              />

              {(localSnapshots?.length ?? 0) > 0 && (
                <div className="space-y-2 border-t border-border-app/60 pt-3">
                  <p className="text-xs uppercase tracking-wider text-muted">On-device snapshots</p>
                  <ul className="space-y-2">
                    {(localSnapshots ?? []).map((snap) => (
                      <li
                        key={snap.id}
                        className="flex min-h-[64px] items-center justify-between gap-2 rounded-xl border border-border-app/40 bg-app px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {snap.label === 'auto' ? 'Automatic' : 'Manual'} backup
                          </p>
                          <p className="text-xs text-muted">
                            {formatBackupTimestamp(snap.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            variant="secondary"
                            className="min-h-[40px] px-3 py-2 text-xs"
                            onClick={() => setPendingSnapshotId(snap.id)}
                          >
                            Restore
                          </Button>
                          <button
                            type="button"
                            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-muted active:bg-surface-hover"
                            aria-label="Delete snapshot"
                            onClick={() => void deleteBackupSnapshot(snap.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Ledger Repair</h2>
            <div className="space-y-3 card">
              {orphanCount !== null && (
                <p className="text-xs text-muted">
                  Orphan reversals found:{' '}
                  <span className="font-mono font-semibold text-foreground">{orphanCount}</span>
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={repairBusy}
                  onClick={() => void scanLedgerRepair()}
                >
                  <Wrench className="h-4 w-4" /> Scan Ledger
                </Button>
                <Button
                  className="flex-1"
                  disabled={repairBusy}
                  onClick={() => void runLedgerRepair()}
                >
                  Repair Ledger
                </Button>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-danger">Danger Zone</h2>
            <div className="space-y-3 rounded-xl border border-danger/30 bg-surface p-4">
              <Button variant="danger" className="w-full" onClick={() => setFactoryOpen(true)}>
                <Trash2 className="h-4 w-4" /> Factory Reset
              </Button>
            </div>
          </section>

          <p className="text-center text-xs text-muted">
            Local app — all data stays on this device
          </p>
          <p className="text-center text-xs text-disabled">
            Sudo Books v{APP_VERSION}
          </p>
        </div>
      </PageContainer>

      <ConfirmDialog
        open={pendingSnapshotId !== null}
        title="Restore on-device snapshot?"
        message="This replaces ALL current data with the selected snapshot. This cannot be undone."
        confirmLabel="Restore"
        danger
        onConfirm={confirmSnapshotRestore}
        onCancel={() => setPendingSnapshotId(null)}
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Restore backup?"
        message="This replaces ALL current data with the backup contents. This cannot be undone."
        confirmLabel="Restore"
        danger
        onConfirm={confirmRestore}
        onCancel={() => setPendingRestore(null)}
      />

      <ConfirmDialog
        open={factoryOpen}
        title="Factory reset?"
        message="A backup file will download automatically. Then every local record will be permanently deleted. This cannot be undone."
        confirmLabel="Delete everything"
        danger
        requirePhrase="DELETE ALL"
        onConfirm={confirmFactoryReset}
        onCancel={() => setFactoryOpen(false)}
      />
    </>
  );
}
