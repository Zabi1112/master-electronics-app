# Master Electronics — Project Scope

## Project Overview

**Master Electronics** is a centralized electronics shop management system for managing inventory, customers, cash sales, installment sales, installment recovery, users, roles, partner investments, and dashboard analytics.

The system is being built as a responsive web application so it can work on desktop, tablet, and mobile browser.

## Tech Stack

### Frontend
- React.js
- Responsive mobile-friendly UI
- Golden Black theme
- Dashboard cards and reports

### Backend
- Node.js
- Express.js
- PostgreSQL
- Sequelize ORM
- JWT Authentication
- Role-based access control

## Main User Roles

### Admin / Owner
Full access to all modules.

### Manager
Can manage customers, inventory, sales, installments, and reports.

### Salesman
Limited access. Can create customers, create sales, and receive installment payments.

### Accounts
Can manage payments, installments, reports, and finance-related data.

## Core Modules

### 1. Authentication & User Management
- Admin registration
- Login
- JWT token generation
- Protected routes
- Role-based permissions
- Create users
- Update users
- Disable/enable users
- Reset user password
- Delete non-admin users

### 2. Customer Management
- Add customer details
- Customer CNIC
- Customer phone/address
- Reference person details
- Reference CNIC numbers
- Optional cheque number for installment customers
- Customer type: cash or installment
- Risk status
- Notes

### 3. Inventory / Product Management
- Add products to inventory
- Product category, brand, model
- Serial number / IMEI number
- Purchase price
- Cash sale price
- Installment sale price
- Quantity
- Warranty information
- Product status: in stock, sold, returned, damaged

### 4. Sales System
Supports two sale types:

#### Cash Sale
- Product sold on cash
- Inventory quantity reduced
- Profit calculated
- Sale marked as completed

#### Installment Sale
- Customer required
- Advance/down payment handled
- Installment duration handled
- Monthly installment calculated
- Expected clear date calculated
- Profit calculated
- Installment schedule generated
- Inventory quantity reduced

### 5. Installment Recovery System
- Receive installment payment
- Partial payment support
- Full payment support
- Installment status update
- Sale remaining amount update
- Sale marked cleared when fully paid
- Profit recovered and profit pending calculation

### 6. Partner / Investor System — Planned
This will track:
- Partner profile
- Partner investment
- Partner withdrawals
- Partner profit/loss share
- Partner balance
- Partner ledger report

### 7. Dashboard Analytics — Planned
Dashboard will show:
- Total money invested
- Total money regained
- Total cash sales
- Total installment sales
- Total installment receivable
- Total recovered amount
- Total pending amount
- Overdue installments
- Profit recovered
- Profit pending
- Inventory value
- Partner investment
- Partner withdrawals
- Net business position

## Important Business Calculations

### Installment Sale
```text
Remaining Amount = Installment Price - Advance Amount
Monthly Installment = Remaining Amount / Installment Months
Expected Clear Date = Start Date + Installment Duration
Profit = Installment Price - Purchase Price
```

### Profit Recovery
```text
First recover purchase/investment amount.
After purchase amount is recovered, extra recovered amount is treated as profit recovered.
```

### Business Money Flow
```text
Total Regained = Cash Sales Received + Advance Payments + Installment Payments
Money Circling in Installments = Remaining Amount of Active Installment Sales
```

## Planned Screens

### Authentication
- Login page
- Admin setup page

### Main App
- Dashboard
- User Management
- Customers
- Inventory
- Cash Sale
- Installment Sale
- Installment Recovery
- Partner Management
- Reports
- Settings

## Mobile Responsive Design Requirement

The system must work properly on:
- Desktop
- Laptop
- Tablet
- Mobile browser

Mobile behavior:
- Sidebar should become hamburger or bottom navigation
- Tables should become card-style views
- Dashboard cards should stack vertically
- Forms should use clean multi-section layout
