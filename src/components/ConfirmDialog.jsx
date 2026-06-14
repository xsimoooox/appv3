import { AlertCircle, Trash2 } from 'lucide-react';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Supprimer',
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="vox-modal-backdrop">
      <div className="vox-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <span className="vox-modal__danger-icon"><AlertCircle size={22} /></span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="vox-modal__actions">
          <button type="button" className="vox-button vox-button--outline" onClick={onCancel}>Annuler</button>
          <button type="button" className="vox-button vox-button--danger" onClick={onConfirm}><Trash2 size={15} /> {confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
