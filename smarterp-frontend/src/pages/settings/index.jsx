import { useState, useEffect } from 'react';
import { useApi, useMutation } from '../../hooks/useApi';
import { settings as api } from '../../api';
import { Spinner, Field } from '../../components/ui';
import toast from 'react-hot-toast';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry'];

export default function Settings() {
  const { data, loading } = useApi(() => api.get());
  const [form, setForm]   = useState({ company_name: '', address: '', mobile: '', email: '', gstin: '', state: 'Maharashtra', logo_url: '' });

  useEffect(() => {
    if (data) setForm({
      company_name: data.company_name || '',
      address:      data.address || '',
      mobile:       data.mobile || '',
      email:        data.email || '',
      gstin:        data.gstin || '',
      state:        data.state || 'Maharashtra',
      logo_url:     data.logo_url || '',
    });
  }, [data]);

  const { submit, loading: saving } = useMutation(
    (d) => api.update(d),
    { onSuccess: () => toast.success('Settings saved'), onError: toast.error }
  );

  const F = (k) => ({ value: form[k], onChange: (e) => setForm(p => ({ ...p, [k]: e.target.value })) });

  if (loading) return <Spinner />;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div><div className="page-title">Company Settings</div><div className="page-sub">This info appears on invoices and reports</div></div>
        <button className="btn btn-primary" onClick={() => submit(form)} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</button>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 20 }}>Company Information</div>
        <div className="form-row form-row-2">
          <Field label="Company Name" required><input className="input" placeholder="Your company name" {...F('company_name')} /></Field>
          <Field label="GSTIN"><input className="input" placeholder="22AAAAA0000A1Z5" {...F('gstin')} /></Field>
        </div>
        <div className="form-row form-row-2">
          <Field label="Mobile"><input className="input" placeholder="Contact number" {...F('mobile')} /></Field>
          <Field label="Email"><input className="input" type="email" placeholder="company@example.com" {...F('email')} /></Field>
        </div>
        <Field label="State (for GST — determines CGST/SGST vs IGST)">
          <select className="select" {...F('state')}>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Address">
          <textarea className="textarea" placeholder="Full business address" rows={3} {...F('address')} />
        </Field>
        <Field label="Logo URL">
          <input className="input" placeholder="https://…/logo.png" {...F('logo_url')} />
        </Field>
        {form.logo_url && (
          <div style={{ marginTop: 12 }}>
            <div className="label">Preview</div>
            <img src={form.logo_url} alt="Logo" style={{ height: 60, marginTop: 6, borderRadius: 6, background: 'var(--bg-3)', padding: 4 }} onError={e => e.target.style.display = 'none'} />
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>System Info</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['Backend API', import.meta.env.VITE_API_URL || 'http://localhost:5000/api'],
            ['Version', '1.0.0'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)', width: 120 }}>{label}</span>
              <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-2)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
