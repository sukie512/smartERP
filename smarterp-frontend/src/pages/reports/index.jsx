import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { reports as api } from '../../api';
import { fmt, fmtNum, today, fyStart } from '../../utils';
import { Spinner, Empty, DateRange } from '../../components/ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';

const TABS = [
  { key: 'sales',       label: 'Sales' },
  { key: 'purchases',   label: 'Purchases' },
  { key: 'gst',         label: 'GST' },
  { key: 'stock',       label: 'Stock' },
  { key: 'pl',          label: 'P&L' },
  { key: 'balance',     label: 'Balance Sheet' },
  { key: 'trial',       label: 'Trial Balance' },
  { key: 'cashflow',    label: 'Cash Flow' },
];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

function SalesReport() {
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const { data: summary, loading: sL } = useApi(() => api.salesSummary(range), [JSON.stringify(range)]);
  const { data: daily,   loading: dL } = useApi(() => api.dailySales(range),   [JSON.stringify(range)]);
  const { data: top,     loading: tL } = useApi(() => api.topCustomers(range),  [JSON.stringify(range)]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <DateRange from={range.from} to={range.to} onChange={({ from, to }) => setRange({ from, to })} />
      </div>

      {sL ? <Spinner /> : summary && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total Invoices',  value: summary.total_invoices, mono: true, plain: true },
            { label: 'Total Revenue',   value: fmt(summary.total_revenue) },
            { label: 'Amount Collected', value: fmt(summary.total_collected) },
            { label: 'Outstanding',     value: fmt(summary.total_outstanding) },
          ].map(({ label, value, plain }) => (
            <div key={label} className="stat-card">
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ fontSize: 18 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Daily Sales</div>
          {dL ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={(daily || []).slice(0, 30).reverse()} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="formatted_date" tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => '₹' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--bg-3)' }} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}><span className="card-title">Top Customers</span></div>
          {tL ? <Spinner /> : (
            <table className="table">
              <thead><tr><th>Customer</th><th>Invoices</th><th>Total Billed</th><th>Outstanding</th></tr></thead>
              <tbody>
                {(top || []).map(c => (
                  <tr key={c.id}>
                    <td className="primary">{c.name}</td>
                    <td className="mono">{c.invoice_count}</td>
                    <td className="mono">{fmt(c.total_billed)}</td>
                    <td className="mono" style={{ color: Number(c.outstanding) > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{fmt(c.outstanding)}</td>
                  </tr>
                ))}
                {(!top || !top.length) && <tr><td colSpan={4}><Empty message="No sales data" /></td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function PurchaseReport() {
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const { data: summary, loading: sL } = useApi(() => api.purchaseSummary(range), [JSON.stringify(range)]);
  const { data: register, loading: rL } = useApi(() => api.purchaseRegister(range), [JSON.stringify(range)]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}><DateRange from={range.from} to={range.to} onChange={({ from, to }) => setRange({ from, to })} /></div>
      {sL ? <Spinner /> : summary && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total Purchases', value: summary.total_purchases },
            { label: 'Total Value',     value: fmt(summary.total_value) },
            { label: 'GST Input Credit', value: fmt(summary.total_gst_input) },
            { label: 'Outstanding Dues', value: fmt(summary.outstanding_dues) },
          ].map(({ label, value }) => (
            <div key={label} className="stat-card"><div className="stat-label">{label}</div><div className="stat-value" style={{ fontSize: 18 }}>{value}</div></div>
          ))}
        </div>
      )}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="card-title">Purchase Register</span></div>
        {rL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Purchase #</th><th>Supplier</th><th>Value</th><th>GST</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {(register || []).map(r => (
                  <tr key={r.purchase_number}>
                    <td className="mono" style={{ color: 'var(--accent)' }}>{r.purchase_number}</td>
                    <td className="primary">{r.supplier}</td>
                    <td className="mono">{fmt(r.subtotal)}</td>
                    <td className="mono">{fmt(r.total_tax)}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{fmt(r.total_amount)}</td>
                    <td><span className={`badge ${r.status === 'paid' ? 'badge-green' : r.status === 'partial' ? 'badge-warn' : 'badge-red'}`}>{r.status}</span></td>
                    <td>{r.date}</td>
                  </tr>
                ))}
                {(!register || !register.length) && <tr><td colSpan={7}><Empty message="No purchases" /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GSTReport() {
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const { data: summary, loading: sL } = useApi(() => api.gstSummary(range), [JSON.stringify(range)]);
  const { data: register, loading: rL } = useApi(() => api.gstRegister(range), [JSON.stringify(range)]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}><DateRange from={range.from} to={range.to} onChange={({ from, to }) => setRange({ from, to })} /></div>
      {sL ? <Spinner /> : summary && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Output GST (Collected on Sales)</div>
            {[['CGST', summary.output_gst?.cgst_collected], ['SGST', summary.output_gst?.sgst_collected], ['IGST', summary.output_gst?.igst_collected], ['Total', summary.output_gst?.total_output_gst]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{l}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: l === 'Total' ? 700 : 400 }}>{fmt(v)}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Input Credit (Paid on Purchases)</div>
            {[['CGST', summary.input_credit?.cgst_input], ['SGST', summary.input_credit?.sgst_input], ['IGST', summary.input_credit?.igst_input], ['Total', summary.input_credit?.total_input_gst]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{l}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: l === 'Total' ? 700 : 400, color: 'var(--accent-2)' }}>{fmt(v)}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Net GST Payable to Government</div>
            <div style={{ display: 'flex', gap: 32 }}>
              {[['CGST Payable', summary.net_payable?.cgst], ['SGST Payable', summary.net_payable?.sgst], ['IGST Payable', summary.net_payable?.igst], ['Total Payable', summary.net_payable?.total]].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 16, color: Number(v) > 0 ? 'var(--danger)' : 'var(--accent-2)' }}>{fmt(v)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="card-title">GST Register</span></div>
        {rL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Invoice #</th><th>Customer</th><th>GSTIN</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total GST</th><th>Date</th></tr></thead>
              <tbody>
                {(register || []).map(r => (
                  <tr key={r.invoice_number}>
                    <td className="mono">{r.invoice_number}</td>
                    <td className="primary">{r.customer}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{r.gstin || '—'}</td>
                    <td className="mono">{fmt(r.subtotal)}</td>
                    <td className="mono">{fmt(r.total_cgst)}</td>
                    <td className="mono">{fmt(r.total_sgst)}</td>
                    <td className="mono">{fmt(r.total_igst)}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{fmt(r.total_tax)}</td>
                    <td>{r.date}</td>
                  </tr>
                ))}
                {(!register || !register.length) && <tr><td colSpan={9}><Empty message="No GST records" /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StockReport() {
  const { data: summary, loading: sL } = useApi(() => api.stockSummary());
  const { data: low,     loading: lL } = useApi(() => api.lowStock());

  const totalStockValue = (summary || []).reduce((s, i) => s + Number(i.stock_value_at_cost), 0);

  return (
    <div>
      {low?.length > 0 && (
        <div style={{ background: 'var(--warn-dim)', border: '1px solid var(--warn)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--warn)', fontWeight: 600, marginBottom: 6 }}>⚠ {low.length} item(s) below low stock threshold</p>
          {low.map(i => (
            <span key={i.sku} style={{ fontSize: 12, color: 'var(--warn)', marginRight: 12 }}>{i.name}: {fmtNum(i.current_stock, 0)} {i.unit} (min {fmtNum(i.low_stock_threshold, 0)})</span>
          ))}
        </div>
      )}
      <div className="stat-card" style={{ marginBottom: 16, display: 'inline-block' }}>
        <div className="stat-label">Total Stock Value (at cost)</div>
        <div className="stat-value">{fmt(totalStockValue)}</div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="card-title">Stock Summary</span></div>
        {sL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Item</th><th>SKU</th><th>Group</th><th>Unit</th><th>Current Stock</th><th>Available</th><th>Damaged</th><th>Value (Cost)</th><th>Low Stock</th></tr></thead>
              <tbody>
                {(summary || []).map(i => (
                  <tr key={i.sku}>
                    <td className="primary">{i.name}</td>
                    <td className="mono">{i.sku}</td>
                    <td style={{ color: 'var(--text-3)' }}>{i.group_name || '—'}</td>
                    <td>{i.unit || '—'}</td>
                    <td className="mono">{fmtNum(i.current_stock, 0)}</td>
                    <td className="mono" style={{ color: 'var(--accent-2)' }}>{fmtNum(i.available_stock, 0)}</td>
                    <td className="mono" style={{ color: Number(i.damaged_stock) > 0 ? 'var(--danger)' : 'var(--text-3)' }}>{fmtNum(i.damaged_stock, 0)}</td>
                    <td className="mono">{fmt(i.stock_value_at_cost)}</td>
                    <td>{i.is_low_stock ? <span className="badge badge-warn">Low</span> : <span className="badge badge-green">OK</span>}</td>
                  </tr>
                ))}
                {(!summary || !summary.length) && <tr><td colSpan={9}><Empty message="No stock items" /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function PLReport() {
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const { data: pl, loading } = useApi(() => api.profitLoss(range), [JSON.stringify(range)]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}><DateRange from={range.from} to={range.to} onChange={({ from, to }) => setRange({ from, to })} /></div>
      {loading ? <Spinner /> : pl && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Income</div>
            {[['Revenue from Sales', pl.revenue], ['Gross Profit', pl.gross_profit]].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{l}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent-2)', fontWeight: 600 }}>{fmt(v)}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Expenses</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Cost of Goods Sold</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{fmt(pl.cogs)}</span>
            </div>
            {(pl.expenses || []).map(e => (
              <div key={e.expense_name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{e.expense_name}</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--danger)' }}>{fmt(e.total)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Total Expenses</span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--danger)', fontWeight: 700 }}>{fmt(pl.total_expenses)}</span>
            </div>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1', background: Number(pl.net_profit) >= 0 ? 'var(--accent-2-dim)' : 'var(--danger-dim)', borderColor: Number(pl.net_profit) >= 0 ? 'var(--accent-2)' : 'var(--danger)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Net {Number(pl.net_profit) >= 0 ? 'Profit' : 'Loss'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 24, color: Number(pl.net_profit) >= 0 ? 'var(--accent-2)' : 'var(--danger)' }}>{fmt(Math.abs(pl.net_profit))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceSheet() {
  const { data: bs, loading } = useApi(() => api.balanceSheet());

  if (loading) return <Spinner />;
  if (!bs) return <Empty />;

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16, color: 'var(--accent-2)' }}>Assets</div>
        {[
          ['Cash', bs.assets?.cash],
          ['Bank Accounts', bs.assets?.bank_total],
          ['Sundry Debtors', bs.assets?.sundry_debtors],
          ['Stock Value', bs.assets?.stock_value],
          ['GST Input Credit', bs.assets?.gst_input_credit],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{l}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{fmt(v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
          <span style={{ fontWeight: 700 }}>Total Assets</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent-2)', fontSize: 16 }}>{fmt(bs.assets?.total)}</span>
        </div>
      </div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16, color: 'var(--danger)' }}>Liabilities</div>
        {[
          ['Sundry Creditors', bs.liabilities?.sundry_creditors],
          ['GST Payable', bs.liabilities?.gst_payable],
        ].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{l}</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{fmt(v)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0' }}>
          <span style={{ fontWeight: 700 }}>Total Liabilities</span>
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--danger)', fontSize: 16 }}>{fmt(bs.liabilities?.total)}</span>
        </div>
        <div style={{ marginTop: 24, padding: '14px', background: 'var(--accent-dim)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Net Worth (Assets − Liabilities)</div>
          <div style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{fmt(bs.net_worth)}</div>
        </div>
      </div>
    </div>
  );
}

function TrialBalance() {
  const { data: tb, loading } = useApi(() => api.trialBalance());

  if (loading) return <Spinner />;
  if (!tb) return <Empty />;

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span className="card-title">Trial Balance</span>
        <span style={{ fontSize: 12, color: Math.abs(tb.total_debit - tb.total_credit) < 0.01 ? 'var(--accent-2)' : 'var(--danger)', fontWeight: 600 }}>
          {Math.abs(tb.total_debit - tb.total_credit) < 0.01 ? '✓ Balanced' : '✗ Not balanced'}
        </span>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Account</th><th>Group</th><th>Debit (Dr)</th><th>Credit (Cr)</th></tr></thead>
          <tbody>
            {(tb.rows || []).filter(r => r.debit > 0 || r.credit > 0).map((r, i) => (
              <tr key={i}>
                <td className="primary">{r.name}</td>
                <td style={{ color: 'var(--text-3)', fontSize: 11 }}>{r.group_type}</td>
                <td className="mono" style={{ color: 'var(--danger)' }}>{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                <td className="mono" style={{ color: 'var(--accent-2)' }}>{r.credit > 0 ? fmt(r.credit) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border-2)' }}>
              <td colSpan={2} style={{ padding: '12px 14px', fontWeight: 700 }}>Total</td>
              <td className="mono" style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--danger)' }}>{fmt(tb.total_debit)}</td>
              <td className="mono" style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent-2)' }}>{fmt(tb.total_credit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CashFlow() {
  const [range, setRange] = useState({ from: fyStart(), to: today() });
  const { data: cf, loading } = useApi(() => api.cashFlow(range), [JSON.stringify(range)]);

  return (
    <div>
      <div style={{ marginBottom: 16 }}><DateRange from={range.from} to={range.to} onChange={({ from, to }) => setRange({ from, to })} /></div>
      {loading ? <Spinner /> : cf && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Cash Flow Statement — Operating Activities</div>
          {[
            { label: 'Cash Received from Customers', value: cf.operating?.cash_received_from_customers, positive: true },
            { label: 'Cash Paid to Suppliers',        value: cf.operating?.cash_paid_to_suppliers,       positive: false },
            { label: 'Direct Expenses',               value: cf.operating?.direct_expenses,              positive: false },
          ].map(({ label, value, positive }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 13 }}>{label}</span>
              <span style={{ fontFamily: 'var(--mono)', color: positive ? 'var(--accent-2)' : 'var(--danger)' }}>
                {positive ? '+' : '-'}{fmt(value)}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0 0' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Net Cash Flow</span>
            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 18, color: Number(cf.net_cash_flow) >= 0 ? 'var(--accent-2)' : 'var(--danger)' }}>
              {Number(cf.net_cash_flow) >= 0 ? '+' : ''}{fmt(cf.net_cash_flow)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const PANELS = {
  sales:    SalesReport,
  purchases: PurchaseReport,
  gst:      GSTReport,
  stock:    StockReport,
  pl:       PLReport,
  balance:  BalanceSheet,
  trial:    TrialBalance,
  cashflow: CashFlow,
};

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const Panel = PANELS[tab];

  return (
    <div>
      <div className="page-header">
        <div><div className="page-title">Reports</div><div className="page-sub">Financial, inventory & GST reports</div></div>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map(t => <div key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</div>)}
      </div>

      <Panel />
    </div>
  );
}
