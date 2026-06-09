# House Rules - Family Household Management

A household management app for families with kids. Parents manage allowances, chores, savings goals, and shopping lists. Kids get their own portal to view balances, claim chores, request money, and track savings progress.

**Stack**: PHP backend (custom router, no framework) | React 19 + Vite + TypeScript frontend | .NET MAUI desktop/mobile app

---

## Prerequisites

- **PHP 8.1+** with `pdo_sqlite` extension
- **Node.js 18+** and npm
- **.NET 10 SDK** (for MAUI app)

---

## Local Development

### 1. Backend (PHP API)

```bash
cd house

# Create the data directory for SQLite
mkdir -p data

# Copy and configure environment
cp .env.example .env   # or edit .env directly
# Defaults work for local dev — just ensure JWT_SECRET is set

# Run database migrations
php api/migrations/migrate.php

# Start the dev server on port 8080
php -S localhost:8080 api/router.php
```

The API is now available at `http://localhost:8080/api/`.

**Test it:**
```bash
# Register a parent account
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@example.com","password":"password123","display_name":"Mom"}'

# Login (returns a JWT token)
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@example.com","password":"password123"}'
```

### 2. Frontend (React)

```bash
cd house/frontend

# Install dependencies
npm install

# Start dev server on port 5173 (proxies /api to localhost:8080)
npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. MAUI Desktop/Mobile App

```bash
cd house/MAUI/HouseRules

# Restore packages
dotnet restore
```

**Windows (debug):**
```bash
dotnet build -f net10.0-windows10.0.19041.0 -c Debug
dotnet run -f net10.0-windows10.0.19041.0 -c Debug
```

**Android (debug on emulator):**
```bash
dotnet build -f net10.0-android -c Debug
dotnet run -f net10.0-android -c Debug
```

> In Debug mode, the app hits `http://localhost:8080/api`. In Release mode, it uses `https://house.trickypig.com`.

---

## Project Structure

```
house/
├── .env                    # Environment config
├── .htaccess               # Apache rewrite rules
├── api/
│   ├── index.php           # Front controller
│   ├── router.php          # PHP dev server router
│   ├── env.php             # .env parser
│   ├── config/             # App + database config
│   ├── helpers/            # Router, Response, Validator
│   ├── middleware/         # Auth (JWT), CORS
│   ├── models/            # User, Kid, Transaction, RecurringTransaction, SavingsGoal,
│   │                      # ChoreTemplate, ChoreInstance, ShoppingList, ShoppingListItem, Household
│   ├── routes/            # Route handlers (auth, kids, transactions, recurring, goals,
│   │                      # dashboard, kid_portal, chores, shopping, household)
│   ├── migrations/        # Schema scripts
│   └── tests/             # Unit tests
├── data/                   # SQLite database (gitignored)
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── context/       # Auth context
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components (Dashboard, Money, Chores, Shopping, Kid portal)
│   │   └── types/         # TypeScript types
│   ├── package.json
│   └── vite.config.ts     # Dev proxy to backend
└── MAUI/HouseRules/
    ├── Models/             # Data models
    ├── Services/           # API client + Auth service
    ├── Pages/              # XAML pages
    ├── Controls/           # Custom controls (BalanceChartView)
    └── MauiProgram.cs      # DI configuration
```

---

## Environment Variables (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `development` | `development` or `production` |
| `DB_DRIVER` | `sqlite` | `sqlite` or `mysql` |
| `DB_PATH` | `../data/house.db` | SQLite file path (relative to api/) |
| `DB_HOST` | _(empty)_ | MySQL host |
| `DB_NAME` | _(empty)_ | MySQL database name |
| `DB_USER` | _(empty)_ | MySQL user |
| `DB_PASS` | _(empty)_ | MySQL password |
| `JWT_SECRET` | `local-dev-secret-change-in-production-abc123` | **Change this!** Secret for JWT signing |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |

---

## Production Deployment

### Backend

1. Deploy the `house/` directory (excluding `frontend/`, `MAUI/`, `data/`) to your web server
2. Ensure Apache has `mod_rewrite` enabled (the `.htaccess` handles routing)
3. Create the `data/` directory and ensure it's writable by the web server
4. Update `.env`:
   ```
   APP_ENV=production
   JWT_SECRET=<a-strong-random-secret>
   CORS_ORIGIN=https://house.trickypig.com
   ```
5. Run migrations:
   ```bash
   php api/migrations/migrate.php
   ```
6. For MySQL instead of SQLite, set `DB_DRIVER=mysql` and the `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` variables

### Frontend

```bash
cd house/frontend

# Build for production
npm run build

# The dist/ folder contains the static site
# Deploy to your web server's document root
```

If serving the frontend from the same domain as the API, the `.htaccess` already handles SPA fallback routing.

### MAUI

The production API URL is set to `https://house.trickypig.com` (used in Release builds).

**Windows (release):**
```bash
cd house/MAUI/HouseRules
dotnet publish -f net10.0-windows10.0.19041.0 -c Release -p:WindowsPackageType=None -p:SelfContained=true
```

