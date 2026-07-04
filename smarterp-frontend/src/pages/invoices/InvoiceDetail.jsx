import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { invoices as api, banks, customers, payments } from '../../api';
import { fmt, statusClass } from '../../utils';
import { Spinner, Badge, Modal, Field } from '../../components/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: inv, loading, refetch } = useApi(() => api.get(id));
  const { data: bankList } = useApi(() => banks.list());
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm]   = useState({ amount: '', payment_mode: 'bank', bank_account_id: '', note: '' });

  const { submit: receivePayment, loading: paying } = useMutation(
    (d) => payments.receive(d),
    { onSuccess: () => { toast.success('Payment recorded'); setPayModal(false); refetch(); }, onError: toast.error }
  );

  const handlePay = () => {
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    receivePayment({
      customer_id:          inv.customer_id,
      amount:               parseFloat(payForm.amount),
      payment_mode:         payForm.payment_mode,
      bank_account_id:      payForm.bank_account_id || undefined,
      reference_invoice_id: inv.id,
      note:                 payForm.note || undefined,
    });
  };

  const handlePrint = () => window.print();

  if (loading) return <Spinner />;
  if (!inv) return <div style={{ padding: 24 }}>Invoice not found.</div>;

  const balance = Number(inv.total_amount) - Number(inv.amount_paid);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/invoices')}><ArrowLeft size={16} /></button>
          <div>
            <div className="page-title">{inv.invoice_number}</div>
            <div className="page-sub">{inv.invoice_type?.replace(/_/g, ' ')} · {inv.date}</div>
          </div>
        </div>
        <div className="action-row">
          {inv.status !== 'cancelled' && inv.status !== 'paid' && (
            <button className="btn btn-primary" onClick={() => { setPayForm({ amount: String(balance), payment_mode: 'bank', bank_account_id: '', note: '' }); setPayModal(true); }}>
              Record Payment
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePrint}><Printer size={14} /> Print</button>
        </div>
      </div>

      {/* status bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 140 }}>
          <div className="stat-label">Status</div>
          <div style={{ marginTop: 6 }}><Badge label={inv.status} cls={statusClass(inv.status)} /></div>
        </div>
        <div className="stat-card accent" style={{ flex: 1, minWidth: 140 }}>
          <div className="stat-label">Total Amount</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(inv.total_amount)}</div>
        </div>
        <div className="stat-card green" style={{ flex: 1, minWidth: 140 }}>
          <div className="stat-label">Amount Paid</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--accent-2)' }}>{fmt(inv.amount_paid)}</div>
        </div>
        <div className="stat-card danger" style={{ flex: 1, minWidth: 140 }}>
          <div className="stat-label">Balance Due</div>
          <div className="stat-value" style={{ fontSize: 18, color: 'var(--danger)' }}>{fmt(balance)}</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* customer info */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Customer</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{inv.customer?.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{inv.customer?.mobile}</div>
          {inv.customer?.email && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{inv.customer?.email}</div>}
          {inv.customer?.address && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{inv.customer?.address}</div>}
          {inv.customer?.gstin && <div style={{ fontSize: 11, fontFamily: 'var(--mono)', marginTop: 6, color: 'var(--text-3)' }}>GSTIN: {inv.customer?.gstin}</div>}
        </div>

        {/* tax summary */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Tax Breakdown</div>
          {[
            { l: 'Subtotal',  v: inv.subtotal },
            { l: 'CGST',      v: inv.total_cgst },
            { l: 'SGST',      v: inv.total_sgst },
            { l: 'IGST',      v: inv.total_igst },
            { l: 'Total Tax', v: inv.total_tax },
          ].map(({ l, v }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{l}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{fmt(v)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
            <span style={{ fontWeight: 700 }}>Grand Total</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', fontSize: 15 }}>{fmt(inv.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* line items */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <span className="card-title">Items</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>GST%</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
            <tbody>
              {(inv.items || []).map(item => (
                <tr key={item.id}>
                  <td className="primary">{item.item_name}</td>
                  <td className="mono">{item.quantity}</td>
                  <td style={{ color: 'var(--text-3)' }}>{item.unit || '—'}</td>
                  <td className="mono">{fmt(item.unit_price)}</td>
                  <td className="mono">{item.gst_percentage}%</td>
                  <td className="mono">{fmt(item.taxable_amount)}</td>
                  <td className="mono">{fmt(item.cgst)}</td>
                  <td className="mono">{fmt(item.sgst)}</td>
                  <td className="mono">{fmt(item.igst)}</td>
                  <td className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {inv.notes && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Notes</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{inv.notes}</p>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        open={payModal}
        onClose={() => setPayModal(false)}
        title="Record Payment"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setPayModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handlePay} disabled={paying}>{paying ? 'Saving…' : 'Record Payment'}</button>
        </>}
      >
        <Field label="Amount" required>
          <input className="input" type="number" min="0.01" step="0.01" value={payForm.amount}
            onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} />
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
        <Field label="Note">
          <input className="input" placeholder="Optional" value={payForm.note} onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))} />
        </Field>
      </Modal>
    </div>
  );
}
