import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/layout/Layout';
import Dashboard       from './pages/Dashboard';
import Customers       from './pages/customers';
import Suppliers       from './pages/suppliers';
import Stock           from './pages/stock';
import Invoices        from './pages/invoices';
import InvoiceForm     from './pages/invoices/InvoiceForm';
import InvoiceDetail   from './pages/invoices/InvoiceDetail';
import Purchases       from './pages/purchases';
import Payments        from './pages/payments';
import Banking         from './pages/banking';
import Journal         from './pages/journal';
import Reports         from './pages/reports';
import Settings        from './pages/settings';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: 'var(--accent-2)', secondary: 'var(--bg-2)' } },
          error:   { iconTheme: { primary: 'var(--danger)',   secondary: 'var(--bg-2)' } },
        }}
      />
      <Routes>
        <Route element={<Layout />}>
          <Route index        element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="stock"     element={<Stock />} />
          <Route path="invoices">
            <Route index        element={<Invoices />} />
            <Route path="new"   element={<InvoiceForm />} />
            <Route path=":id"   element={<InvoiceDetail />} />
          </Route>
          <Route path="purchases" element={<Purchases />} />
          <Route path="payments"  element={<Payments />} />
          <Route path="banking"   element={<Banking />} />
          <Route path="journal"   element={<Journal />} />
          <Route path="reports"   element={<Reports />} />
          <Route path="settings"  element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
