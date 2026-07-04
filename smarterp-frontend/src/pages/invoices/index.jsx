import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useMutation } from '../../hooks/useApi';
import { invoices as api } from '../../api';
import { fmt, statusClass, today, fyStart } from '../../utils';
import { Spinner, Empty, Badge, DateRange, Confirm } from '../../components/ui';
import { Plus, Eye, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Invoices() {
  const [filters, setFilters] = useState({ status: '', invoice_type: '', from_date: fyStart(), to_date: today() });
  const [delId, setDelId]     = useState(null);

  const { data: list, loading, refetch } = useApi(() => api.list(filters), [JSON.stringify(filters)]);

  const { submit: cancel, loading: cancelling } = useMutation(
    () => api.cancel(delId),
    { onSuccess: () => { toast.success('Invoice cancelled'); setDelId(null); refetch(); }, onError: toast.error }
  );

  const totalRevenue = (list || []).filter(i => i.status !== 'cancelled').reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Invoices</div>
          <div className="page-sub">{list?.length ?? 0} invoices · {fmt(totalRevenue)} total</div>
        </div>
        <Link to="/invoices/new" className="btn btn-primary"><Plus size={14} /> New Invoice</Link>
      </div>

      {/* filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <DateRange
          from={filters.from_date} to={filters.to_date}
          onChange={({ from, to }) => setFilters(p => ({ ...p, from_date: from, to_date: to }))}
        />
        <select className="select" style={{ width: 150 }} value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          {['unpaid', 'partial', 'paid', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select" style={{ width: 160 }} value={filters.invoice_type} onChange={e => setFilters(p => ({ ...p, invoice_type: e.target.value }))}>
          <option value="">All Types</option>
          {['gst_invoice', 'proforma', 'quotation', 'estimate'].map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Invoice #</th><th>Type</th><th>Customer</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {(list || []).map(inv => (
                  <tr key={inv.id}>
                    <td className="mono"><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{inv.invoice_number}</Link></td>
                    <td><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{inv.invoice_type?.replace(/_/g, ' ')}</span></td>
                    <td className="primary">{inv.customer_name}</td>
                    <td className="mono">{fmt(inv.total_amount)}</td>
                    <td className="mono" style={{ color: 'var(--accent-2)' }}>{fmt(inv.amount_paid)}</td>
                    <td className="mono" style={{ color: 'var(--danger)' }}>{fmt(Number(inv.total_amount) - Number(inv.amount_paid))}</td>
                    <td><Badge label={inv.status} cls={statusClass(inv.status)} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{inv.date}</td>
                    <td>
                      <div className="action-row">
                        <Link to={`/invoices/${inv.id}`} className="btn btn-ghost btn-icon btn-sm"><Eye size={13} /></Link>
                        {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} title="Cancel" onClick={() => setDelId(inv.id)}><XCircle size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!list || !list.length) && <tr><td colSpan={9}><Empty message="No invoices found for selected filters." /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Confirm open={!!delId} onClose={() => setDelId(null)} onConfirm={cancel} loading={cancelling}
        title="Cancel Invoice" message="This will reverse all stock and ledger entries. Are you sure?" />
    </div>
  );
}
