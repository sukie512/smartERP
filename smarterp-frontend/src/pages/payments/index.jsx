import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { payments as api, customers, suppliers, banks, invoices, purchases } from '../../api';
import { fmt, statusClass, today, fyStart } from '../../utils';
import { Spinner, Empty, Badge, Modal, Field, DateRange } from '../../components/ui';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const EXPENSE_NAMES = ['Rent', 'Salary', 'Electricity', 'Internet', 'Maintenance', 'Other'];

export default function Payments() {
  const [tab, setTab]     = useState('receipts');
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState({ from_date: fyStart(), to_date: today() });

  // forms
  const [recForm, setRecForm]   = useState({ customer_id: '', amount: '', payment_mode: 'bank', bank_account_id: '', reference_invoice_id: '', note: '' });
  const [payForm, setPayForm]   = useState({ supplier_id: '', amount: '', payment_mode: 'bank', bank_account_id: '', reference_purchase_id: '', note: '' });
  const [expForm, setExpForm]   = useState({ expense_name: 'Rent', amount: '', payment_mode: 'bank', bank_account_id: '', note: '' });

  const { data: receiptList, loading: rL, refetch: rR } = useApi(() => api.receipts(filters), [JSON.stringify(filters), tab]);
  const { data: paymentList, loading: pL, refetch: pR } = useApi(() => api.payments(filters), [JSON.stringify(filters), tab]);
  const { data: customerList } = useApi(() => customers.list());
  const { data: supplierList } = useApi(() => suppliers.list());
  const { data: bankList }     = useApi(() => banks.list());
  const { data: invoiceList }  = useApi(() => invoices.list({ status: 'unpaid' }));
  const { data: purchaseList } = useApi(() => purchases.list({ status: 'unpaid' }));

  const { submit: receivePayment, loading: receiving } = useMutation(
    (d) => api.receive(d),
    { onSuccess: () => { toast.success('Receipt recorded'); setModal(null); rR(); }, onError: toast.error }
  );

  const { submit: makePayment, loading: making } = useMutation(
    (d) => api.make(d),
    { onSuccess: () => { toast.success('Payment recorded'); setModal(null); pR(); }, onError: toast.error }
  );

  const { submit: recordExpense, loading: expensing } = useMutation(
    (d) => api.expense(d),
    { onSuccess: () => { toast.success('Expense recorded'); setModal(null); pR(); }, onError: toast.error }
  );

  const RF = (k) => ({ value: recForm[k], onChange: (e) => setRecForm(p => ({ ...p, [k]: e.target.value })) });
  const PF = (k) => ({ value: payForm[k], onChange: (e) => setPayForm(p => ({ ...p, [k]: e.target.value })) });
  const EF = (k) => ({ value: expForm[k], onChange: (e) => setExpForm(p => ({ ...p, [k]: e.target.value })) });

  const handleReceipt = () => {
    if (!recForm.customer_id || !recForm.amount) { toast.error('Select customer and enter amount'); return; }
    receivePayment({ ...recForm, amount: parseFloat(recForm.amount), bank_account_id: recForm.bank_account_id || undefined, reference_invoice_id: recForm.reference_invoice_id || undefined });
  };

  const handlePayment = () => {
    if (!payForm.supplier_id || !payForm.amount) { toast.error('Select supplier and enter amount'); return; }
    makePayment({ ...payForm, amount: parseFloat(payForm.amount), bank_account_id: payForm.bank_account_id || undefined, reference_purchase_id: payForm.reference_purchase_id || undefined });
  };

  const handleExpense = () => {
    if (!expForm.amount) { toast.error('Enter amount'); return; }
    recordExpense({ ...expForm, amount: parseFloat(expForm.amount), bank_account_id: expForm.bank_account_id || undefined });
  };

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Payments</div><div className="page-sub">Receipts, payments & expenses</div></div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => setModal('expense')}><Plus size={14} /> Record Expense</button>
          <button className="btn btn-secondary" onClick={() => { setPayForm({ supplier_id: '', amount: '', payment_mode: 'bank', bank_account_id: '', reference_purchase_id: '', note: '' }); setModal('payment'); }}><Plus size={14} /> Make Payment</button>
          <button className="btn btn-primary" onClick={() => { setRecForm({ customer_id: '', amount: '', payment_mode: 'bank', bank_account_id: '', reference_invoice_id: '', note: '' }); setModal('receipt'); }}><Plus size={14} /> Receive Payment</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <DateRange from={filters.from_date} to={filters.to_date} onChange={({ from, to }) => setFilters({ from_date: from, to_date: to })} />
      </div>

      <div className="tabs">
        {['receipts', 'payments'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'receipts' ? 'Receipts (Money In)' : 'Payments (Money Out)'}
          </div>
        ))}
      </div>

      {tab === 'receipts' && (
        <div className="card" style={{ padding: 0 }}>
          {rL ? <Spinner /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Receipt #</th><th>Customer</th><th>Amount</th><th>Mode</th><th>Note</th><th>Date</th></tr></thead>
                <tbody>
                  {(receiptList || []).map(r => (
                    <tr key={r.id}>
                      <td className="mono" style={{ color: 'var(--accent-2)' }}>{r.receipt_number}</td>
                      <td className="primary">{r.customer_name}</td>
                      <td className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{fmt(r.amount)}</td>
                      <td><Badge label={r.payment_mode} cls="badge-blue" /></td>
                      <td style={{ color: 'var(--text-3)' }}>{r.note || '—'}</td>
                      <td>{r.date}</td>
                    </tr>
                  ))}
                  {(!receiptList || !receiptList.length) && <tr><td colSpan={6}><Empty message="No receipts in this period." /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card" style={{ padding: 0 }}>
          {pL ? <Spinner /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Payment #</th><th>Supplier</th><th>Amount</th><th>Mode</th><th>Note</th><th>Date</th></tr></thead>
                <tbody>
                  {(paymentList || []).map(p => (
                    <tr key={p.id}>
                      <td className="mono" style={{ color: 'var(--danger)' }}>{p.payment_number}</td>
                      <td className="primary">{p.supplier_name}</td>
                      <td className="mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>{fmt(p.amount)}</td>
                      <td><Badge label={p.payment_mode} cls="badge-blue" /></td>
                      <td style={{ color: 'var(--text-3)' }}>{p.note || '—'}</td>
                      <td>{p.date}</td>
                    </tr>
                  ))}
                  {(!paymentList || !paymentList.length) && <tr><td colSpan={6}><Empty message="No payments in this period." /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Receive Payment Modal */}
      <Modal open={modal === 'receipt'} onClose={() => setModal(null)} title="Receive Payment"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleReceipt} disabled={receiving}>{receiving ? 'Saving…' : 'Record Receipt'}</button></>}
      >
        <Field label="Customer" required>
          <select className="select" {...RF('customer_id')}>
            <option value="">— Select customer —</option>
            {(customerList || []).map(c => <option key={c.id} value={c.id}>{c.name} (Due: {fmt(c.outstanding_balance)})</option>)}
          </select>
        </Field>
        <div className="form-row form-row-2">
          <Field label="Amount" required><input className="input" type="number" min="0.01" step="0.01" placeholder="0.00" {...RF('amount')} /></Field>
          <Field label="Payment Mode">
            <select className="select" {...RF('payment_mode')}>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
            </select>
          </Field>
        </div>
        {recForm.payment_mode !== 'cash' && (
          <Field label="Bank Account">
            <select className="select" {...RF('bank_account_id')}>
              <option value="">— Select bank —</option>
              {(bankList || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Against Invoice (optional)">
          <select className="select" {...RF('reference_invoice_id')}>
            <option value="">— None —</option>
            {(invoiceList || []).filter(i => !recForm.customer_id || i.customer_id === recForm.customer_id).map(i => (
              <option key={i.id} value={i.id}>{i.invoice_number} — {fmt(Number(i.total_amount) - Number(i.amount_paid))} due</option>
            ))}
          </select>
        </Field>
        <Field label="Note"><input className="input" placeholder="Optional" {...RF('note')} /></Field>
      </Modal>

      {/* Make Payment Modal */}
      <Modal open={modal === 'payment'} onClose={() => setModal(null)} title="Make Payment to Supplier"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handlePayment} disabled={making}>{making ? 'Saving…' : 'Make Payment'}</button></>}
      >
        <Field label="Supplier" required>
          <select className="select" {...PF('supplier_id')}>
            <option value="">— Select supplier —</option>
            {(supplierList || []).map(s => <option key={s.id} value={s.id}>{s.name} (Due: {fmt(s.outstanding_dues)})</option>)}
          </select>
        </Field>
        <div className="form-row form-row-2">
          <Field label="Amount" required><input className="input" type="number" min="0.01" step="0.01" {...PF('amount')} /></Field>
          <Field label="Payment Mode">
            <select className="select" {...PF('payment_mode')}>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="upi">UPI</option>
            </select>
          </Field>
        </div>
        {payForm.payment_mode !== 'cash' && (
          <Field label="Bank Account">
            <select className="select" {...PF('bank_account_id')}>
              <option value="">— Select bank —</option>
              {(bankList || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Against Purchase (optional)">
          <select className="select" {...PF('reference_purchase_id')}>
            <option value="">— None —</option>
            {(purchaseList || []).filter(p => !payForm.supplier_id || p.supplier_id === payForm.supplier_id).map(p => (
              <option key={p.id} value={p.id}>{p.purchase_number} — {fmt(Number(p.total_amount) - Number(p.amount_paid))} due</option>
            ))}
          </select>
        </Field>
        <Field label="Note"><input className="input" {...PF('note')} /></Field>
      </Modal>

      {/* Expense Modal */}
      <Modal open={modal === 'expense'} onClose={() => setModal(null)} title="Record Expense"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleExpense} disabled={expensing}>{expensing ? 'Saving…' : 'Record Expense'}</button></>}
      >
        <div className="form-row form-row-2">
          <Field label="Expense Type" required>
            <select className="select" {...EF('expense_name')}>
              {EXPENSE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Amount" required><input className="input" type="number" min="0.01" step="0.01" {...EF('amount')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="Payment Mode">
            <select className="select" {...EF('payment_mode')}>
              <option value="bank">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </Field>
          {expForm.payment_mode !== 'cash' && (
            <Field label="Bank Account">
              <select className="select" {...EF('bank_account_id')}>
                <option value="">— Select bank —</option>
                {(bankList || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Field label="Note"><textarea className="textarea" style={{ minHeight: 56 }} {...EF('note')} /></Field>
      </Modal>
    </div>
  );
}
