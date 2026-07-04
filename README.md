# SmartERP

A full-stack Enterprise Resource Planning (ERP) system designed for small and medium-sized businesses to efficiently manage inventory, purchases, sales, accounting, banking, payments, and financial reporting.

The application follows a modular architecture with a React frontend, Express.js backend, and PostgreSQL database, implementing accounting principles such as double-entry bookkeeping and automated ledger posting.

---

# Features

## Inventory Management

- Create and manage stock groups
- Unit management
- Stock item management
- Automatic stock movement tracking
- Purchase price updates
- Real-time stock quantity adjustment
- Stock movement history

---

## Purchase Management

- Create purchase orders
- Purchase item management
- Automatic GST calculation
- CGST / SGST / IGST support
- Supplier-wise purchase tracking
- Purchase return (Debit Notes)
- Automatic stock increment after purchase
- Automatic ledger postings

---

## Sales & Invoice Management

- Customer management
- Sales invoice generation
- Invoice item tracking
- GST calculation
- Automatic stock deduction
- Invoice history

---

## Accounting Module

Implements double-entry bookkeeping.

Features include:

- Ledger creation
- Ledger entries
- Journal vouchers
- Journal entries
- Automatic accounting entries
- General ledger
- Trial balance support
- Purchase and sales accounting

Example:

Purchase Entry

Debit:
- Purchase Expense
- GST Input Credit

Credit:
- Supplier Ledger

---

## Banking Module

- Bank account management
- Bank reconciliation
- Receipt entries
- Payment entries
- Transfer between accounts

---

## GST Support

Supports Indian GST system:

- CGST
- SGST
- IGST

Automatic calculations during:

- Purchases
- Sales
- Debit Notes
- Credit Notes

---

## Reports

- Purchase reports
- Sales reports
- Ledger reports
- Stock reports
- Financial summaries

---

# Tech Stack

## Frontend

- React 19
- Vite
- React Router
- Axios
- Recharts
- Lucide Icons

---

## Backend

- Node.js
- Express.js
- PostgreSQL
- pg (PostgreSQL driver)

---

## Database

PostgreSQL

Uses relational database design with:

- Foreign Keys
- Constraints
- Transactions
- Indexes
- UUID Primary Keys

---

# Project Structure

```
smartERP
│
├── smarterp-frontend
│   ├── public
│   ├── src
│   │   ├── api
│   │   ├── components
│   │   ├── hooks
│   │   ├── pages
│   │   ├── utils
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── smarterp-backend
│   ├── src
│   │   ├── config
│   │   ├── controllers
│   │   ├── routes
│   │   ├── services
│   │   ├── middleware
│   │   ├── utils
│   │   └── app.js
│   ├── package.json
│   └── .env
│
└── README.md
```

---

# Database Design

The system consists of multiple relational tables including:

- stock_groups
- units
- stock_items
- customers
- suppliers
- bank_accounts
- ledgers
- ledger_entries
- invoices
- invoice_items
- purchases
- purchase_items
- receipts
- payments
- credit_notes
- credit_note_items
- debit_notes
- debit_note_items
- journal_vouchers
- journal_entries
- stock_movements
- bank_reconciliation
- counters

Relationships are maintained using foreign key constraints.

---

# Automated Features

The system automatically performs several operations:

## Purchase

- Creates purchase record
- Creates purchase items
- Calculates GST
- Updates stock quantity
- Updates purchase price
- Creates ledger entries
- Updates supplier balance

---

## Invoice

- Creates invoice
- Deducts stock
- Calculates GST
- Posts accounting entries

---

## Debit Note

- Reduces purchase value
- Decreases inventory
- Reverses accounting entries
- Adjusts supplier balance

---

# Accounting Workflow

Example purchase:

Supplier

↓

Purchase Created

↓

Purchase Items Added

↓

Stock Increased

↓

GST Calculated

↓

Ledger Entries Posted

↓

Transaction Committed

Everything occurs within a PostgreSQL transaction to ensure data consistency.

---

# Installation

## Clone Repository

```bash
git clone <repository-url>
```

---

## Backend Setup

```bash
cd smarterp-backend
npm install
```

Create a `.env` file:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5433/smarterp

PORT=5000

NODE_ENV=development
```

Run backend:

```bash
npm run dev
```

---

## Frontend Setup

```bash
cd smarterp-frontend
npm install
npm run dev
```

Frontend runs on

```
http://localhost:5173
```

Backend runs on

```
http://localhost:5000
```

---

# PostgreSQL Setup

1. Install PostgreSQL
2. Create database:

```
smarterp
```

3. Configure DATABASE_URL

4. Run backend

Database schema is automatically initialized using:

```
setupDb.js
```

which creates all required tables and seeds default data.

---

# API Modules

The backend is organized into modular services.

Examples:

```
Customer Service

Supplier Service

Purchase Service

Invoice Service

Payment Service

Ledger Service

Stock Service

Bank Service

Report Service

Settings Service
```

Each module consists of:

- Route
- Controller
- Service
- Database Queries

---

# Error Handling

The application includes:

- Centralized error handling
- Transaction rollback
- Input validation
- Database constraint validation
- HTTP status responses

---

# Future Improvements

- JWT Authentication
- Role-Based Access Control
- User Management
- Dashboard Analytics
- Email Notifications
- PDF Invoice Generation
- Barcode Support
- Multi-warehouse Inventory
- Audit Logs
- File Uploads
- Docker Deployment
- Unit Testing
- CI/CD Pipeline

---

# Author

Developed as a full-stack ERP application using React, Express.js, and PostgreSQL with a modular service-based architecture and automated accounting workflows.
