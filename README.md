<div align="center">

# Kleanr

![Node](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Connect-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-907_Passing-brightgreen?style=for-the-badge)

**A comprehensive cleaning service management platform for short-term rental properties**

[Features](#-features) | [Quick Start](#-quick-start) | [Documentation](#-documentation) | [API Reference](#-api-reference)

---

<img src="https://via.placeholder.com/800x400/1a1a2e/eee?text=Kleanr+Platform" alt="Kleanr Platform" width="100%"/>

</div>

## Overview

Kleanr is a full-stack mobile platform that connects vacation rental hosts with professional cleaners. The platform handles scheduling, payments, real-time messaging, calendar sync with Airbnb/VRBO, and comprehensive tax reporting for all parties.

## Features

<table>
<tr>
<td width="33%" valign="top">

### Homeowners
- Schedule and manage cleaning appointments
- Sync calendars with Airbnb, VRBO, Booking.com
- Auto-create cleanings after guest checkouts
- Secure payments via Stripe
- Real-time messaging with cleaners
- Request specific cleaners for jobs
- View payment history for tax purposes

</td>
<td width="33%" valign="top">

### Cleaners
- View assigned appointments and schedules
- Photo documentation (before/after)
- Digital cleaning checklists
- Track earnings and payment history
- Accept or decline job requests
- Stripe Connect for instant payouts
- Access 1099-NEC tax documents

</td>
<td width="33%" valign="top">

### Managers
- Assign cleaners to appointments
- Monitor all platform activity
- Send broadcast announcements
- Process employee applications
- Platform tax reporting (Schedule C)
- Quarterly estimated tax calculations
- Service area management

</td>
</tr>
</table>

### Core Platform Features

| Feature | Description |
|---------|-------------|
| **Calendar Sync** | Automatic iCal sync with Airbnb, VRBO, Booking.com. Auto-create cleaning appointments based on guest checkouts. |
| **Real-time Messaging** | WebSocket-powered chat between homeowners, cleaners, and support. Includes broadcast announcements and email notifications. |
| **Payment Processing** | Stripe integration with Apple Pay/Google Pay. Platform fee collection and instant cleaner payouts via Stripe Connect. |
| **Tax Management** | Automated 1099-NEC generation for cleaners, platform income tracking, Schedule C data, and quarterly tax estimates. |
| **Photo Documentation** | Before/after photo capture for quality assurance. Room-by-room photo organization with notes. |
| **Review System** | Multi-aspect reviews for cleaners covering quality, timeliness, and communication. |

---

## Tech Stack

<table>
<tr>
<td width="50%" valign="top">

### Frontend (Mobile App)
```
React Native + Expo SDK 52
├── react-router-native     # Navigation
├── @stripe/stripe-react-native  # Payments
├── socket.io-client        # Real-time messaging
├── react-native-calendars  # Calendar UI
└── react-native-paper      # UI components
```

</td>
<td width="50%" valign="top">

### Backend (API Server)
```
Node.js + Express.js
├── PostgreSQL + Sequelize  # Database & ORM
├── Socket.io               # WebSocket server
├── Passport.js + JWT       # Authentication
├── Stripe API              # Payment processing
├── Nodemailer              # Email notifications
└── node-ical               # Calendar parsing
```

</td>
</tr>
</table>

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18.x or higher
- [PostgreSQL](https://www.postgresql.org/) v14 or higher
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Stripe Account](https://stripe.com/) with Connect enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/kleanr.git
cd kleanr

# Setup Server
cd server
npm install
createdb cleaning_company_development
npx sequelize-cli db:migrate
npx sequelize-cli db:seed --seed managerSeeder.js

# Setup Client
cd ../client
npm install
```

### Environment Configuration

Create `server/.env`:

```bash
# Authentication
SESSION_SECRET=your_secret_key_here

# Database
DATABASE_URL=postgresql://localhost/cleaning_company_development

# Stripe (Required)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# Email Notifications (Optional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@kleanr.com

# Company Info for Tax Documents
COMPANY_NAME=Your Company Name
COMPANY_EIN=XX-XXXXXXX
COMPANY_ENTITY_TYPE=LLC
COMPANY_ADDRESS_LINE1=123 Main Street
COMPANY_CITY=Your City
COMPANY_STATE=ST
COMPANY_ZIP=12345

# External APIs (Optional)
GOOGLE_MAPS_API_KEY=your_key
```

### Running the Application

```bash
# Terminal 1 - Start the API server
cd server
npm start
# Server runs on http://localhost:3000

# Terminal 2 - Start the mobile app
cd client
npm start
# Press: w (web) | i (iOS) | a (Android)
```

---

## Project Structure

```
kleanr/
├── client/                         # React Native Expo App
│   ├── src/
│   │   ├── components/
│   │   │   ├── appointments/       # Booking & scheduling UI
│   │   │   ├── calendarSync/       # iCal sync management
│   │   │   ├── messaging/          # Real-time chat
│   │   │   ├── payments/           # Stripe payment UI
│   │   │   ├── reviews/            # Review system
│   │   │   └── tax/                # Tax document views
│   │   └── services/
│   │       ├── fetchRequests/      # API service classes
│   │       ├── AuthContext.js      # Authentication state
│   │       └── SocketContext.js    # WebSocket provider
│   ├── __tests__/                  # 340 client tests
│   └── package.json
│
├── server/                         # Express.js API Server
│   ├── routes/api/v1/
│   │   ├── appointmentsRouter.js   # Scheduling endpoints
│   │   ├── calendarSyncRouter.js   # iCal sync endpoints
│   │   ├── paymentRouter.js        # Stripe payments
│   │   ├── stripeConnectRouter.js  # Cleaner payouts
│   │   ├── messageRouter.js        # Messaging endpoints
│   │   ├── taxRouter.js            # Tax documents
│   │   └── reviewsRouter.js        # Review system
│   ├── services/
│   │   ├── calendarSyncService.js  # iCal parsing & sync
│   │   ├── TaxDocumentService.js   # 1099-NEC generation
│   │   └── PlatformTaxService.js   # Platform tax reports
│   ├── models/                     # Sequelize models
│   ├── migrations/                 # Database migrations
│   ├── __tests__/                  # 568 server tests
│   └── package.json
│
└── README.md
```

---

## Testing

```bash
# Run all server tests (568 tests)
cd server && npm test

# Run all client tests (340 tests)
cd client && npm test

# Run with coverage
npm test -- --coverage
```

### Test Coverage

| Area | Server | Client |
|------|--------|--------|
| Authentication | 15 tests | - |
| Appointments | 24 tests | - |
| Payments & Stripe | 89 tests | 12 tests |
| Calendar Sync | 16 tests | 73 tests |
| Tax Documents | 45 tests | 42 tests |
| Messaging | 21 tests | - |
| Reviews | 32 tests | 54 tests |
| Integration | 27 tests | - |

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/user-sessions/login` | User login |
| `POST` | `/api/v1/users` | User registration |
| `GET` | `/api/v1/user-sessions/current` | Get current user |

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/appointments/:homeId` | Get home appointments |
| `POST` | `/api/v1/appointments` | Create appointment |
| `DELETE` | `/api/v1/appointments/:id` | Cancel appointment |
| `PATCH` | `/api/v1/appointments/request-employee` | Request specific cleaner |

### Calendar Sync

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/calendar-sync/home/:homeId` | Get syncs for home |
| `POST` | `/api/v1/calendar-sync` | Create new sync |
| `POST` | `/api/v1/calendar-sync/:id/sync` | Trigger manual sync |
| `DELETE` | `/api/v1/calendar-sync/:id` | Remove sync |

### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/payments/create-intent` | Create payment intent |
| `POST` | `/api/v1/payments/capture` | Capture payment |
| `GET` | `/api/v1/payments/history/:userId` | Payment history |

### Stripe Connect

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/stripe-connect/create-account` | Create Connect account |
| `POST` | `/api/v1/stripe-connect/process-payout` | Process cleaner payout |
| `GET` | `/api/v1/stripe-connect/payouts/:userId` | Payout history |

### Tax Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/tax/submit-w9` | Submit W-9 data |
| `GET` | `/api/v1/tax/contractor/1099-nec/:year` | Get 1099-NEC |
| `GET` | `/api/v1/tax/platform/comprehensive-report/:year` | Platform tax report |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Server README](./server/README.md) | API documentation, database schema, services |
| [Client README](./client/README.md) | Component documentation, state management |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

<div align="center">

**Built with care for the vacation rental industry**

</div>
