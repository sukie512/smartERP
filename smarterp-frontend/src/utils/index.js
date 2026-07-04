// format rupees
export const fmt = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// format number without currency
export const fmtNum = (n, dec = 2) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// status badge class
export const statusClass = (s) => ({
  paid:      'badge-green',
  unpaid:    'badge-red',
  partial:   'badge-warn',
  cancelled: 'badge-gray',
  pending:   'badge-warn',
  cleared:   'badge-green',
  bounced:   'badge-red',
}[s] || 'badge-gray');

// today's date as YYYY-MM-DD
export const today = () => new Date().toISOString().split('T')[0];

// start of current financial year (April 1)
export const fyStart = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-04-01`;
};

// debounce
export const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// safe parse float
export const pf = (v) => parseFloat(v) || 0;

// generate unique id (for line items before save)
export const uid = () => Math.random().toString(36).slice(2, 9);
