import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Field';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title} description={message}>
      <p className="mb-5 text-sm text-muted">{message}</p>
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
          disabled={busy}
        >
          {busy ? 'Processing…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
