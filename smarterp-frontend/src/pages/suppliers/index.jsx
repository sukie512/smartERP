import { useState, useCallback } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { suppliers as api } from '../../api';
import { fmt, debounce } from '../../utils';
import { Modal, Confirm, Spinner, Empty, Field } from '../../components/ui';
import { Plus, Search, Edit2, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY = { name: '', mobile: '', email: '', address: '', gstin: '', state: '' };

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [q, setQ]           = useState('');
  const [modal, setModal]   = useState(null);
  const [sel, setSel]       = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const { data: list, loading, refetch } = useApi(() => api.list({ search: q }), [q]);
  const { data: stmt, loading: stmtL }   = useApi(
    () => sel?.id && modal === 'statement' ? api.statement(sel.id) : Promise.resolve({ data: null }),
    [sel?.id, modal]
  );

  const debouncedSearch = useCallback(debounce(v => setQ(v), 400), []);
  const handleSearch = (e) => { setSearch(e.target.value); debouncedSearch(e.target.value); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.mobile.trim()) e.mobile = 'Mobile is required';
    else if (!/^\d{10}$/.test(form.mobile)) e.mobile = 'Enter valid 10-digit mobile';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const { submit: save, loading: saving } = useMutation(
    (data) => modal === 'add' ? api.create(data) : api.update(sel.id, data),
    { onSuccess: () => { toast.success(modal === 'add' ? 'Supplier added' : 'Supplier updated'); setModal(null); refetch(); }, onError: toast.error }
  );

  const { submit: del, loading: deleting } = useMutation(
    () => api.remove(sel.id),
    { onSuccess: () => { toast.success('Supplier deleted'); setModal(null); refetch(); }, onError: toast.error }
  );

  const F = (k) => ({ value: form[k], onChange: (e) => setForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Suppliers</div>
          <div className="page-sub">{list?.length ?? 0} total suppliers</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setErrors({}); setSel(null); setModal('add'); }}>
          <Plus size={14} /> Add Supplier
        </button>
      </div>

      <div className="search-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input className="input search-input" placeholder="Search by name or mobile…" value={search} onChange={handleSearch} />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>GSTIN</th><th>Outstanding Dues</th><th>Actions</th></tr></thead>
              <tbody>
                {(list || []).map(s => (
                  <tr key={s.id}>
                    <td className="primary">{s.name}</td>
                    <td>{s.mobile}</td>
                    <td style={{ color: 'var(--text-3)' }}>{s.email || '—'}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{s.gstin || '—'}</td>
                    <td className="mono" style={{ color: Number(s.outstanding_dues) > 0 ? 'var(--warn)' : 'var(--text-3)' }}>
                      {fmt(s.outstanding_dues)}
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="btn btn-ghost btn-icon btn-sm" title="Statement" onClick={() => { setSel(s); setModal('statement'); }}><FileText size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSel(s); setForm({ name: s.name, mobile: s.mobile, email: s.email || '', address: s.address || '', gstin: s.gstin || '', state: s.state || '' }); setErrors({}); setModal('edit'); }}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setSel(s); setModal('delete'); }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!list || !list.length) && <tr><td colSpan={6}><Empty message="No suppliers yet." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Supplier' : 'Edit Supplier'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (validate()) save(form); }} disabled={saving}>{saving ? 'Saving…' : 'Save Supplier'}</button>
        </>}
      >
        <div className="form-row form-row-2">
          <Field label="Name" required error={errors.name}><input className={`input${errors.name ? ' input-error' : ''}`} placeholder="Supplier name" {...F('name')} /></Field>
          <Field label="Mobile" required error={errors.mobile}><input className={`input${errors.mobile ? ' input-error' : ''}`} placeholder="10-digit mobile" maxLength={10} {...F('mobile')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="Email"><input className="input" type="email" {...F('email')} /></Field>
          <Field label="GSTIN"><input className="input" placeholder="GSTIN number" {...F('gstin')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="State"><input className="input" placeholder="e.g. Gujarat" {...F('state')} /></Field>
        </div>
        <Field label="Address"><textarea className="textarea" {...F('address')} /></Field>
      </Modal>

      <Modal open={modal === 'statement'} onClose={() => setModal(null)} title={`Ledger — ${sel?.name}`} size="modal-lg">
        {stmtL ? <Spinner /> : stmt ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Outstanding Dues</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: 'var(--warn)' }}>{fmt(stmt.ledger?.balance)}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                <tbody>
                  {(stmt.entries || []).map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td><td>{e.description}</td>
                      <td className="mono" style={{ color: 'var(--danger)' }}>{e.entry_type === 'debit' ? fmt(e.amount) : '—'}</td>
                      <td className="mono" style={{ color: 'var(--accent-2)' }}>{e.entry_type === 'credit' ? fmt(e.amount) : '—'}</td>
                      <td className="mono">{fmt(e.running_balance)}</td>
                    </tr>
                  ))}
                  {!stmt.entries?.length && <tr><td colSpan={5}><Empty message="No transactions" /></td></tr>}
                </tbody>
              </table>
            </div>
          </>
        ) : <Empty />}
      </Modal>

      <Confirm open={modal === 'delete'} onClose={() => setModal(null)} onConfirm={del} loading={deleting}
        title="Delete Supplier" message={`Delete "${sel?.name}"? This cannot be undone.`} />
    </div>
  );
}
