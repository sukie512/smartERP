import { useState } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { stock as api } from '../../api';
import { fmt, fmtNum } from '../../utils';
import { Modal, Confirm, Spinner, Empty, Field } from '../../components/ui';
import { Plus, Edit2, Trash2, AlertTriangle, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_ITEM = { name: '', sku: '', stock_group_id: '', unit_id: '', purchase_price: '', selling_price: '', gst_percentage: '0', low_stock_threshold: '10' };

export default function Stock() {
  const [tab, setTab]         = useState('items');
  const [modal, setModal]     = useState(null);
  const [sel, setSel]         = useState(null);
  const [form, setForm]       = useState(EMPTY_ITEM);
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [adjForm, setAdjForm] = useState({ stock_item_id: '', adjustment_type: 'adjustment_add', quantity: '', note: '' });
  const [movSel, setMovSel]   = useState(null);
  const [errors, setErrors]   = useState({});

  const { data: items,  loading: iL, refetch: iR } = useApi(() => api.items.list());
  const { data: groups, loading: gL, refetch: gR } = useApi(() => api.groups.list());
  const { data: units,  loading: uL }              = useApi(() => api.units.list());
  const { data: movs,   loading: mL }              = useApi(
    () => movSel ? api.items.movements(movSel) : Promise.resolve({ data: [] }),
    [movSel]
  );

  const F  = (k) => ({ value: form[k],      onChange: (e) => setForm(p => ({ ...p, [k]: e.target.value })) });
  const GF = (k) => ({ value: groupForm[k], onChange: (e) => setGroupForm(p => ({ ...p, [k]: e.target.value })) });
  const AF = (k) => ({ value: adjForm[k],   onChange: (e) => setAdjForm(p => ({ ...p, [k]: e.target.value })) });

  const validateItem = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.sku.trim())  e.sku  = 'Required';
    if (!form.selling_price) e.selling_price = 'Required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const { submit: saveItem, loading: savingItem } = useMutation(
    (d) => modal === 'addItem' ? api.items.create(d) : api.items.update(sel.id, d),
    { onSuccess: () => { toast.success('Saved'); setModal(null); iR(); }, onError: toast.error }
  );

  const { submit: delItem, loading: deletingItem } = useMutation(
    () => api.items.remove(sel.id),
    { onSuccess: () => { toast.success('Deleted'); setModal(null); iR(); }, onError: toast.error }
  );

  const { submit: saveGroup, loading: savingGroup } = useMutation(
    (d) => modal === 'addGroup' ? api.groups.create(d) : api.groups.update(sel.id, d),
    { onSuccess: () => { toast.success('Saved'); setModal(null); gR(); }, onError: toast.error }
  );

  const { submit: delGroup, loading: deletingGroup } = useMutation(
    () => api.groups.remove(sel.id),
    { onSuccess: () => { toast.success('Group deleted'); setModal(null); gR(); }, onError: toast.error }
  );

  const { submit: adjust, loading: adjusting } = useMutation(
    (d) => api.adjust(d),
    { onSuccess: () => { toast.success('Stock adjusted'); setModal(null); iR(); }, onError: toast.error }
  );

  const lowStockItems = (items || []).filter(i => i.is_low_stock);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Stock & Items</div>
          <div className="page-sub">{items?.length ?? 0} items · {lowStockItems.length} low stock</div>
        </div>
        <div className="action-row">
          <button className="btn btn-secondary" onClick={() => { setAdjForm({ stock_item_id: '', adjustment_type: 'adjustment_add', quantity: '', note: '' }); setModal('adjust'); }}>
            Stock Adjustment
          </button>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_ITEM); setErrors({}); setSel(null); setModal('addItem'); }}>
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div style={{ background: 'var(--warn-dim)', border: '1px solid var(--warn)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--warn)' }}>
            {lowStockItems.length} item(s) below low stock threshold: {lowStockItems.map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      <div className="tabs">
        {['items', 'groups'].map(t => <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t === 'items' ? 'Stock Items' : 'Stock Groups'}</div>)}
      </div>

      {tab === 'items' && (
        <div className="card" style={{ padding: 0 }}>
          {iL ? <Spinner /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>SKU</th><th>Group</th><th>Unit</th><th>Purchase Price</th><th>Selling Price</th><th>GST%</th><th>Stock</th><th>Available</th><th>Actions</th></tr></thead>
                <tbody>
                  {(items || []).map(item => (
                    <tr key={item.id}>
                      <td className="primary">{item.name}</td>
                      <td className="mono">{item.sku}</td>
                      <td style={{ color: 'var(--text-3)' }}>{item.group_name || '—'}</td>
                      <td>{item.unit_name || '—'}</td>
                      <td className="mono">{fmt(item.purchase_price)}</td>
                      <td className="mono">{fmt(item.selling_price)}</td>
                      <td className="mono">{item.gst_percentage}%</td>
                      <td className="mono">{fmtNum(item.current_stock, 0)}</td>
                      <td className="mono" style={{ color: item.is_low_stock ? 'var(--warn)' : 'var(--accent-2)' }}>
                        {fmtNum(item.available_stock, 0)}
                        {item.is_low_stock && <AlertTriangle size={11} style={{ marginLeft: 4, color: 'var(--warn)' }} />}
                      </td>
                      <td>
                        <div className="action-row">
                          <button className="btn btn-ghost btn-icon btn-sm" title="Movements" onClick={() => { setMovSel(item.id); setModal('movements'); }}><Activity size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => {
                            setSel(item);
                            setForm({ name: item.name, sku: item.sku, stock_group_id: item.stock_group_id || '', unit_id: item.unit_id || '', purchase_price: item.purchase_price, selling_price: item.selling_price, gst_percentage: item.gst_percentage, low_stock_threshold: item.low_stock_threshold });
                            setErrors({}); setModal('editItem');
                          }}><Edit2 size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setSel(item); setModal('delItem'); }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!items || !items.length) && <tr><td colSpan={10}><Empty message="No stock items yet. Add your first item." /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'groups' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setGroupForm({ name: '' }); setSel(null); setModal('addGroup'); }}><Plus size={13} /> Add Group</button>
          </div>
          {gL ? <Spinner /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Group Name</th><th>Actions</th></tr></thead>
                <tbody>
                  {(groups || []).map(g => (
                    <tr key={g.id}>
                      <td className="primary">{g.name}</td>
                      <td>
                        <div className="action-row">
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSel(g); setGroupForm({ name: g.name }); setModal('editGroup'); }}><Edit2 size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => { setSel(g); setModal('delGroup'); }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!groups || !groups.length) && <tr><td colSpan={2}><Empty message="No groups yet" /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Item Modal */}
      <Modal
        open={modal === 'addItem' || modal === 'editItem'}
        onClose={() => setModal(null)}
        title={modal === 'addItem' ? 'Add Stock Item' : 'Edit Stock Item'}
        size="modal-lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={savingItem} onClick={() => { if (validateItem()) saveItem(form); }}>
            {savingItem ? 'Saving…' : 'Save Item'}
          </button>
        </>}
      >
        <div className="form-row form-row-2">
          <Field label="Item Name" required error={errors.name}><input className={`input${errors.name ? ' input-error' : ''}`} placeholder="Product name" {...F('name')} /></Field>
          <Field label="SKU" required error={errors.sku}><input className={`input${errors.sku ? ' input-error' : ''}`} placeholder="Unique SKU code" {...F('sku')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="Stock Group">
            <select className="select" {...F('stock_group_id')}>
              <option value="">— Select group —</option>
              {(groups || []).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Unit">
            <select className="select" {...F('unit_id')}>
              <option value="">— Select unit —</option>
              {(units || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="form-row form-row-3">
          <Field label="Purchase Price" required><input className="input" type="number" min="0" step="0.01" placeholder="0.00" {...F('purchase_price')} /></Field>
          <Field label="Selling Price" required error={errors.selling_price}><input className={`input${errors.selling_price ? ' input-error' : ''}`} type="number" min="0" step="0.01" placeholder="0.00" {...F('selling_price')} /></Field>
          <Field label="GST %">
            <select className="select" {...F('gst_percentage')}>
              {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
            </select>
          </Field>
        </div>
        <Field label="Low Stock Threshold">
          <input className="input" type="number" min="0" style={{ maxWidth: 160 }} {...F('low_stock_threshold')} />
        </Field>
      </Modal>

      {/* Group Modals */}
      <Modal
        open={modal === 'addGroup' || modal === 'editGroup'}
        onClose={() => setModal(null)}
        title={modal === 'addGroup' ? 'Add Stock Group' : 'Edit Stock Group'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={savingGroup} onClick={() => saveGroup(groupForm)}>
            {savingGroup ? 'Saving…' : 'Save'}
          </button>
        </>}
      >
        <Field label="Group Name" required>
          <input className="input" placeholder="e.g. Electronics" {...GF('name')} />
        </Field>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={modal === 'adjust'}
        onClose={() => setModal(null)}
        title="Stock Adjustment"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" disabled={adjusting} onClick={() => {
            if (!adjForm.stock_item_id || !adjForm.quantity) { toast.error('Select item and quantity'); return; }
            adjust({ ...adjForm, quantity: parseFloat(adjForm.quantity) });
          }}>
            {adjusting ? 'Adjusting…' : 'Apply Adjustment'}
          </button>
        </>}
      >
        <Field label="Stock Item" required>
          <select className="select" {...AF('stock_item_id')}>
            <option value="">— Select item —</option>
            {(items || []).map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {fmtNum(i.current_stock, 0)})</option>)}
          </select>
        </Field>
        <Field label="Adjustment Type">
          <select className="select" {...AF('adjustment_type')}>
            <option value="adjustment_add">Add Stock</option>
            <option value="adjustment_remove">Remove Stock</option>
            <option value="damaged">Mark as Damaged</option>
          </select>
        </Field>
        <Field label="Quantity" required>
          <input className="input" type="number" min="0.001" step="0.001" placeholder="0" {...AF('quantity')} />
        </Field>
        <Field label="Note / Reason">
          <textarea className="textarea" style={{ minHeight: 60 }} placeholder="Optional reason" {...AF('note')} />
        </Field>
      </Modal>

      {/* Movements Modal */}
      <Modal open={modal === 'movements'} onClose={() => { setModal(null); setMovSel(null); }} title="Stock Movement History" size="modal-lg">
        {mL ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Reference</th><th>Note</th></tr></thead>
              <tbody>
                {(movs || []).map(m => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{m.date}</td>
                    <td><span className={`badge ${m.movement_type.includes('in') || m.movement_type.includes('add') ? 'badge-green' : 'badge-red'}`}>{m.movement_type.replace(/_/g, ' ')}</span></td>
                    <td className="mono">{fmtNum(m.quantity, 3)}</td>
                    <td className="mono" style={{ fontSize: 11 }}>{m.reference_type || '—'}</td>
                    <td style={{ color: 'var(--text-3)' }}>{m.note || '—'}</td>
                  </tr>
                ))}
                {(!movs || !movs.length) && <tr><td colSpan={5}><Empty message="No movements recorded" /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Confirm open={modal === 'delItem'} onClose={() => setModal(null)} onConfirm={delItem} loading={deletingItem} title="Delete Item" message={`Delete "${sel?.name}"?`} />
      <Confirm open={modal === 'delGroup'} onClose={() => setModal(null)} onConfirm={delGroup} loading={deletingGroup} title="Delete Group" message={`Delete group "${sel?.name}"?`} />
    </div>
  );
}
