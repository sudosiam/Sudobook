import { useEffect, useRef, useState } from 'react';
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
      const name = businessName.trim() || settings.businessName;
      await db.settings.update('singleton', { businessName: name });
      toast.success('Saved');
    } catch (err) {
      console.error('[saveName]', err);
      toast.error(getErrorMessage(err, 'Failed to save'));
    }
  };

  const handleExport = async () => {
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

  return (
    <>
      <TopBar title="Settings" />
      <PageContainer className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Appearance</h2>
            <div className="card">
              <p className="mb-3 text-sm text-muted">Choose light or dark interface</p>
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
              <p className="text-xs text-muted">
                Financial Year: {settings.currentFY} · Currency: {settings.currency}
              </p>
              <Button onClick={saveName}>Save</Button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Data Management</h2>
            <div className="space-y-3 card">
              <Button variant="secondary" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export Backup (JSON)
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Restore from Backup
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
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">Ledger Repair</h2>
            <div className="space-y-3 card">
              <p className="text-sm text-muted">
                If you voided sales, purchases, or expenses before the accounting fix, stray reversal
                journal entries may have inflated balances. This voids those orphan entries only.
              </p>
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
              <p className="text-sm text-muted">
                Factory reset downloads a full JSON backup first, then permanently erases all sales,
                purchases, expenses, inventory, ledger entries, and cloud sync data. The app returns to
                a fresh empty state with default accounts only.
              </p>
              {activeUserId && (
                <p className="text-xs text-warning">
                  You are signed in — cloud data will also be wiped. Stay online until reset finishes.
                </p>
              )}
              <Button variant="danger" className="w-full" onClick={() => setFactoryOpen(true)}>
                <Trash2 className="h-4 w-4" /> Factory Reset
              </Button>
            </div>
          </section>

          <p className="text-center text-xs text-disabled">
            Sudo Books v{APP_VERSION} · Biswajit Power Hub
          </p>
        </div>
      </PageContainer>

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
