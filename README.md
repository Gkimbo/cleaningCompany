<div align="center">

# Kleanr

![Node](https://img.shields.io/badge/node-v18.x-green)
![React Native](https://img.shields.io/badge/React%20Native-Expo-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-316192)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635bff)
![Tests](https://img.shields.io/badge/tests-365%20passing-brightgreen)

**A comprehensive cleaning service management platform for short-term rental properties**

[Features](#features) | [Tech Stack](#tech-stack) | [Installation](#installation) | [API Docs](#api-endpoints) | [Contributing](#contributing)

</div>

---

## Overview

Kleanr is a full-stack mobile application that enables property hosts to schedule cleanings, manage turnovers, communicate with cleaners, and process payments seamlessly. The platform supports three user types: homeowners, cleaners, and managers.

## Features

<table>
<tr>
<td width="33%" valign="top">

### Homeowners
- Schedule and manage cleaning appointments
- View and manage multiple properties
- Secure payment processing via Stripe
- Real-time messaging with cleaners
- View payment history and receipts
- Request specific cleaners
- **Tax documents and payment history**

</td>
<td width="33%" valign="top">

### Cleaners
- View assigned appointments and schedules
- Track earnings and payment history
- Accept or decline cleaning requests
- Real-time messaging with homeowners
- Calendar view of upcoming jobs
- Stripe Connect for direct payouts
- **1099-NEC tax form access**

</td>
<td width="33%" valign="top">

### Managers
- Assign cleaners to appointments
- Send broadcast announcements
- View all appointments and scheduling
- Handle support requests from users
- Manage employee information
- **Platform tax reporting (Schedule C)**
- **Quarterly estimated tax calculations**

</td>
</tr>
</table>

### Core Systems

| System | Description |
|--------|-------------|
| **Messaging** | Real-time WebSocket messaging (Socket.io), appointment-based conversations, broadcast announcements, support chat, email notifications |
| **Payments** | Stripe integration, Apple Pay/Google Pay support, payment history, refund processing, Stripe Connect for cleaner payouts |
| **Tax Management** | 1099-NEC generation for contractors, platform income tracking, quarterly estimated taxes, Schedule C data, payment history reports |

## Tech Stack

<table>
<tr>
<td width="50%" valign="top">

### Client
| Technology | Purpose |
|------------|---------|
| React Native | Cross-platform mobile framework |
| Expo | Development platform |
| React Router Native | Navigation |
| Stripe React Native SDK | Payment UI |
| Socket.io Client | Real-time messaging |

</td>
<td width="50%" valign="top">

### Server
| Technology | Purpose |
|------------|---------|
| Node.js / Express | API server |
| PostgreSQL | Database |
| Sequelize ORM | Database management |
| Socket.io | WebSocket server |
| Passport.js / JWT | Authentication |
| Stripe API | Payment processing |
| Nodemailer | Email notifications |

</td>
</tr>
</table>

## Prerequisites

- [Node.js](https://nodejs.org/) v18.x or higher
- [PostgreSQL](https://www.postgresql.org/download/) v14 or higher
- [Git](https://git-scm.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Stripe account with Connect enabled

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/kleanr.git
cd kleanr

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Create and setup database
createdb cleaning_company_development
cd ../server
npx sequelize-cli db:migrate
npx sequelize-cli db:seed --seed managerSeeder.js
```

## Environment Variables

Create a `.env` file in the `server` directory:

```bash
# Authentication
SESSION_SECRET=your_session_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...

# Email (optional)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Company Info (for tax documents)
COMPANY_NAME=Your Company Name
COMPANY_EIN=XX-XXXXXXX
COMPANY_ENTITY_TYPE=LLC

# External APIs (optional)
GOOGLE_MAPS=your_google_maps_key
API_NINJA_API_KEY=your_api_ninja_key
```

## Running the App

```bash
# Terminal 1 - Start the server
cd server
npm start
# Server runs on http://localhost:3000

# Terminal 2 - Start the client
cd client
npm start
# Press: w (web) | i (iOS) | a (Android)
```

## Testing

```bash
# Server tests (273 tests)
cd server
npm test

# Client tests (92 tests)
cd client
npm test
```

**Test Coverage:**
- Authentication & authorization
- Payment flows & Stripe integration
- Messaging system
- Tax document generation
- Platform earnings tracking

## Project Structure

```
kleanr/
├── client/                      # React Native Expo app
│   ├── app/
│   │   ├── components/
│   │   │   ├── messaging/       # Chat components
│   │   │   ├── payments/        # Payment UI
│   │   │   ├── tax/             # Tax forms section
│   │   │   └── ...
│   │   └── services/
│   │       ├── fetchRequests/   # API services
│   │       └── SocketContext.js # WebSocket provider
│   └── __tests__/               # Client tests
│
├── server/                      # Express.js API
│   ├── __tests__/               # Server tests
│   ├── migrations/              # Database migrations
│   ├── models/                  # Sequelize models
│   ├── routes/api/v1/           # API routes
│   ├── services/                # Business logic
│   │   ├── TaxDocumentService.js
│   │   └── PlatformTaxService.js
│   └── app.js
│
└── README.md
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/user-sessions/login` | User login |
| POST | `/api/v1/users` | User registration |
| GET | `/api/v1/user-sessions/current` | Get current user |

### Appointments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/appointments/:homeId` | Get appointments for a home |
| POST | `/api/v1/appointments` | Create appointment |
| DELETE | `/api/v1/appointments/:id` | Cancel appointment |
| PATCH | `/api/v1/appointments/approve-request` | Approve cleaner request |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/payments/config` | Get Stripe config |
| POST | `/api/v1/payments/create-intent` | Create payment intent |
| POST | `/api/v1/payments/capture` | Capture payment |
| POST | `/api/v1/payments/refund` | Process refund |

### Stripe Connect (Cleaner Payouts)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/stripe-connect/create-account` | Create Connect account |
| POST | `/api/v1/stripe-connect/onboarding-link` | Get onboarding URL |
| POST | `/api/v1/stripe-connect/process-payout` | Process cleaner payout |
| GET | `/api/v1/stripe-connect/payouts/:userId` | Get payout history |

### Tax Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tax/info` | Get W-9 tax info |
| POST | `/api/v1/tax/info` | Submit W-9 data |
| GET | `/api/v1/tax/contractor/tax-summary/:year` | Cleaner tax summary |
| GET | `/api/v1/tax/contractor/1099-nec/:year` | Get 1099-NEC data |
| GET | `/api/v1/tax/payment-history/:year` | Homeowner payment history |
| GET | `/api/v1/tax/platform/comprehensive-report/:year` | Platform tax report |
| GET | `/api/v1/tax/platform/schedule-c/:year` | Schedule C data |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/messages/conversations` | Get user conversations |
| GET | `/api/v1/messages/conversation/:id` | Get messages |
| POST | `/api/v1/messages/send` | Send message |
| POST | `/api/v1/messages/conversation/support` | Create support chat |
| POST | `/api/v1/messages/broadcast` | Send broadcast (manager) |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

This project is proprietary software.
