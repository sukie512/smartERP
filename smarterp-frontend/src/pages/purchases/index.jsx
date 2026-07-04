import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { purchases as api, suppliers, stock, banks, payments } from '../../api';
import { fmt, statusClass, pf, uid, today, fyStart } from '../../utils';
import { Spinner, Empty, Badge, DateRange, Modal, Field } from '../../components/ui';
import { Plus, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_LINE = () => ({ _id: uid(), stock_item_id: '', quantity: 1, unit_price: 0, gst_percentage: 0 });

function PurchaseForm({ onDone }) {
  const navigate = useNavigate();
  const { data: supplierList } = useApi(() => suppliers.list());
  const { data: itemList }     = useApi(() => stock.items.list());
  const [header, setHeader]   = useState({ supplier_id: '', is_igst: false, notes: '' });
  const [lines, setLines]     = useState([EMPTY_LINE()]);

  const H = (k) => ({ value: header[k], onChange: (e) => setHeader(p => ({ ...p, [k]: e.target.value })) });
  const setLine = (id, k, v) => setLines(ls => ls.map(l => l._id === id ? { ...l, [k]: v } : l));
  const addLine = () => setLines(ls => [...ls, EMPTY_LINE()]);
  const delLine = (id) => setLines(ls => ls.filter(l => l._id !== id));

  const onItemChange = (id, itemId) => {
    const item = (itemList || []).find(i => i.id === itemId);
    setLines(ls => ls.map(l => l._id === id ? {
      ...l, stock_item_id: itemId,
      unit_price: item ? pf(item.purchase_price) : 0,
      gst_percentage: item ? pf(item.gst_percentage) : 0,
    } : l));
  };

  const calcLine = (l) => {
    const taxable = pf(l.quantity) * pf(l.unit_price);
    const gst = (taxable * pf(l.gst_percentage)) / 100;
    return { taxable, gst, total: taxable + gst };
  };

  const subtotal   = lines.reduce((s, l) => s + calcLine(l).taxable, 0);
  const totalGst   = lines.reduce((s, l) => s + calcLine(l).gst, 0);
  const grandTotal = subtotal + totalGst;

  const { submit, loading } = useMutation(
    (d) => api.create(d),
    { onSuccess: () => { toast.success('Purchase recorded'); onDone(); }, onError: toast.error }
  );

  const handleSubmit = () => {
    if (!header.supplier_id) { toast.error('Select a supplier'); return; }
    if (lines.some(l => !l.stock_item_id)) { toast.error('Select item for all rows'); return; }
    if (lines.some(l => pf(l.quantity) <= 0)) { toast.error('Quantity must be > 0'); return; }
    submit({
      supplier_id: header.supplier_id,
      is_igst: header.is_igst === true || header.is_igst === 'true',
      notes: header.notes || undefined,
      items: lines.map(l => ({
        stock_item_id: l.stock_item_id,
        quantity: pf(l.quantity),
        unit_price: pf(l.unit_price),
        gst_percentage: pf(l.gst_percentage),
      })),
    });
  };

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Purchase Details</div>
          <div className="form-row form-row-2">
            <Field label="Supplier" required>
              <select className="select" {...H('supplier_id')}>
                <option value="">— Select supplier —</option>
                {(supplierList || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="GST Type">
              <select className="select" value={header.is_igst} onChange={e => setHeader(p => ({ ...p, is_igst: e.target.value === 'true' }))}>
                <option value="false">Intra-state (CGST + SGST)</option>
                <option value="true">Inter-state (IGST)</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="textarea" style={{ minHeight: 56 }} {...H('notes')} />
          </Field>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Summary</div>
          {[{ label: 'Subtotal', value: fmt(subtotal) }, { label: 'GST', value: fmt(totalGst) }].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total Payable</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, marginBottom: 20 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Items Purchased</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}><Plus size={13} /> Add Row</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th style={{ width: '35%' }}>Item</th><th>Qty</th><th>Unit Price</th><th>GST%</th><th>Taxable</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {lines.map(l => {
                const c = calcLine(l);
                return (
                  <tr key={l._id}>
                    <td><select className="select" value={l.stock_item_id} onChange={e => onItemChange(l._id, e.target.value)}>
                      <option value="">— Select item —</option>
                      {(itemList || []).map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                    </select></td>
                    <td><input className="input" type="number" min="0.001" step="0.001" value={l.quantity} onChange={e => setLine(l._id, 'quantity', e.target.value)} /></td>
                    <td><input className="input" type="number" min="0" step="0.01" value={l.unit_price} onChange={e => setLine(l._id, 'unit_price', e.target.value)} /></td>
                    <td><select className="select" value={l.gst_percentage} onChange={e => setLine(l._id, 'gst_percentage', e.target.value)}>
                      {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select></td>
                    <td className="mono">{fmt(c.taxable)}</td>
                    <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(c.total)}</td>
                    <td><button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => delLine(l._id)} disabled={lines.length === 1}><Trash2 size={13} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving…' : 'Record Purchase'}</button>
      </div>
    </div>
  );
}

export default function Purchases() {
  const [view, setView]       = useState('list'); // 'list' | 'new'
  const [filters, setFilters] = useState({ status: '', from_date: fyStart(), to_date: today() });
  const [payModal, setPayModal] = useState(null); // purchase object
  const [payForm, setPayForm]   = useState({ amount: '', payment_mode: 'bank', bank_account_id: '', note: '' });

  const { data: list, loading, refetch } = useApi(() => api.list(filters), [JSON.stringify(filters)]);
  const { data: bankList }               = useApi(() => banks.list());

  const { submit: makePayment, loading: paying } = useMutation(
    (d) => payments.make(d),
    { onSuccess: () => { toast.success('Payment recorded'); setPayModal(null); refetch(); }, onError: toast.error }
  );

  const handlePay = () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    makePayment({
      supplier_id:          payModal.supplier_id,
      amount:               parseFloat(payForm.amount),
      payment_mode:         payForm.payment_mode,
      bank_account_id:      payForm.bank_account_id || undefined,
      reference_purchase_id: payModal.id,
      note:                 payForm.note || undefined,
    });
  };

  if (view === 'new') return (
    <div>
      <div className="page-header">
        <div><div className="page-title">New Purchase</div><div className="page-sub">Record a supplier purchase</div></div>
      </div>
      <PurchaseForm onDone={() => { setView('list'); refetch(); }} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Purchases</div><div className="page-sub">{list?.length ?? 0} records</div></div>
        <button className="btn btn-primary" onClick={() => setView('new')}><Plus size={14} /> New Purchase</button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <DateRange from={filters.from_date} to={filters.to_date} onChange={({ from, to }) => setFilters(p => ({ ...p, from_date: from, to_date: to }))} />
        <select className="select" style={{ width: 150 }} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          {['unpaid', 'partial', 'paid'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Purchase #</th><th>Supplier</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {(list || []).map(p => (
                  <tr key={p.id}>
                    <td className="mono" style={{ color: 'var(--accent)' }}>{p.purchase_number}</td>
                    <td className="primary">{p.supplier_name}</td>
                    <td className="mono">{fmt(p.total_amount)}</td>
                    <td className="mono" style={{ color: 'var(--accent-2)' }}>{fmt(p.amount_paid)}</td>
                    <td className="mono" style={{ color: 'var(--warn)' }}>{fmt(Number(p.total_amount) - Number(p.amount_paid))}</td>
                    <td><Badge label={p.status} cls={statusClass(p.status)} /></td>
                    <td>{p.date}</td>
                    <td>
                      {p.status !== 'paid' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setPayModal(p);
                          setPayForm({ amount: String(Number(p.total_amount) - Number(p.amount_paid)), payment_mode: 'bank', bank_account_id: '', note: '' });
                        }}>Pay</button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!list || !list.length) && <tr><td colSpan={8}><Empty message="No purchases found." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Pay Supplier — ${payModal?.supplier_name}`}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePay} disabled={paying}>{paying ? 'Saving…' : 'Make Payment'}</button>
        </>}
      >
        <Field label="Amount" required>
          <input className="input" type="number" min="0.01" step="0.01" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
        </Field>
        <Field label="Payment Mode">
          <select className="select" value={payForm.payment_mode} onChange={e => setPayForm(p => ({ ...p, payment_mode: e.target.value }))}>
            <option value="bank">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
          </select>
        </Field>
        {payForm.payment_mode !== 'cash' && (
          <Field label="Bank Account">
            <select className="select" value={payForm.bank_account_id} onChange={e => setPayForm(p => ({ ...p, bank_account_id: e.target.value }))}>
              <option value="">— Select bank —</option>
              {(bankList || []).map(b => <option key={b.id} value={b.id}>{b.name} ({fmt(b.current_balance)})</option>)}
            </select>
          </Field>
        )}
        <Field label="Note"><input className="input" value={payForm.note} onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))} /></Field>
      </Modal>
    </div>
  );
}
