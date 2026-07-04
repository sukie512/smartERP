import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { journal as api } from '../../api';
import { fmt, uid } from '../../utils';
import { Spinner, Empty, Modal, Field } from '../../components/ui';
import { Plus, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_ENTRY = () => ({ _id: uid(), ledger_id: '', entry_type: 'debit', amount: '' });

export default function Journal() {
  const [modal, setModal] = useState(null);
  const [sel, setSel]     = useState(null);
  const [form, setForm]   = useState({ description: '', entries: [EMPTY_ENTRY(), EMPTY_ENTRY()] });

  const { data: list,    loading: lL, refetch } = useApi(() => api.list());
  const { data: ledgers, loading: ledL }         = useApi(() => api.ledgers());
  const { data: detail,  loading: dL }           = useApi(
    () => sel?.id && modal === 'view' ? api.get(sel.id) : Promise.resolve({ data: null }),
    [sel?.id, modal]
  );

  const setEntry = (id, k, v) => setForm(f => ({ ...f, entries: f.entries.map(e => e._id === id ? { ...e, [k]: v } : e) }));
  const addEntry = () => setForm(f => ({ ...f, entries: [...f.entries, EMPTY_ENTRY()] }));
  const delEntry = (id) => setForm(f => ({ ...f, entries: f.entries.filter(e => e._id !== id) }));

  const totalDebits  = form.entries.filter(e => e.entry_type === 'debit').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalCredits = form.entries.filter(e => e.entry_type === 'credit').reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const isBalanced   = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const { submit, loading: saving } = useMutation(
    (d) => api.create(d),
    { onSuccess: () => { toast.success('Journal voucher created'); setModal(null); refetch(); }, onError: toast.error }
  );

  const handleSubmit = () => {
    if (!form.entries.some(e => e.entry_type === 'debit') || !form.entries.some(e => e.entry_type === 'credit')) {
      toast.error('Need at least one debit and one credit entry'); return;
    }
    if (!isBalanced) { toast.error('Debits must equal credits'); return; }
    if (form.entries.some(e => !e.ledger_id)) { toast.error('Select ledger for all entries'); return; }

    submit({
      description: form.description,
      entries: form.entries.map(e => ({
        ledger_id:  e.ledger_id,
        entry_type: e.entry_type,
        amount:     parseFloat(e.amount),
      })),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Journal Vouchers</div><div className="page-sub">Manual accounting adjustments</div></div>
        <button className="btn btn-primary" onClick={() => {
          setForm({ description: '', entries: [EMPTY_ENTRY(), EMPTY_ENTRY()] });
          setModal('new');
        }}><Plus size={14} /> New Journal Entry</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {lL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Voucher #</th><th>Description</th><th>Amount</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {(list || []).map(j => (
                  <tr key={j.id}>
                    <td className="mono" style={{ color: 'var(--accent)' }}>{j.voucher_number}</td>
                    <td className="primary">{j.description || '—'}</td>
                    <td className="mono">{fmt(j.total_amount)}</td>
                    <td>{j.date}</td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSel(j); setModal('view'); }}><Eye size={13} /></button>
                    </td>
                  </tr>
                ))}
                {(!list || !list.length) && <tr><td colSpan={5}><Empty message="No journal vouchers yet." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Journal Entry Modal */}
      <Modal open={modal === 'new'} onClose={() => setModal(null)} title="New Journal Voucher" size="modal-lg"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div style={{ flex: 1, fontSize: 12 }}>
              <span style={{ color: isBalanced ? 'var(--accent-2)' : 'var(--danger)', fontFamily: 'var(--mono)' }}>
                Dr {fmt(totalDebits)} / Cr {fmt(totalCredits)}
                {isBalanced ? ' ✓ Balanced' : ' — Not balanced'}
              </span>
            </div>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !isBalanced}>{saving ? 'Saving…' : 'Post Voucher'}</button>
          </div>
        }
      >
        <Field label="Description">
          <input className="input" placeholder="Purpose of this journal entry" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </Field>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span className="label" style={{ margin: 0 }}>Entries</span>
            <button className="btn btn-secondary btn-sm" onClick={addEntry}><Plus size={12} /> Add Row</button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead><tr><th style={{ width: '50%' }}>Ledger Account</th><th>Type</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                {form.entries.map(e => (
                  <tr key={e._id}>
                    <td>
                      <select className="select" value={e.ledger_id} onChange={ev => setEntry(e._id, 'ledger_id', ev.target.value)}>
                        <option value="">— Select ledger —</option>
                        {(ledgers || []).map(l => <option key={l.id} value={l.id}>{l.display_name || l.name} ({l.group_type})</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="select" value={e.entry_type} onChange={ev => setEntry(e._id, 'entry_type', ev.target.value)}>
                        <option value="debit">Debit (Dr)</option>
                        <option value="credit">Credit (Cr)</option>
                      </select>
                    </td>
                    <td><input className="input" type="number" min="0.01" step="0.01" placeholder="0.00" value={e.amount} onChange={ev => setEntry(e._id, 'amount', ev.target.value)} /></td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => delEntry(e._id)} disabled={form.entries.length <= 2}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* View Detail Modal */}
      <Modal open={modal === 'view'} onClose={() => { setModal(null); setSel(null); }} title={`Journal Voucher — ${sel?.voucher_number}`} size="modal-lg">
        {dL ? <Spinner /> : detail ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>{detail.description || 'No description'}</p>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Ledger</th><th>Group</th><th>Type</th><th>Amount</th></tr></thead>
                <tbody>
                  {(detail.entries || []).map(e => (
                    <tr key={e.id}>
                      <td className="primary">{e.ledger_name}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 11 }}>{e.group_type}</td>
                      <td><span className={`badge ${e.entry_type === 'debit' ? 'badge-blue' : 'badge-green'}`}>{e.entry_type}</span></td>
                      <td className="mono">{fmt(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>Total: {fmt(detail.total_amount)}</span>
            </div>
          </>
        ) : <Empty />}
      </Modal>
    </div>
  );
}