**Android (release APK):**
```bash
cd house/MAUI/HouseRules
dotnet publish -f net10.0-android -c Release
```

### Build Configurations Summary

| Platform | Debug (test) | Release (production) |
|----------|-------------|---------------------|
| **Android** | `dotnet run -f net10.0-android -c Debug` — deploys to emulator, hits localhost API | `dotnet publish -f net10.0-android -c Release` — signed APK for distribution |
| **Windows** | `dotnet run -f net10.0-windows10.0.19041.0 -c Debug` — runs locally, hits localhost API | `dotnet publish -f net10.0-windows10.0.19041.0 -c Release` — standalone .exe |

---

## API Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register parent account |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Current user info |
| PUT | `/api/auth/profile` | Yes | Update parent profile |
| POST | `/api/auth/kid-login` | Parent | Create login for a kid |
| GET | `/api/auth/kid-users` | Parent | List kid login accounts |
| PUT | `/api/auth/kid-login/{id}` | Parent | Update kid login |
| DELETE | `/api/auth/kid-login/{id}` | Parent | Delete kid login |

### Kids

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/kids` | Yes | List all kids with balances |
| POST | `/api/kids` | Parent | Create kid |
| GET | `/api/kids/{id}` | Yes | Get kid with balance |
| PUT | `/api/kids/{id}` | Parent | Update kid |
| DELETE | `/api/kids/{id}` | Parent | Delete kid and all related data |

### Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/kids/{kidId}/transactions` | Parent | List transactions (filterable, paginated) |
| POST | `/api/kids/{kidId}/transactions` | Parent | Create transaction |
| PUT | `/api/transactions/{id}` | Parent | Update transaction |
| DELETE | `/api/transactions/{id}` | Parent | Delete transaction |
| POST | `/api/transactions/{id}/verify` | Parent | Verify pending transaction |
| POST | `/api/transactions/{id}/cancel` | Parent | Cancel transaction |
| POST | `/api/kids/{kidId}/transactions/verify-all` | Parent | Verify all pending for a kid |
| GET | `/api/kids/{kidId}/weekly-summary` | Yes | Weekly balance summaries |

### Recurring Transactions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/kids/{kidId}/recurring` | Parent | List recurring rules |
| POST | `/api/kids/{kidId}/recurring` | Parent | Create recurring rule (weekly/biweekly/monthly) |
| PUT | `/api/recurring/{id}` | Parent | Update recurring rule |
| DELETE | `/api/recurring/{id}` | Parent | Delete recurring rule |

### Savings Goals

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/kids/{kidId}/goals` | Yes | Get savings goals |
| POST | `/api/kids/{kidId}/goals` | Yes | Create goal |
| GET | `/api/kids/{kidId}/goals/projections` | Yes | Get goal projections |
| PUT | `/api/kids/{kidId}/goals/reorder` | Yes | Reorder goals |
| PUT | `/api/goals/{id}` | Yes | Update goal |
| DELETE | `/api/goals/{id}` | Yes | Delete goal |

### Chores

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chores` | Parent | Get all chore templates and instances |
| POST | `/api/chores` | Parent | Create chore template |
| PUT | `/api/chores/{id}` | Parent | Update chore template |
| DELETE | `/api/chores/{id}` | Parent | Delete chore template |
| GET | `/api/chores/instances` | Parent | List chore instances (filterable) |
| POST | `/api/chores/instances/{id}/verify` | Parent | Verify completed chore |
| POST | `/api/chores/instances/{id}/reject` | Parent | Reject completed chore |
| GET | `/api/my/chores` | Kid | Get assigned/open chores |
| POST | `/api/my/chores/{id}/claim` | Kid | Claim an open chore |
| POST | `/api/my/chores/{id}/complete` | Kid | Mark chore as completed |

### Shopping

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/shopping/lists` | Yes | Get all shopping lists |
| POST | `/api/shopping/lists` | Parent | Create shopping list |
| PUT | `/api/shopping/lists/{id}` | Parent | Update shopping list |
| DELETE | `/api/shopping/lists/{id}` | Parent | Delete shopping list |
| GET | `/api/shopping/lists/{id}/items` | Yes | Get items in list |
| POST | `/api/shopping/lists/{id}/items` | Yes | Add item |
| PUT | `/api/shopping/items/{id}` | Yes | Update item |
| POST | `/api/shopping/items/{id}/toggle` | Yes | Toggle purchased status |
| DELETE | `/api/shopping/items/{id}` | Yes | Delete item |
| GET | `/api/shopping/autocomplete` | Yes | Item name suggestions |

### Household

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/household` | Parent | Get household info and members |
| PUT | `/api/household` | Parent | Update household name |
| POST | `/api/household/regenerate-code` | Parent | Generate new invite code |
| POST | `/api/household/join` | Parent | Join household by invite code |

### Dashboard & Kid Portal

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard` | Parent | Household overview |
| GET | `/api/my/dashboard` | Kid | Kid's own dashboard |
| GET | `/api/my/transactions` | Kid | Kid's transactions |
| GET | `/api/my/weekly-summary` | Kid | Kid's weekly summary |
| POST | `/api/my/request` | Kid | Request money from parent |
