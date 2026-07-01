import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button, Field, Input } from '@/components/common/Field';
import { haptics } from '@/lib/haptics';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  requireReason,
  reasonLabel = 'Reason',
  reasonPlaceholder = 'Enter reason…',
  requirePhrase,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** User must type this exact phrase to enable confirm (e.g. "DELETE ALL"). */
  requirePhrase?: string;
  onConfirm: (reason?: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setPhrase('');
    }
  }, [open]);

  const reasonValid = !requireReason || reason.trim().length > 0;
  const phraseValid = !requirePhrase || phrase === requirePhrase;
  const canConfirm = reasonValid && phraseValid;

  const handleConfirm = async () => {
    if (busy || !canConfirm) return;
    haptics.confirm();
    setBusy(true);
    try {
      await onConfirm(requireReason ? reason.trim() : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title} description={message}>
      <p className="mb-4 text-sm text-muted">{message}</p>
      {requireReason && (
        <div className="mb-4">
          <Field label={reasonLabel}>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              autoFocus
            />
          </Field>
        </div>
      )}
      {requirePhrase && (
        <div className="mb-4">
          <Field label={`Type ${requirePhrase} to confirm`}>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={requirePhrase}
              autoFocus={!requireReason}
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={danger ? 'danger' : 'primary'}
          className="flex-1"
          onClick={() => void handleConfirm()}
          disabled={busy || !canConfirm}
        >
          {busy ? 'Processing…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
