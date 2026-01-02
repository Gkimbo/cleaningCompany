<div align="center">

# Kleanr API Server

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Connect-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-964_Passing-brightgreen?style=for-the-badge)

**RESTful API server for the Kleanr cleaning service platform**

[Getting Started](#-getting-started) | [API Reference](#-api-reference) | [Database](#-database) | [Services](#-services)

</div>

---

## Overview

The Kleanr server is an Express.js API that powers the cleaning service platform. It handles authentication, appointment scheduling, payment processing with Stripe, real-time messaging, calendar synchronization with vacation rental platforms, and comprehensive tax document generation.

---

## Getting Started

### Prerequisites

- Node.js v18.x or higher
- PostgreSQL v14 or higher
- Stripe account with Connect enabled
- Gmail account for email notifications (optional)

### Installation

```bash
# Install dependencies
npm install

# Create database
createdb cleaning_company_development

# Run migrations
npx sequelize-cli db:migrate

# Seed initial data (manager account)
npx sequelize-cli db:seed --seed ownerSeeder.js

# Seed Terms & Conditions and Privacy Policy
npx sequelize-cli db:seed --seed termsAndConditionsSeeder.js
npx sequelize-cli db:seed --seed privacyPolicySeeder.js

# Start the server
npm start
```

The server runs on `http://localhost:3000`.

### Environment Variables

Create a `.env` file:

```bash
# ===================
# Core Configuration
# ===================
NODE_ENV=development
PORT=3000
SESSION_SECRET=your_super_secret_key_here

# ===================
# Database
# ===================
DATABASE_URL=postgresql://localhost/cleaning_company_development

# ===================
# Stripe Payments (Required)
# ===================
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# ===================
# Email Notifications
# ===================
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@kleanr.com

# ===================
# Company Info (Tax Documents)
# ===================
COMPANY_NAME=Your Cleaning Company LLC
COMPANY_EIN=XX-XXXXXXX
COMPANY_ENTITY_TYPE=LLC
COMPANY_ADDRESS_LINE1=123 Main Street
COMPANY_CITY=Your City
COMPANY_STATE=ST
COMPANY_ZIP=12345
COMPANY_PHONE=(555) 123-4567

# ===================
# External APIs (Optional)
# ===================
GOOGLE_MAPS_API_KEY=your_google_maps_key
API_NINJA_API_KEY=your_api_ninja_key
```

---

## Project Structure

```
server/
├── __tests__/
│   ├── integration/                # End-to-end tests
│   │   ├── fullPaymentFlow.test.js
│   │   ├── stripe.test.js
│   │   └── stripeConnectFlow.test.js
│   ├── routes/                     # Route tests
│   │   ├── appointments.test.js
│   │   ├── auth.test.js
│   │   ├── calendarSync.test.js
│   │   ├── messages.test.js
│   │   ├── payments.test.js
│   │   ├── reviews.test.js
│   │   ├── tax.test.js
│   │   └── terms.test.js
│   └── services/                   # Service tests
│       └── calendarSyncService.test.js
│
├── config/
│   └── database.js                 # Sequelize configuration
│
├── migrations/                     # Database migrations
│   ├── 20251211...-create-users.js
│   ├── 20251211...-create-homes.js
│   ├── 20251211...-create-appointments.js
│   ├── 20251211...-create-payments.js
│   ├── 20251212...-create-calendar-sync.js
│   ├── 20251212...-create-reviews.js
│   └── ...
│
├── models/                         # Sequelize models
│   ├── User.js
│   ├── UserHomes.js
│   ├── UserAppointments.js
│   ├── CalendarSync.js
│   ├── Payment.js
│   ├── Payout.js
│   ├── Review.js
│   ├── TaxInfo.js
│   ├── TaxDocument.js
│   ├── Conversation.js
│   ├── Message.js
│   ├── TermsAndConditions.js
│   ├── UserTermsAcceptance.js
│   └── index.js
│
├── routes/api/v1/
│   ├── userSessionsRouter.js       # Authentication
│   ├── usersRouter.js              # User management
│   ├── appointmentsRouter.js       # Appointments
│   ├── calendarSyncRouter.js       # iCal sync
│   ├── paymentRouter.js            # Payments & cron jobs
│   ├── stripeConnectRouter.js      # Cleaner payouts
│   ├── taxRouter.js                # Tax documents
│   ├── reviewsRouter.js            # Reviews
│   ├── messageRouter.js            # Messaging
│   ├── pushNotificationRouter.js   # Push notifications
│   ├── managerDashboardRouter.js   # Manager features
│   ├── applicationRouter.js        # Job applications
│   ├── jobPhotosRouter.js          # Photo uploads
│   └── termsRouter.js              # Terms & Conditions
│
├── services/
│   ├── calendarSyncService.js      # iCal parsing & sync
│   ├── TaxDocumentService.js       # 1099-NEC generation
│   ├── PlatformTaxService.js       # Platform tax reporting
│   └── sendNotifications/
│       ├── EmailClass.js           # HTML email notifications
│       └── PushNotificationClass.js # Expo push notifications
│
├── middleware/
│   └── authenticatedToken.js       # JWT authentication
│
├── seeders/                        # Database seeds
│   ├── ownerSeeder.js              # Manager account
│   ├── termsAndConditionsSeeder.js # Terms for homeowners/cleaners
│   └── privacyPolicySeeder.js      # Privacy policy document
│
├── app.js                          # Express app setup
└── package.json
```

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/user-sessions/login` | User login | No |
| `POST` | `/api/v1/users` | Register new user | No |
| `GET` | `/api/v1/user-sessions/current` | Get current user | Yes |
| `POST` | `/api/v1/user-sessions/logout` | Logout user | Yes |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/user-info` | Get user profile | Yes |
| `GET` | `/api/v1/employee-info` | Get employee details | Yes |
| `POST` | `/api/v1/users/new-employee` | Create employee | Manager |
| `PATCH` | `/api/v1/users/employee` | Update employee | Manager |
| `DELETE` | `/api/v1/users/employee` | Delete employee | Manager |

### Homes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/homes` | Get user's homes | Yes |
| `POST` | `/api/v1/homes` | Add new home | Yes |
| `PATCH` | `/api/v1/homes/:id` | Update home | Yes |
| `DELETE` | `/api/v1/homes/:id` | Delete home | Yes |

### Appointments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/appointments/:homeId` | Get home appointments | Yes |
| `GET` | `/api/v1/appointments/unassigned` | Get unassigned jobs | Yes |
| `POST` | `/api/v1/appointments` | Create appointment | Yes |
| `PATCH` | `/api/v1/appointments/:id` | Update appointment | Yes |
| `DELETE` | `/api/v1/appointments/:id` | Cancel appointment | Yes |
| `PATCH` | `/api/v1/appointments/request-employee` | Request cleaner | Yes |
| `PATCH` | `/api/v1/appointments/approve-request` | Approve request | Manager |

### Calendar Sync

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/calendar-sync/home/:homeId` | Get syncs for home | Yes |
| `POST` | `/api/v1/calendar-sync` | Create new sync | Yes |
| `GET` | `/api/v1/calendar-sync/:id` | Get sync details | Yes |
| `PATCH` | `/api/v1/calendar-sync/:id` | Update sync settings | Yes |
| `DELETE` | `/api/v1/calendar-sync/:id` | Remove sync | Yes |
| `POST` | `/api/v1/calendar-sync/:id/sync` | Trigger manual sync | Yes |

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/payments/config` | Get Stripe publishable key | No |
| `POST` | `/api/v1/payments/create-intent` | Create payment intent | Yes |
| `POST` | `/api/v1/payments/create-payment-intent` | Create with metadata | Yes |
| `POST` | `/api/v1/payments/capture` | Capture payment | Yes |
| `POST` | `/api/v1/payments/refund` | Process refund | Yes |
| `GET` | `/api/v1/payments/history/:userId` | Payment history | Yes |
| `GET` | `/api/v1/payments/earnings/:employeeId` | Employee earnings | Yes |
| `POST` | `/api/v1/payments/webhook` | Stripe webhook | No |

### Stripe Connect (Cleaner Payouts)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/stripe-connect/account-status/:userId` | Account status | Yes |
| `POST` | `/api/v1/stripe-connect/create-account` | Create Connect account | Yes |
| `POST` | `/api/v1/stripe-connect/onboarding-link` | Get onboarding URL | Yes |
| `POST` | `/api/v1/stripe-connect/dashboard-link` | Get dashboard URL | Yes |
| `POST` | `/api/v1/stripe-connect/process-payout` | Process payout | Yes |
| `GET` | `/api/v1/stripe-connect/payouts/:userId` | Payout history | Yes |
| `POST` | `/api/v1/stripe-connect/webhook` | Connect webhook | No |

### Tax Documents

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/tax/info` | Get W-9 info | Yes |
| `POST` | `/api/v1/tax/info` | Submit W-9 | Yes |
| `GET` | `/api/v1/tax/contractor/tax-summary/:year` | Cleaner tax summary | Yes |
| `GET` | `/api/v1/tax/contractor/1099-nec/:year` | Get 1099-NEC | Yes |
| `GET` | `/api/v1/tax/payment-history/:year` | Payment history | Yes |

### Platform Tax (Manager Only)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/tax/platform/income-summary/:year` | Annual income | Manager |
| `GET` | `/api/v1/tax/platform/quarterly-tax/:year/:quarter` | Quarterly estimates | Manager |
| `GET` | `/api/v1/tax/platform/schedule-c/:year` | Schedule C data | Manager |
| `GET` | `/api/v1/tax/platform/1099-k-expectation/:year` | 1099-K info | Manager |
| `GET` | `/api/v1/tax/platform/deadlines/:year` | Tax deadlines | Manager |
| `GET` | `/api/v1/tax/platform/comprehensive-report/:year` | Full report | Manager |
| `GET` | `/api/v1/tax/platform/monthly-breakdown/:year` | Monthly breakdown | Manager |

### Reviews

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/reviews/pending` | Get pending reviews | Yes |
| `GET` | `/api/v1/reviews/cleaner/:cleanerId` | Get cleaner reviews | Yes |
| `POST` | `/api/v1/reviews` | Submit review | Yes |
| `GET` | `/api/v1/reviews/cleaner/:cleanerId/summary` | Review summary | Yes |

### Messaging

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/messages/conversations` | Get conversations | Yes |
| `GET` | `/api/v1/messages/conversation/:id` | Get messages | Yes |
| `POST` | `/api/v1/messages/send` | Send message | Yes |
| `POST` | `/api/v1/messages/conversation/appointment` | Create for appointment | Yes |
| `POST` | `/api/v1/messages/conversation/support` | Create support chat | Yes |
| `POST` | `/api/v1/messages/broadcast` | Broadcast message | Manager |
| `GET` | `/api/v1/messages/unread-count` | Get unread count | Yes |
| `PATCH` | `/api/v1/messages/mark-read/:id` | Mark as read | Yes |

### Push Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/push-notifications/register-token` | Register Expo push token | Yes |
| `DELETE` | `/api/v1/push-notifications/remove-token` | Remove push token (logout) | Yes |
| `GET` | `/api/v1/push-notifications/preferences` | Get notification preferences | Yes |
| `PATCH` | `/api/v1/push-notifications/preferences` | Update preferences | Yes |
| `POST` | `/api/v1/push-notifications/snooze-supply-reminder` | Snooze supply reminders for 1 week | Cleaner |
| `GET` | `/api/v1/push-notifications/supply-reminder-status` | Get snooze status | Yes |

### Terms & Conditions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/terms/current/:type` | Get current terms (public) | No |
| `GET` | `/api/v1/terms/check` | Check if user needs to accept terms/privacy | Yes |
| `POST` | `/api/v1/terms/accept` | Accept terms or privacy policy | Yes |
| `GET` | `/api/v1/terms/user/history` | Get user's acceptance history | Yes |
| `POST` | `/api/v1/terms` | Create new terms version | Owner |
| `GET` | `/api/v1/terms/history/:type` | Get version history | Owner |
| `GET` | `/api/v1/terms/:id` | Get specific version | Owner |
| `GET` | `/api/v1/terms/:id/full` | Get full terms content for editing | Owner |
| `PATCH` | `/api/v1/terms/:id/publish` | Publish terms version | Owner |

**Document Types:**
- `homeowner` - Terms for homeowners
- `cleaner` - Terms for cleaners
- `privacy_policy` - Privacy Policy (applies to all users)

---

## Database

### Models

#### User
```javascript
{
  id: INTEGER,
  username: STRING,
  email: STRING,
  passwordHash: STRING,
  type: STRING,             // 'cleaner', 'manager1', or null (homeowner)
  stripeConnectId: STRING,  // For cleaners with payouts
  hasPaymentMethod: BOOLEAN
}
```

#### CalendarSync
```javascript
{
  id: INTEGER,
  userId: INTEGER,
  homeId: INTEGER,
  platform: STRING,         // 'airbnb', 'vrbo', 'booking'
  icalUrl: STRING,
  isActive: BOOLEAN,
  autoCreateAppointments: BOOLEAN,
  daysAfterCheckout: INTEGER,
  lastSyncAt: DATE,
  lastSyncStatus: STRING,
  syncedEventUids: ARRAY
}
```

#### Payment
```javascript
{
  id: INTEGER,
  transactionId: STRING,
  appointmentId: INTEGER,
  userId: INTEGER,
  amountCents: INTEGER,
  transactionType: STRING,
  status: STRING,
  stripePaymentIntentId: STRING,
  description: STRING
}
```

#### Review
```javascript
{
  id: INTEGER,
  appointmentId: INTEGER,
  reviewerId: INTEGER,
  cleanerId: INTEGER,
  overallRating: DECIMAL,
  qualityRating: INTEGER,    // 1-5
  timelinessRating: INTEGER, // 1-5
  communicationRating: INTEGER, // 1-5
  comment: TEXT,
  status: STRING             // 'pending', 'published'
}
```

### Migrations

```bash
# Run all migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Undo all migrations
npx sequelize-cli db:migrate:undo:all

# Create new migration
npx sequelize-cli migration:generate --name add-new-feature
```

### Seeds

```bash
# Run all seeds
npx sequelize-cli db:seed:all

# Run specific seed
npx sequelize-cli db:seed --seed ownerSeeder.js

# Undo seeds
npx sequelize-cli db:seed:undo:all
```

#### Available Seeders

| Seeder | Description |
|--------|-------------|
| `ownerSeeder.js` | Creates the initial manager/owner account |
| `termsAndConditionsSeeder.js` | Seeds Terms & Conditions for homeowners and cleaners |
| `privacyPolicySeeder.js` | Seeds the Privacy Policy document |

**Note:** The Terms & Conditions and Privacy Policy seeders create version 1 of each document. Users will be prompted to accept these when they first log in. The owner can later edit and publish new versions through the admin interface.

---

## Services

### CalendarSyncService

Handles iCal parsing and appointment creation from vacation rental calendars:

```javascript
const { syncSingleCalendar, syncAllCalendars, startPeriodicSync } = require('./services/calendarSyncService');

// Sync a single calendar
const result = await syncSingleCalendar(calendarSyncId);
// Returns: { success: true, checkoutsFound: 5, appointmentsCreated: 3 }

// Sync all active calendars
const results = await syncAllCalendars();
// Returns: { totalSyncs: 10, successful: 9, failed: 1, totalAppointmentsCreated: 15 }

// Start periodic sync (runs every X minutes)
startPeriodicSync(60); // Every 60 minutes
```

### TaxDocumentService

Generates 1099-NEC forms for contractors:

```javascript
const TaxDocumentService = require('./services/TaxDocumentService');

// Validate W-9 data is complete
const isValid = await TaxDocumentService.validateTaxInfoComplete(userId);

// Generate 1099-NEC data
const form = await TaxDocumentService.generate1099NECData(userId, 2024);

// Get tax filing deadlines
const deadlines = TaxDocumentService.getTaxDeadlines(2024);

// Generate all 1099s for the year
const results = await TaxDocumentService.generateAll1099NECsForYear(2024);
```

### PlatformTaxService

Handles platform income tracking and tax reporting:

```javascript
const PlatformTaxService = require('./services/PlatformTaxService');

// Record platform earnings (10% fee on each payment)
await PlatformTaxService.recordPlatformEarnings(paymentId, {
  grossServiceAmount: 15000,  // $150.00
  platformFeeAmount: 1500,    // $15.00 (10%)
  netPlatformEarnings: 1500
});

// Get annual income summary
const summary = await PlatformTaxService.getAnnualIncomeSummary(2024);

// Calculate quarterly estimated taxes
const quarterly = await PlatformTaxService.calculateQuarterlyEstimatedTax(2024, 1);

// Generate Schedule C data
const scheduleC = await PlatformTaxService.generateScheduleCData(2024);

// Get comprehensive tax report
const report = await PlatformTaxService.getComprehensiveTaxReport(2024);
```

### PushNotificationClass

Sends push notifications via Expo to iOS and Android devices:

```javascript
const PushNotification = require('./services/sendNotifications/PushNotificationClass');

// Validate Expo push token
const isValid = PushNotification.isValidExpoPushToken(token);

// Send generic notification
await PushNotification.sendPushNotification(token, 'Title', 'Body message', { type: 'custom' });

// Specific notification types
await PushNotification.sendPushCancellation(token, userName, appointmentDate, address);
await PushNotification.sendPushConfirmation(token, userName, appointmentDate, address);
await PushNotification.sendPushEmployeeRequest(token, userName, cleanerName, rating, date);
await PushNotification.sendPushRequestApproved(token, cleanerName, homeownerName, date, address);
await PushNotification.sendPushRequestDenied(token, cleanerName, appointmentDate);
await PushNotification.sendPushNewMessage(token, userName, senderName, messagePreview);
await PushNotification.sendPushBroadcast(token, userName, broadcastTitle, content);
await PushNotification.sendPushSupplyReminder(token, cleanerName, appointmentDate, address);
await PushNotification.sendPushPaymentFailed(token, userName, appointmentDate, daysRemaining);
```

---

## Cron Jobs

The server runs scheduled tasks using `node-cron`:

| Schedule | Job | Description |
|----------|-----|-------------|
| `0 7 * * *` | Supply Reminder | Sends push notifications to cleaners with appointments today reminding them to bring toilet paper, paper towels, and trash bags |
| `0 0 * * *` | Payment Retry | Retries failed payments and sends reminders |
| `0 1 * * *` | Calendar Sync | Syncs all active iCal calendars |

### Supply Reminder Snooze

Cleaners can snooze supply reminders for 1 week to avoid notification fatigue:

```javascript
// Client-side: Snooze for 1 week
POST /api/v1/push-notifications/snooze-supply-reminder
// Response: { message: "Supply reminders snoozed for 1 week", snoozedUntil: "2025-01-02T..." }

// Check snooze status
GET /api/v1/push-notifications/supply-reminder-status
// Response: { isSnoozed: true, snoozedUntil: "2025-01-02T..." }
```

---

## WebSocket Events

The server uses Socket.io for real-time messaging:

```javascript
// Server-side
io.on('connection', (socket) => {
  // User joins a conversation
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  // User sends a message
  socket.on('send_message', async (data) => {
    const { conversationId, content, senderId } = data;
    const message = await Message.create({ ... });
    io.to(`conversation_${conversationId}`).emit('new_message', message);
  });

  // Typing indicator
  socket.on('typing', ({ conversationId, userId }) => {
    socket.to(`conversation_${conversationId}`).emit('user_typing', userId);
  });
});

// Client receives
socket.on('new_message', (message) => { ... });
socket.on('unread_count', (count) => { ... });
```

---

## Stripe Webhooks

Configure these webhooks in your Stripe dashboard:

### Payment Webhooks (`/api/v1/payments/webhook`)
- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `charge.refunded` - Refund processed

### Connect Webhooks (`/api/v1/stripe-connect/webhook`)
- `account.updated` - Connect account status changed
- `transfer.created` - Payout initiated
- `transfer.failed` - Payout failed

---

## Testing

```bash
# Run all tests (909 tests)
npm test

# Run specific test file
npm test -- __tests__/routes/tax.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch

# Run only integration tests
npm test -- __tests__/integration/
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Authentication | 15 | Login, registration, JWT validation |
| Appointments | 24 | CRUD, assignments, requests |
| Calendar Sync | 16 | iCal parsing, sync logic |
| Payments | 45 | Stripe intents, capture, refund |
| Stripe Connect | 44 | Account creation, payouts |
| Tax Documents | 45 | W-9, 1099-NEC, platform taxes |
| Reviews | 32 | Create, read, summaries |
| Messaging | 21 | Conversations, send, broadcast |
| Push Notifications | 35 | Token registration, preferences, snooze |
| Supply Reminder Cron | 20 | Daily reminders, snooze logic |
| Manager Features | 28 | Dashboard, applications |
| Email Notifications | 54 | HTML templates, all notification types |
| Pricing & Staffing | 10 | Dynamic pricing, staffing config |
| Terms & Conditions | 54 | Version management, acceptance tracking |
| Models | 27 | TermsAndConditions, UserTermsAcceptance |
| Integration | 27 | Full payment flows |
| **Total** | **964** | - |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm test` | Run Jest tests |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Run all database seeds |
| `npm run lint` | Run ESLint |

---

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `STRIPE_ERROR` | 400 | Payment processing error |
| `SYNC_ERROR` | 500 | Calendar sync failed |

---

## Security

### Authentication
- JWT tokens with configurable expiration
- Passwords hashed with bcrypt
- Sensitive data encrypted at rest (tax IDs)

### Authorization
- Role-based access control (homeowner, cleaner, manager)
- Middleware validates permissions per route

### Stripe
- Webhook signature verification
- PCI-compliant payment handling via Stripe Elements

---

## Contributing

See the main [README](../README.md) for contribution guidelines.

---

<div align="center">

**Part of the Kleanr Platform**

[Main Documentation](../README.md) | [Client Documentation](../client/README.md)

</div>
