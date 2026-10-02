# Nescopharm - Complete ERP System

A comprehensive Enterprise Resource Planning system with modern frontend and Laravel backend.

## Structure

- **citimaxerp/** - Next.js frontend application
- **citimaxerp-backend/** - Laravel REST API backend

## Features

- Product pricing system with flexible price codes (NSPV, NSPH, NSPO, NSPD)
- Per-variation pricing for products with multiple variants
- Price code tracking on quotes, orders, and invoices
- Official and Pricing document views for quotes/invoices
- Complete inventory, sales, and financial management

## Getting Started

### Frontend
```bash
cd citimaxerp
npm install
npm run dev
```

### Backend
```bash
cd citimaxerp-backend
composer install
php artisan migrate
php artisan serve
```

## Recent Updates

- Implemented product pricing system with NSPV (main price) and alternative prices (NSPH, NSPO, NSPD)
- Added per-variation pricing for products with variants
- Added price code tracking through quote → order → invoice workflow
- Added Official/Pricing document views for better pricing visibility
- Database migration for variant-level price tiers

## Development

All future commits and changes will be tracked in this repository.

Generated with Claude Code
