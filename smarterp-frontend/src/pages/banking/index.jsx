import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { banks as api, payments } from '../../api';
import { fmt, statusClass, today } from '../../utils';
import { Spinner, Empty, Badge, Modal, Field } from '../../components/ui';
import { Plus, ArrowRightLeft, RefreshCw, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Banking() {
  const [tab, setTab]     = useState('accounts');
  const [modal, setModal] = useState(null);
  const [sel, setSel]     = useState(null);

  const [bankForm, setBankForm]   = useState({ name: '', account_number: '', bank_name: '', ifsc: '', opening_balance: '' });
  const [tranForm, setTranForm]   = useState({ from_type: 'bank', from_id: '', to_type: 'bank', to_id: '', amount: '', note: '' });
  const [reconForm, setReconForm] = useState({ bank_account_id: '', statement_date: today(), statement_balance: '', notes: '' });

  const { data: accounts, loading: aL, refetch: aR } = useApi(() => api.list());
  const { data: cheques,  loading: cL }              = useApi(() => api.pendingCheques());
  const { data: txns,     loading: tL }              = useApi(
    () => sel?.id && modal === 'txns' ? api.transactions(sel.id) : Promise.resolve({ data: [] }),
    [sel?.id, modal]
  );
  const { data: reconHist, loading: rhL } = useApi(
    () => sel?.id && modal === 'reconHist' ? api.reconcileHistory(sel.id) : Promise.resolve({ data: [] }),
    [sel?.id, modal]
  );

  const BF = (k) => ({ value: bankForm[k],  onChange: e => setBankForm(p => ({ ...p, [k]: e.target.value })) });
  const TF = (k) => ({ value: tranForm[k],  onChange: e => setTranForm(p => ({ ...p, [k]: e.target.value })) });
  const RF = (k) => ({ value: reconForm[k], onChange: e => setReconForm(p => ({ ...p, [k]: e.target.value })) });

  const { submit: addBank,   loading: addingBank }  = useMutation(d => api.create(d), { onSuccess: () => { toast.success('Bank account added'); setModal(null); aR(); }, onError: toast.error });
  const { submit: transfer,  loading: transferring } = useMutation(d => api.transfer(d), { onSuccess: () => { toast.success('Funds transferred'); setModal(null); aR(); }, onError: toast.error });
  const { submit: reconcile, loading: reconciling } = useMutation(d => api.reconcile(d), { onSuccess: () => { toast.success('Reconciliation saved'); setModal(null); }, onError: toast.error });

  const { submit: updateCheque, loading: updatingCheque } = useMutation(
    d => payments.chequeStatus(d),
    { onSuccess: () => { toast.success('Cheque status updated'); setModal(null); }, onError: toast.error }
  );

  const handleAddBank = () => {
    if (!bankForm.name.trim()) { toast.error('Bank name required'); return; }
    addBank({ ...bankForm, opening_balance: parseFloat(bankForm.opening_balance) || 0 });
  };

  const handleTransfer = () => {
    if (!tranForm.amount || parseFloat(tranForm.amount) <= 0) { toast.error('Enter valid amount'); return; }
    if (tranForm.from_type !== 'cash' && !tranForm.from_id) { toast.error('Select source account'); return; }
    if (tranForm.to_type !== 'cash' && !tranForm.to_id) { toast.error('Select destination account'); return; }
    transfer({ ...tranForm, amount: parseFloat(tranForm.amount), from_id: tranForm.from_id || undefined, to_id: tranForm.to_id || undefined });
  };

  const handleReconcile = () => {
    if (!reconForm.bank_account_id || !reconForm.statement_balance) { toast.error('Fill all fields'); return; }
    reconcile({ ...reconForm, statement_balance: parseFloat(reconForm.statement_balance) });
  };

  const totalBankBalance = (accounts || []).reduce((s, a) => s + Number(a.current_balance), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Banking</div>
          <div className="page-sub">Total balance across all accounts: {fmt(totalBankBalance)}</div>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => { setReconForm({ bank_account_id: '', statement_date: today(), statement_balance: '', notes: '' }); setModal('reconcile'); }}>
            <RefreshCw size={14} /> Reconcile
          </button>
          <button className="btn btn-secondary" onClick={() => { setTranForm({ from_type: 'bank', from_id: '', to_type: 'bank', to_id: '', amount: '', note: '' }); setModal('transfer'); }}>
            <ArrowRightLeft size={14} /> Transfer Funds
          </button>
          <button className="btn btn-primary" onClick={() => { setBankForm({ name: '', account_number: '', bank_name: '', ifsc: '', opening_balance: '' }); setModal('addBank'); }}>
            <Plus size={14} /> Add Bank
          </button>
        </div>
      </div>

      <div className="tabs">
        {['accounts', 'cheques'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'accounts' ? 'Bank Accounts' : `Pending Cheques${(cheques?.issued?.length || 0) + (cheques?.received?.length || 0) > 0 ? ` (${(cheques?.issued?.length || 0) + (cheques?.received?.length || 0)})` : ''}`}
          </div>
        ))}
      </div>

      {tab === 'accounts' && (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {(accounts || []).map(a => (
              <div key={a.id} className="stat-card">
                <div className="stat-label">{a.name}</div>
                <div className="stat-value" style={{ fontSize: 18 }}>{fmt(a.current_balance)}</div>
                <div className="stat-sub">{a.bank_name || 'Bank Account'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSel(a); setModal('txns'); }}>Transactions</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setSel(a); setModal('reconHist'); }}>History</button>
                </div>
              </div>
            ))}
            {aL && <Spinner />}
            {!aL && (!accounts || !accounts.length) && <div className="card"><Empty message="No bank accounts added yet." /></div>}
          </div>
        </>
      )}

      {tab === 'cheques' && (
        <div className="grid-2">
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="card-title">Cheques Issued (to suppliers)</span></div>
            {cL ? <Spinner /> : (
              <table className="table">
                <thead><tr><th>Party</th><th>Amount</th><th>Cheque #</th><th>Date</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(cheques?.issued || []).map(c => (
                    <tr key={c.id}>
                      <td className="primary">{c.party_name}</td>
                      <td className="mono">{fmt(c.amount)}</td>
                      <td className="mono">{c.cheque_number || '—'}</td>
                      <td>{c.cheque_date || '—'}</td>
                      <td><Badge label={c.cheque_status} cls={statusClass(c.cheque_status)} /></td>
                      <td>
                        <div className="action-row">
                          <button className="btn btn-ghost btn-sm" onClick={() => updateCheque({ type: 'payment', id: c.id, status: 'cleared' })}>Cleared</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => updateCheque({ type: 'payment', id: c.id, status: 'bounced' })}>Bounced</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!cheques?.issued?.length && <tr><td colSpan={6}><Empty message="No pending cheques issued" /></td></tr>}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}><span className="card-title">Cheques Received (from customers)</span></div>
            {cL ? <Spinner /> : (
              <table className="table">
                <thead><tr><th>Party</th><th>Amount</th><th>Cheque #</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(cheques?.received || []).map(c => (
                    <tr key={c.id}>
                      <td className="primary">{c.party_name}</td>
                      <td className="mono">{fmt(c.amount)}</td>
                      <td className="mono">{c.cheque_number || '—'}</td>
                      <td><Badge label={c.cheque_status} cls={statusClass(c.cheque_status)} /></td>
                      <td>
                        <div className="action-row">
                          <button className="btn btn-ghost btn-sm" onClick={() => updateCheque({ type: 'receipt', id: c.id, status: 'cleared' })}>Cleared</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => updateCheque({ type: 'receipt', id: c.id, status: 'bounced' })}>Bounced</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!cheques?.received?.length && <tr><td colSpan={5}><Empty message="No pending cheques received" /></td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Add Bank Modal */}
      <Modal open={modal === 'addBank'} onClose={() => setModal(null)} title="Add Bank Account"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleAddBank} disabled={addingBank}>{addingBank ? 'Saving…' : 'Add Account'}</button></>}
      >
        <div className="form-row form-row-2">
          <Field label="Account Label" required><input className="input" placeholder="e.g. HDFC Current" {...BF('name')} /></Field>
          <Field label="Bank Name"><input className="input" placeholder="e.g. HDFC Bank" {...BF('bank_name')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="Account Number"><input className="input" {...BF('account_number')} /></Field>
          <Field label="IFSC Code"><input className="input" {...BF('ifsc')} /></Field>
        </div>
        <Field label="Opening Balance"><input className="input" type="number" min="0" step="0.01" placeholder="0.00" {...BF('opening_balance')} /></Field>
      </Modal>

      {/* Transfer Funds Modal */}
      <Modal open={modal === 'transfer'} onClose={() => setModal(null)} title="Transfer Funds"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleTransfer} disabled={transferring}>{transferring ? 'Transferring…' : 'Transfer'}</button></>}
      >
        <div className="form-row form-row-2">
          <Field label="From">
            <select className="select" {...TF('from_type')}><option value="bank">Bank Account</option><option value="cash">Cash</option></select>
          </Field>
          <Field label="To">
            <select className="select" {...TF('to_type')}><option value="bank">Bank Account</option><option value="cash">Cash</option></select>
          </Field>
        </div>
        {tranForm.from_type === 'bank' && (
          <Field label="Source Account">
            <select className="select" {...TF('from_id')}>
              <option value="">— Select —</option>
              {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.current_balance)})</option>)}
            </select>
          </Field>
        )}
        {tranForm.to_type === 'bank' && (
          <Field label="Destination Account">
            <select className="select" {...TF('to_id')}>
              <option value="">— Select —</option>
              {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        <div className="form-row form-row-2">
          <Field label="Amount" required><input className="input" type="number" min="0.01" step="0.01" {...TF('amount')} /></Field>
          <Field label="Note"><input className="input" {...TF('note')} /></Field>
        </div>
      </Modal>

      {/* Reconcile Modal */}
      <Modal open={modal === 'reconcile'} onClose={() => setModal(null)} title="Bank Reconciliation"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleReconcile} disabled={reconciling}>{reconciling ? 'Saving…' : 'Save Reconciliation'}</button></>}
      >
        <Field label="Bank Account" required>
          <select className="select" {...RF('bank_account_id')}>
            <option value="">— Select account —</option>
            {(accounts || []).map(a => <option key={a.id} value={a.id}>{a.name} (Book: {fmt(a.current_balance)})</option>)}
          </select>
        </Field>
        <div className="form-row form-row-2">
          <Field label="Statement Date"><input className="input" type="date" {...RF('statement_date')} /></Field>
          <Field label="Statement Balance" required><input className="input" type="number" step="0.01" {...RF('statement_balance')} /></Field>
        </div>
        <Field label="Notes"><textarea className="textarea" style={{ minHeight: 60 }} {...RF('notes')} /></Field>
      </Modal>

      {/* Transactions Modal */}
      <Modal open={modal === 'txns'} onClose={() => { setModal(null); setSel(null); }} title={`Transactions — ${sel?.name}`} size="modal-lg">
        {tL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Ref Type</th></tr></thead>
              <tbody>
                {(txns || []).map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td>{t.description}</td>
                    <td className="mono" style={{ color: 'var(--accent-2)' }}>{t.entry_type === 'debit' ? fmt(t.amount) : '—'}</td>
                    <td className="mono" style={{ color: 'var(--danger)' }}>{t.entry_type === 'credit' ? fmt(t.amount) : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.reference_type || '—'}</td>
                  </tr>
                ))}
                {(!txns || !txns.length) && <tr><td colSpan={5}><Empty message="No transactions yet" /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Reconciliation History Modal */}
      <Modal open={modal === 'reconHist'} onClose={() => { setModal(null); setSel(null); }} title={`Reconciliation History — ${sel?.name}`} size="modal-lg">
        {rhL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Statement Balance</th><th>Book Balance</th><th>Difference</th><th>Notes</th></tr></thead>
              <tbody>
                {(reconHist || []).map(r => (
                  <tr key={r.id}>
                    <td>{r.formatted_date}</td>
                    <td className="mono">{fmt(r.statement_balance)}</td>
                    <td className="mono">{fmt(r.book_balance)}</td>
                    <td className="mono" style={{ color: Number(r.difference) === 0 ? 'var(--accent-2)' : 'var(--danger)' }}>{fmt(r.difference)}</td>
                    <td style={{ color: 'var(--text-3)' }}>{r.notes || '—'}</td>
                  </tr>
                ))}
                {(!reconHist || !reconHist.length) && <tr><td colSpan={5}><Empty message="No reconciliation records" /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
