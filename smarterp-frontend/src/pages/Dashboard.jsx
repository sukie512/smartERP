import { useApi } from '../hooks/useApi';
import { reports, invoices as invoicesApi } from '../api';
import { fmt, statusClass } from '../utils';
import { Spinner, Badge } from '../components/ui';
import { TrendingUp, Users, Package, AlertTriangle, FileText, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

export default function Dashboard() {
  const { data: summary, loading: l1 }  = useApi(() => reports.dashboard());
  const { data: monthly, loading: l2 }  = useApi(() => reports.monthlySales());
  const { data: pending, loading: l3 }  = useApi(() => invoicesApi.list({ status: 'unpaid' }));

  if (l1) return <Spinner />;

  const s = summary || {};
  const chartData = (monthly || []).map(m => ({ name: m.month?.split(' ')[0], revenue: Number(m.revenue) }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Welcome back. Here's what's happening today.</div>
        </div>
        <Link to="/invoices/new" className="btn btn-primary">
          <FileText size={14} /> New Invoice
        </Link>
      </div>

      {/* stat cards */}
      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-label">Today's Sales</div>
          <div className="stat-value">{fmt(s.today_sales)}</div>
          <div className="stat-sub">Revenue collected today</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">Pending Invoices</div>
          <div className="stat-value">{s.pending_invoices ?? 0}</div>
          <div className="stat-sub">{fmt(s.pending_amount)} outstanding</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash Balance</div>
          <div className="stat-value">{fmt(s.cash_balance)}</div>
          <div className="stat-sub">Current cash on hand</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-label">Low Stock Alerts</div>
          <div className="stat-value">{s.low_stock_alerts ?? 0}</div>
          <div className="stat-sub">Items below threshold</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* monthly chart */}
        <div className="card">
          <div className="card-header"><span className="card-title">Monthly Revenue</span></div>
          {l2 ? <Spinner /> : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-3)' }} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state"><p>No sales data yet</p></div>}
        </div>

        {/* quick stats */}
        <div className="card">
          <div className="card-header"><span className="card-title">Overview</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Users,         label: 'Total Customers', value: s.total_customers ?? 0, link: '/customers' },
              { icon: Package,       label: 'Total Suppliers',  value: s.total_suppliers ?? 0, link: '/suppliers' },
              { icon: AlertTriangle, label: 'Low Stock Items',  value: s.low_stock_alerts ?? 0, link: '/stock' },
            ].map(({ icon: Icon, label, value, link }) => (
              <Link to={link} key={label} style={{ textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, background: 'var(--bg-3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={15} style={{ color: 'var(--accent)' }} />
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{label}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* recent pending invoices */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pending Invoices</span>
          <Link to="/invoices" className="btn btn-ghost btn-sm">View all</Link>
        </div>
        {l3 ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {(pending || []).slice(0, 8).map(inv => (
                  <tr key={inv.id}>
                    <td className="mono"><Link to={`/invoices/${inv.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{inv.invoice_number}</Link></td>
                    <td className="primary">{inv.customer_name}</td>
                    <td className="mono">{fmt(inv.total_amount)}</td>
                    <td className="mono">{fmt(inv.amount_paid)}</td>
                    <td><Badge label={inv.status} cls={statusClass(inv.status)} /></td>
                    <td>{inv.date}</td>
                  </tr>
                ))}
                {(!pending || pending.length === 0) && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '24px' }}>No pending invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
