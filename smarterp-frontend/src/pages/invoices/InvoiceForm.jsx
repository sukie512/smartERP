import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { customers, stock, invoices } from '../../api';
import { fmt, pf, uid } from '../../utils';
import { Field } from '../../components/ui';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPES = [
  { v: 'gst_invoice', l: 'GST Invoice' },
  { v: 'proforma',    l: 'Proforma Invoice' },
  { v: 'quotation',   l: 'Quotation' },
  { v: 'estimate',    l: 'Estimate' },
];

const EMPTY_LINE = () => ({ _id: uid(), stock_item_id: '', quantity: 1, unit_price: 0, gst_percentage: 0 });

export default function InvoiceForm() {
  const navigate = useNavigate();

  const { data: customerList } = useApi(() => customers.list());
  const { data: itemList }     = useApi(() => stock.items.list());

  const [header, setHeader] = useState({ customer_id: '', invoice_type: 'gst_invoice', is_igst: false, notes: '' });
  const [lines, setLines]   = useState([EMPTY_LINE()]);

  const H = (k) => ({ value: header[k], onChange: (e) => setHeader(p => ({ ...p, [k]: e.target.value })) });

  const setLine = (id, k, v) => setLines(ls => ls.map(l => l._id === id ? { ...l, [k]: v } : l));
  const addLine = () => setLines(ls => [...ls, EMPTY_LINE()]);
  const delLine = (id) => setLines(ls => ls.filter(l => l._id !== id));

  // when item selected — auto-fill price + gst
  const onItemChange = (id, itemId) => {
    const item = (itemList || []).find(i => i.id === itemId);
    setLines(ls => ls.map(l => l._id === id ? {
      ...l,
      stock_item_id: itemId,
      unit_price: item ? pf(item.selling_price) : 0,
      gst_percentage: item ? pf(item.gst_percentage) : 0,
    } : l));
  };

  // totals
  const calcLine = (l) => {
    const taxable = pf(l.quantity) * pf(l.unit_price);
    const gst     = (taxable * pf(l.gst_percentage)) / 100;
    return { taxable, gst, total: taxable + gst };
  };

  const subtotal   = lines.reduce((s, l) => s + calcLine(l).taxable, 0);
  const totalGst   = lines.reduce((s, l) => s + calcLine(l).gst, 0);
  const grandTotal = subtotal + totalGst;

  const { submit, loading } = useMutation(
    (d) => invoices.create(d),
    {
      onSuccess: (data) => {
        toast.success(`Invoice ${data.invoice_number} created`);
        navigate(`/invoices/${data.id}`);
      },
      onError: toast.error,
    }
  );

  const handleSubmit = () => {
    if (!header.customer_id) { toast.error('Select a customer'); return; }
    if (lines.some(l => !l.stock_item_id)) { toast.error('Select an item for all rows'); return; }
    if (lines.some(l => pf(l.quantity) <= 0)) { toast.error('Quantity must be > 0'); return; }

    submit({
      customer_id:  header.customer_id,
      invoice_type: header.invoice_type,
      is_igst:      header.is_igst === true || header.is_igst === 'true',
      notes:        header.notes || undefined,
      items: lines.map(l => ({
        stock_item_id: l.stock_item_id,
        quantity:      pf(l.quantity),
        unit_price:    pf(l.unit_price),
        gst_percentage: pf(l.gst_percentage),
      })),
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">New Invoice</div>
          <div className="page-sub">Fill in the details below</div>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => navigate('/invoices')}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create Invoice'}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Invoice Details</div>
          <div className="form-row form-row-2">
            <Field label="Customer" required>
              <select className="select" {...H('customer_id')}>
                <option value="">— Select customer —</option>
                {(customerList || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Invoice Type">
              <select className="select" {...H('invoice_type')}>
                {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-row form-row-2">
            <Field label="GST Type">
              <select className="select" value={header.is_igst} onChange={e => setHeader(p => ({ ...p, is_igst: e.target.value === 'true' }))}>
                <option value="false">Intra-state (CGST + SGST)</option>
                <option value="true">Inter-state (IGST)</option>
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <textarea className="textarea" style={{ minHeight: 56 }} placeholder="Optional notes on invoice" {...H('notes')} />
          </Field>
        </div>

        {/* summary */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Summary</div>
          {[
            { label: 'Subtotal', value: fmt(subtotal) },
            { label: `GST (${header.is_igst ? 'IGST' : 'CGST+SGST'})`, value: fmt(totalGst) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{value}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0', marginTop: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Grand Total</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* line items */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">Line Items</span>
          <button className="btn btn-secondary btn-sm" onClick={addLine}><Plus size={13} /> Add Row</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Item</th>
                <th style={{ width: '10%' }}>Qty</th>
                <th style={{ width: '14%' }}>Unit Price</th>
                <th style={{ width: '10%' }}>GST %</th>
                <th style={{ width: '12%' }}>Taxable</th>
                <th style={{ width: '12%' }}>Total</th>
                <th style={{ width: '7%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const c = calcLine(l);
                return (
                  <tr key={l._id}>
                    <td>
                      <select className="select" value={l.stock_item_id} onChange={e => onItemChange(l._id, e.target.value)}>
                        <option value="">— Select item —</option>
                        {(itemList || []).map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="input" type="number" min="0.001" step="0.001" value={l.quantity}
                        onChange={e => setLine(l._id, 'quantity', e.target.value)} />
                    </td>
                    <td>
                      <input className="input" type="number" min="0" step="0.01" value={l.unit_price}
                        onChange={e => setLine(l._id, 'unit_price', e.target.value)} />
                    </td>
                    <td>
                      <select className="select" value={l.gst_percentage} onChange={e => setLine(l._id, 'gst_percentage', e.target.value)}>
                        {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </td>
                    <td className="mono">{fmt(c.taxable)}</td>
                    <td className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmt(c.total)}</td>
                    <td>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }}
                        onClick={() => delLine(l._id)} disabled={lines.length === 1}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
