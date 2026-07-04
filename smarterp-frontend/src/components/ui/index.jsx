import { X, Loader2 } from 'lucide-react';

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = '' }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner() {
  return <div className="loading"><Loader2 size={20} className="spin" /><span>Loading…</span></div>;
}

// ── Empty ──────────────────────────────────────────────────────────────────
export function Empty({ message = 'No data found' }) {
  return (
    <div className="empty-state">
      <p>{message}</p>
    </div>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
export function Badge({ label, cls }) {
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Confirm dialog ─────────────────────────────────────────────────────────
export function Confirm({ open, onClose, onConfirm, title, message, loading }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 size={14} className="spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FormField wrapper ──────────────────────────────────────────────────────
export function Field({ label, error, children, required }) {
  return (
    <div className="form-group">
      {label && <label className="label">{label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}</label>}
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

// ── DateRange picker ───────────────────────────────────────────────────────
export function DateRange({ from, to, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="date" className="input" style={{ width: 140 }} value={from} onChange={e => onChange({ from: e.target.value, to })} />
      <span style={{ color: 'var(--text-3)', fontSize: 12 }}>to</span>
      <input type="date" className="input" style={{ width: 140 }} value={to} onChange={e => onChange({ from, to: e.target.value })} />
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
export function SectionHeader({ title, action }) {
  return (
    <div className="card-header">
      <span className="card-title">{title}</span>
      {action}
    </div>
  );
}
