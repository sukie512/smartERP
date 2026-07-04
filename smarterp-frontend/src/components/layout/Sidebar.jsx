import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Truck, Package, FileText,
  ShoppingCart, CreditCard, Building2, BookOpen,
  BarChart3, Settings, ChevronRight, Receipt,
} from 'lucide-react';

const NAV = [
  {
    label: 'Main',
    items: [
      { to: '/',           icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/invoices',   icon: FileText,    label: 'Invoices' },
      { to: '/purchases',  icon: ShoppingCart,label: 'Purchases' },
      { to: '/payments',   icon: CreditCard,  label: 'Payments' },
    ],
  },
  {
    label: 'Masters',
    items: [
      { to: '/customers',  icon: Users,       label: 'Customers' },
      { to: '/suppliers',  icon: Truck,       label: 'Suppliers' },
      { to: '/stock',      icon: Package,     label: 'Stock & Items' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/banking',    icon: Building2,   label: 'Banking' },
      { to: '/journal',    icon: BookOpen,    label: 'Journal Vouchers' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports',    icon: BarChart3,   label: 'All Reports' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings',   icon: Settings,    label: 'Settings' },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">S</div>
        <div>
          <div className="sidebar-logo-text">SmartERP</div>
          <div className="sidebar-logo-sub">Billing · Inventory · Accounts</div>
        </div>
      </div>

      {NAV.map((section) => (
        <div className="sidebar-section" key={section.label}>
          <div className="sidebar-label">{section.label}</div>
          {section.items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
}
