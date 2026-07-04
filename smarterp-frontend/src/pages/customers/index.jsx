import { useState, useCallback } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { customers as api } from '../../api';
import { fmt, debounce } from '../../utils';
import { Modal, Confirm, Spinner, Empty, Field } from '../../components/ui';
import { Plus, Search, Edit2, Trash2, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', mobile: '', email: '', address: '', gstin: '', state: '' };

export default function Customers() {
  const [search, setSearch]   = useState('');
  const [q, setQ]             = useState('');
  const [modal, setModal]     = useState(null); // null | 'add' | 'edit' | 'statement' | 'delete'
  const [selected, setSelected] = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [errors, setErrors]   = useState({});

  const { data: list, loading, refetch } = useApi(() => api.list({ search: q }), [q]);
  const { data: stmt, loading: stmtL }   = useApi(
    () => selected?.id && modal === 'statement' ? api.statement(selected.id) : Promise.resolve({ data: null }),
    [selected?.id, modal]
  );

  const debouncedSearch = useCallback(debounce(v => setQ(v), 400), []);
  const handleSearch = (e) => { setSearch(e.target.value); debouncedSearch(e.target.value); };

  const openAdd  = () => { setForm(EMPTY_FORM); setErrors({}); setModal('add'); };
  const openEdit = (c) => { setSelected(c); setForm({ name: c.name, mobile: c.mobile, email: c.email || '', address: c.address || '', gstin: c.gstin || '', state: c.state || '' }); setErrors({}); setModal('edit'); };
  const openStmt = (c) => { setSelected(c); setModal('statement'); };
  const openDel  = (c) => { setSelected(c); setModal('delete'); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.mobile.trim()) e.mobile = 'Mobile is required';
    else if (!/^\d{10}$/.test(form.mobile)) e.mobile = 'Enter valid 10-digit mobile';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const { submit: save, loading: saving } = useMutation(
    (data) => modal === 'add' ? api.create(data) : api.update(selected.id, data),
    {
      onSuccess: () => { toast.success(modal === 'add' ? 'Customer added' : 'Customer updated'); setModal(null); refetch(); },
      onError: (e) => toast.error(e),
    }
  );

  const { submit: del, loading: deleting } = useMutation(
    () => api.remove(selected.id),
    {
      onSuccess: () => { toast.success('Customer deleted'); setModal(null); refetch(); },
      onError: (e) => toast.error(e),
    }
  );

  const handleSave = () => { if (validate()) save(form); };

  const F = (k) => ({ value: form[k], onChange: (e) => setForm(p => ({ ...p, [k]: e.target.value })) });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-sub">{list?.length ?? 0} total customers</div>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={14} /> Add Customer</button>
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
              <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>GSTIN</th><th>Outstanding</th><th>Actions</th></tr></thead>
              <tbody>
                {(list || []).map(c => (
                  <tr key={c.id}>
                    <td className="primary">{c.name}</td>
                    <td>{c.mobile}</td>
                    <td style={{ color: 'var(--text-3)' }}>{c.email || '—'}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{c.gstin || '—'}</td>
                    <td className="mono" style={{ color: Number(c.outstanding_balance) > 0 ? 'var(--danger)' : 'var(--text-3)' }}>
                      {fmt(c.outstanding_balance)}
                    </td>
                    <td>
                      <div className="action-row">
                        <button className="btn btn-ghost btn-icon btn-sm" title="Ledger Statement" onClick={() => openStmt(c)}><FileText size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => openEdit(c)}><Edit2 size={13} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Delete" onClick={() => openDel(c)} style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!list || list.length === 0) && <tr><td colSpan={6}><Empty message="No customers yet. Add your first customer." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'add' ? 'Add Customer' : 'Edit Customer'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Customer'}
            </button>
          </>
        }
      >
        <div className="form-row form-row-2">
          <Field label="Name" required error={errors.name}><input className={`input${errors.name ? ' input-error' : ''}`} placeholder="Full name" {...F('name')} /></Field>
          <Field label="Mobile" required error={errors.mobile}><input className={`input${errors.mobile ? ' input-error' : ''}`} placeholder="10-digit mobile" maxLength={10} {...F('mobile')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="Email"><input className="input" type="email" placeholder="email@example.com" {...F('email')} /></Field>
          <Field label="GSTIN"><input className="input" placeholder="22AAAAA0000A1Z5" {...F('gstin')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="State"><input className="input" placeholder="e.g. Maharashtra" {...F('state')} /></Field>
        </div>
        <Field label="Address"><textarea className="textarea" placeholder="Full address" {...F('address')} /></Field>
      </Modal>

      {/* Statement Modal */}
      <Modal open={modal === 'statement'} onClose={() => setModal(null)} title={`Ledger Statement — ${selected?.name}`} size="modal-lg">
        {stmtL ? <Spinner /> : stmt ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 16px', background: 'var(--bg-3)', borderRadius: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Outstanding Balance</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: Number(stmt.ledger?.balance) > 0 ? 'var(--danger)' : 'var(--accent-2)' }}>
                {fmt(stmt.ledger?.balance)}
              </span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th></tr></thead>
                <tbody>
                  {(stmt.entries || []).map(e => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                      <td>{e.description}</td>
                      <td className="mono" style={{ color: 'var(--danger)' }}>{e.entry_type === 'debit' ? fmt(e.amount) : '—'}</td>
                      <td className="mono" style={{ color: 'var(--accent-2)' }}>{e.entry_type === 'credit' ? fmt(e.amount) : '—'}</td>
                      <td className="mono">{fmt(e.running_balance)}</td>
                    </tr>
                  ))}
                  {(!stmt.entries || stmt.entries.length === 0) && <tr><td colSpan={5}><Empty message="No transactions yet" /></td></tr>}
                </tbody>
              </table>
            </div>
          </>
        ) : <Empty message="No ledger found" />}
      </Modal>

      {/* Delete Confirm */}
      <Confirm
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        onConfirm={del}
        loading={deleting}
        title="Delete Customer"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
      />
    </div>
  );
}
