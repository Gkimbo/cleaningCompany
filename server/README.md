<div align="center">

# Kleanr Server

![Node.js](https://img.shields.io/badge/Node.js-18.x-green)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-316192)
![Tests](https://img.shields.io/badge/tests-273%20passing-brightgreen)

**Express.js API server for the Kleanr cleaning service platform**

</div>

---

## Overview

The Kleanr server is a RESTful API built with Express.js that handles authentication, appointments, payments, messaging, and tax document generation for the cleaning service platform.

## Getting Started

### Prerequisites

- Node.js v18.x or higher
- PostgreSQL v14 or higher
- Stripe account with Connect enabled

### Installation

```bash
# Install dependencies
npm install

# Create database
createdb cleaning_company_development

# Run migrations
npx sequelize-cli db:migrate

# Seed manager account
npx sequelize-cli db:seed --seed managerSeeder.js

# Start the server
npm start
```

The server runs on `http://localhost:3000`.

## Project Structure

```
server/
├── __tests__/
│   ├── integration/              # Integration tests
│   │   ├── fullPaymentFlow.test.js
│   │   ├── stripe.test.js
│   │   └── stripeConnectFlow.test.js
│   ├── routes/                   # Route tests
│   │   ├── appointments.test.js
│   │   ├── auth.test.js
│   │   ├── messages.test.js
│   │   ├── payments.test.js
│   │   ├── platformTax.test.js
│   │   ├── stripeConnect.test.js
│   │   └── tax.test.js
│   └── models/                   # Model tests
│       └── Payment.test.js
│
├── config/
│   └── database.js               # Sequelize config
│
├── migrations/                   # Database migrations
│   ├── 20251211...-create-users.js
│   ├── 20251211...-create-payments.js
│   ├── 20251211...-create-tax-info.js
│   ├── 20251211...-create-tax-documents.js
│   ├── 20251212...-create-platform-earnings.js
│   └── ...
│
├── models/                       # Sequelize models
│   ├── User.js
│   ├── UserAppointments.js
│   ├── Payment.js
│   ├── Payout.js
│   ├── TaxInfo.js
│   ├── TaxDocument.js
│   ├── PlatformEarnings.js
│   ├── Conversation.js
│   ├── Message.js
│   └── index.js
│
├── routes/api/v1/
│   ├── userSessionsRouter.js     # Authentication
│   ├── usersRouter.js            # User management
│   ├── appointmentsRouter.js     # Appointments
│   ├── paymentRouter.js          # Payments & Stripe
│   ├── stripeConnectRouter.js    # Cleaner payouts
│   ├── taxRouter.js              # Tax documents
│   ├── messagesRouter.js         # Messaging
│   └── ...
│
├── services/
│   ├── TaxDocumentService.js     # 1099-NEC generation
│   ├── PlatformTaxService.js     # Platform tax reporting
│   └── emailService.js           # Email notifications
│
├── middleware/
│   └── authMiddleware.js         # JWT authentication
│
├── app.js                        # Express app setup
└── package.json
```

## Environment Variables

Create a `.env` file in the server directory:

```bash
# Database
DATABASE_URL=postgresql://localhost/cleaning_company_development

# Authentication
SESSION_SECRET=your_secret_key_here

# Stripe Payments
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# Email (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@kleanr.com

# Company Info (Tax Documents)
COMPANY_NAME=Your Cleaning Company
COMPANY_EIN=XX-XXXXXXX
COMPANY_ENTITY_TYPE=LLC
COMPANY_ADDRESS_LINE1=123 Main Street
COMPANY_CITY=Your City
COMPANY_STATE=ST
COMPANY_ZIP=12345

# External APIs (Optional)
GOOGLE_MAPS=your_google_maps_key
API_NINJA_API_KEY=your_api_key
```

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/user-sessions/login` | User login | No |
| POST | `/api/v1/users` | Register user | No |
| GET | `/api/v1/user-sessions/current` | Get current user | Yes |
| POST | `/api/v1/user-sessions/logout` | Logout | Yes |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/user-info` | Get user profile | Yes |
| GET | `/api/v1/employee-info` | Get employee info | Yes |
| POST | `/api/v1/users/new-employee` | Create employee | Manager |
| PATCH | `/api/v1/users/employee` | Update employee | Manager |
| DELETE | `/api/v1/users/employee` | Delete employee | Manager |

### Appointments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/appointments/:homeId` | Get home appointments | Yes |
| GET | `/api/v1/appointments/unassigned` | Get unassigned jobs | Yes |
| POST | `/api/v1/appointments` | Create appointment | Yes |
| PATCH | `/api/v1/appointments/:id` | Update appointment | Yes |
| DELETE | `/api/v1/appointments/:id` | Cancel appointment | Yes |
| PATCH | `/api/v1/appointments/request-employee` | Request cleaner | Yes |
| PATCH | `/api/v1/appointments/approve-request` | Approve request | Manager |

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/payments/config` | Get Stripe config | No |
| POST | `/api/v1/payments/create-intent` | Create payment intent | Yes |
| POST | `/api/v1/payments/create-payment-intent` | Create with metadata | Yes |
| POST | `/api/v1/payments/capture` | Capture payment | Yes |
| POST | `/api/v1/payments/refund` | Refund payment | Yes |
| GET | `/api/v1/payments/history/:userId` | Payment history | Yes |
| GET | `/api/v1/payments/earnings/:employeeId` | Employee earnings | Yes |
| POST | `/api/v1/payments/webhook` | Stripe webhook | No |

### Stripe Connect (Cleaner Payouts)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/stripe-connect/account-status/:userId` | Get account status | Yes |
| POST | `/api/v1/stripe-connect/create-account` | Create Connect account | Yes |
| POST | `/api/v1/stripe-connect/onboarding-link` | Get onboarding URL | Yes |
| POST | `/api/v1/stripe-connect/dashboard-link` | Get dashboard URL | Yes |
| POST | `/api/v1/stripe-connect/process-payout` | Process payout | Yes |
| GET | `/api/v1/stripe-connect/payouts/:userId` | Get payout history | Yes |
| POST | `/api/v1/stripe-connect/webhook` | Connect webhook | No |

### Tax Documents

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/tax/info` | Get W-9 info | Yes |
| POST | `/api/v1/tax/info` | Submit W-9 | Yes |
| GET | `/api/v1/tax/contractor/tax-summary/:year` | Cleaner tax summary | Yes |
| GET | `/api/v1/tax/contractor/1099-nec/:year` | Get 1099-NEC | Yes |
| GET | `/api/v1/tax/payment-history/:year` | Payment history | Yes |

### Platform Tax (Manager)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/tax/platform/income-summary/:year` | Annual income | Manager |
| GET | `/api/v1/tax/platform/quarterly-tax/:year/:quarter` | Quarterly tax | Manager |
| GET | `/api/v1/tax/platform/schedule-c/:year` | Schedule C data | Manager |
| GET | `/api/v1/tax/platform/1099-k-expectation/:year` | 1099-K info | Manager |
| GET | `/api/v1/tax/platform/deadlines/:year` | Tax deadlines | Manager |
| GET | `/api/v1/tax/platform/comprehensive-report/:year` | Full report | Manager |
| GET | `/api/v1/tax/platform/monthly-breakdown/:year` | Monthly breakdown | Manager |

### Messaging

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/messages/conversations` | Get conversations | Yes |
| GET | `/api/v1/messages/conversation/:id` | Get messages | Yes |
| POST | `/api/v1/messages/send` | Send message | Yes |
| POST | `/api/v1/messages/conversation/appointment` | Create for appointment | Yes |
| POST | `/api/v1/messages/conversation/support` | Create support chat | Yes |
| POST | `/api/v1/messages/broadcast` | Broadcast message | Manager |
| GET | `/api/v1/messages/unread-count` | Get unread count | Yes |
| PATCH | `/api/v1/messages/mark-read/:id` | Mark as read | Yes |

## Models

### User
```javascript
{
  id, username, email, passwordHash,
  type,           // 'cleaner', 'manager1', or null
  stripeConnectId // For cleaners with Connect accounts
}
```

### Payment
```javascript
{
  id, transactionId, appointmentId, userId,
  amountCents, transactionType, status,
  stripePaymentIntentId, description
}
```

### Payout
```javascript
{
  id, appointmentId, cleanerId,
  grossAmountCents, platformFeeCents, netAmountCents,
  stripeTransferId, status
}
```

### PlatformEarnings
```javascript
{
  id, transactionId, appointmentId,
  grossServiceAmount, platformFeeAmount, netPlatformEarnings,
  taxYear, taxQuarter, taxMonth, status
}
```

### TaxInfo (W-9 Data)
```javascript
{
  id, userId, legalName, businessName,
  taxClassification, taxIdEncrypted,
  address, city, state, zipCode
}
```

### TaxDocument
```javascript
{
  id, userId, taxYear, formType,
  totalAmountCents, status, generatedAt
}
```

## Services

### TaxDocumentService
Handles 1099-NEC generation for contractors:
- `validateTaxInfoComplete()` - Validate W-9 data
- `generate1099NECData()` - Generate form data
- `getTaxDeadlines()` - Get filing deadlines
- `generateAll1099NECsForYear()` - Batch generation

### PlatformTaxService
Handles platform tax reporting:
- `recordPlatformEarnings()` - Record 10% platform fee
- `getAnnualIncomeSummary()` - Yearly income report
- `calculateQuarterlyEstimatedTax()` - Quarterly estimates
- `generateScheduleCData()` - Schedule C form data
- `getComprehensiveTaxReport()` - Full tax report

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- __tests__/routes/tax.test.js

# Run with coverage
npm test -- --coverage
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Authentication | 11 | Login, registration, JWT |
| Appointments | 12 | CRUD, assignments, requests |
| Payments | 16 | Stripe intents, capture, refund |
| Stripe Connect | 44 | Account creation, payouts |
| Tax Documents | 21 | W-9, 1099-NEC, platform taxes |
| Messaging | 21 | Conversations, send, broadcast |
| Integration | 27 | Full payment flows |

## Database

### Migrations

```bash
# Run migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Undo all migrations
npx sequelize-cli db:migrate:undo:all
```

### Seeds

```bash
# Run all seeds
npx sequelize-cli db:seed:all

# Run specific seed
npx sequelize-cli db:seed --seed managerSeeder.js
```

## WebSocket Events

The server uses Socket.io for real-time messaging:

```javascript
// Client connects
socket.on('connection', (socket) => {
  socket.on('join_conversation', (conversationId) => { ... });
  socket.on('send_message', (data) => { ... });
  socket.on('typing', (data) => { ... });
});

// Server emits
io.to(conversationId).emit('new_message', message);
io.to(userId).emit('unread_count', count);
```

## Stripe Webhooks

Configure webhooks in your Stripe dashboard:

### Payment Webhooks
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`

### Connect Webhooks
- `account.updated`
- `transfer.created`
- `transfer.failed`

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon |
| `npm test` | Run Jest tests |
| `npm run migrate` | Run migrations |
| `npm run seed` | Run all seeds |

## Error Handling

API errors follow a consistent format:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input data",
  "details": { ... }
}
```

Common error codes:
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Invalid/missing token
- `FORBIDDEN` - Insufficient permissions
- `VALIDATION_ERROR` - Invalid input
- `STRIPE_ERROR` - Payment processing error

## Contributing

See the main [README](../README.md) for contribution guidelines.
