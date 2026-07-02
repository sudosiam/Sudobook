import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Trash2, Upload, Wrench } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button, Field, Input } from '@/components/common/Field';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SyncPanel } from '@/components/common/SyncPanel';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
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
  previewVoidReversalCleanup,
  repairVoidDoubleReversals,
} from '@/lib/migrations/voidReversalCleanup';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';
import { APP_VERSION } from '@/lib/version';

export default function Settings() {
  const settings = useSettings();
  const { activeUserId, userEmail, signIn, signUp, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [repairBusy, setRepairBusy] = useState(false);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [factoryOpen, setFactoryOpen] = useState(false);
  const [pendingSnapshotId, setPendingSnapshotId] = useState<string | null>(null);

  const localSnapshots = useLiveQuery(
    () => db.backupSnapshots.orderBy('createdAt').reverse().limit(5).toArray(),
    [],
  );

  useEffect(() => {
    if (settings?.businessName) setBusinessName(settings.businessName);
  }, [settings?.businessName]);

  if (!settings) return <LoadingSpinner />;

  const doAuth = async (mode: 'in' | 'up') => {
    setAuthBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else {
        await signUp(email, password);
        toast.info('Check your email to confirm, then sign in.');
      }
      if (mode === 'in') toast.success('Signed in — sync enabled');
      setPassword('');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Auth failed'));
    } finally {
      setAuthBusy(false);
    }
  };

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
      await runManualBackupWithArchive();
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
          `Repaired ${voidedCount} journal entr${voidedCount === 1 ? 'y' : 'ies'} — sync when online to update cloud`,
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
      await factoryReset({ userId: activeUserId });
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

          {isSupabaseConfigured && (
            <section>
              <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Cloud Account</h2>
              <div className="space-y-3 card">
                {activeUserId ? (
                  <>
                    <p className="text-sm text-foreground">
                      Signed in as <span className="text-brand-light">{userEmail}</span>
                    </p>
                    <Button variant="secondary" onClick={() => void signOut()}>
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <>
                    <Field label="Email">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Password">
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button className="flex-1" disabled={authBusy} onClick={() => void doAuth('in')}>
                        Sign In
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={authBusy}
                        onClick={() => void doAuth('up')}
                      >
                        Sign Up
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Sync</h2>
            <SyncPanel activeUserId={activeUserId} />
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-danger">Danger Zone</h2>
            <div className="space-y-3 rounded-xl border border-danger/30 bg-surface p-4">
              <Button variant="danger" className="w-full" onClick={() => setFactoryOpen(true)}>
                <Trash2 className="h-4 w-4" /> Factory Reset
              </Button>
            </div>
          </section>

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
        message="A backup file will download automatically. Then every local and cloud record will be permanently deleted. This cannot be undone."
        confirmLabel="Delete everything"
        danger
        requirePhrase="DELETE ALL"
        onConfirm={confirmFactoryReset}
        onCancel={() => setFactoryOpen(false)}
      />
    </>
  );
}
