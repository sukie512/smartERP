import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const TITLES = {
  '/':          'Dashboard',
  '/customers': 'Customers',
  '/suppliers': 'Suppliers',
  '/stock':     'Stock & Items',
  '/invoices':  'Invoices',
  '/purchases': 'Purchases',
  '/payments':  'Payments',
  '/banking':   'Banking',
  '/journal':   'Journal Vouchers',
  '/reports':   'Reports',
  '/settings':  'Settings',
};

export default function Layout() {
  const { pathname } = useLocation();
  const base = '/' + pathname.split('/')[1];
  const title = TITLES[base] || 'SmartERP';

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </header>
        <div className="page">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
