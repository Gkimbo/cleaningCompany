<div align="center">

# Kleanr

![Node](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Connect-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-2809_Passing-brightgreen?style=for-the-badge)

**A comprehensive cleaning service marketplace platform connecting homeowners with professional cleaners and cleaning businesses**

[Features](#-features) | [Quick Start](#-quick-start) | [Documentation](#-documentation) | [API Reference](#-api-reference)

---

</div>

## Overview

Kleanr is a full-stack mobile platform that connects vacation rental hosts with professional cleaners and cleaning businesses. The platform supports multiple user types including homeowners, independent cleaners, business owners managing their own clients, HR staff for dispute resolution, and platform administrators.

**Key Capabilities:**
- Multi-tenant cleaning service marketplace
- Business owner onboarding with direct client management
- Real-time messaging with suspicious content detection
- Dynamic pricing with incentive and referral programs
- Stripe Connect for instant cleaner payouts
- iCal calendar sync with Airbnb, VRBO, Booking.com
- Comprehensive tax reporting (1099-NEC, platform reports)
- HR dispute management and content moderation
- Before/after job photo documentation

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### Homeowners

- **Multi-Home Management**: Add multiple properties with detailed configurations
- **Calendar Sync**: Auto-sync with Airbnb, VRBO, Booking.com
- **Auto-Booking**: Automatic appointments from guest checkouts
- **Flexible Scheduling**: One-time or recurring cleanings
- **Time Windows**: Choose preferred cleaning times
- **Preferred Cleaners**: Mark favorites for priority assignment
- **Secure Payments**: Stripe with prepayment options
- **Real-time Messaging**: Chat with cleaners and support
- **Bidirectional Reviews**: Rate and be rated by cleaners
- **Bill Management**: View dues, pay, access history

</td>
<td width="50%" valign="top">

### Cleaners

- **Job Application**: Comprehensive onboarding process
- **View Available Jobs**: Browse and request assignments
- **Photo Documentation**: Before/after photos (required)
- **Digital Checklists**: Room-by-room cleaning guides
- **Earnings Dashboard**: Track daily/weekly/monthly income
- **Stripe Connect**: Instant payouts to bank account
- **Tax Documents**: W-9 submission, 1099-NEC access
- **Review Management**: View ratings and feedback
- **Supply Reminders**: Notifications with snooze option
- **Recurring Clients**: Build regular client relationships

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Business Owners

- **Upgrade Path**: Cleaners can become business owners
- **Client Invitations**: Invite clients via email
- **Client Management**: View all direct clients
- **Book For Clients**: Create appointments on their behalf
- **Custom Pricing**: Set per-home pricing
- **Platform Price Alignment**: One-click platform rate matching
- **Direct Revenue**: No platform fee on own clients
- **Client History**: View appointment and payment history
- **Recurring Schedules**: Set up weekly/biweekly/monthly

</td>
<td width="50%" valign="top">

### HR Staff

- **Dispute Management**: Review home size adjustment claims
- **Photo Evidence Review**: Examine cleaner-submitted photos
- **Suspicious Activity**: Review flagged messages
- **User Warnings**: Issue warnings to violators
- **Account Freezing**: Freeze repeat offenders
- **Support Conversations**: Handle customer inquiries
- **Internal Messaging**: Communicate with owner/staff
- **Quick Stats Dashboard**: Overview of pending items

</td>
</tr>
<tr>
<td colspan="2" valign="top">

### Platform Owner/Admin

- **Financial Dashboard**: Revenue metrics (today, week, month, year, all-time)
- **Platform Withdrawals**: Transfer earnings via Stripe
- **Employee Management**: Create/edit HR staff and cleaners
- **Pricing Configuration**: Base prices, per-bed/bath fees, time windows, cancellation fees
- **Incentive Programs**: Configure cleaner fee reductions, homeowner discounts
- **Referral Programs**: Create tiered referral rewards
- **Checklist Management**: Create and publish cleaning checklists with versioning
- **Terms & Conditions**: Manage legal documents with acceptance tracking
- **Application Review**: Approve/reject cleaner applications
- **Broadcast Messaging**: Send announcements to all users
- **Tax Reporting**: Platform reports, contractor 1099s
- **Service Area Management**: Configure geographic restrictions

</td>
</tr>
</table>

### Core Platform Features

| Feature | Description |
|---------|-------------|
| **Calendar Sync** | Automatic iCal sync with Airbnb, VRBO, Booking.com. Auto-create cleaning appointments based on guest checkouts with configurable offset days. |
| **Real-time Messaging** | Socket.io-powered chat with message reactions, read receipts, typing indicators. Suspicious content auto-detection for phone numbers/emails. |
| **Payment Processing** | Stripe integration with saved payment methods. Platform fee collection and instant cleaner payouts via Stripe Connect. Prepayment support. |
| **Tax Management** | Automated W-9 collection, 1099-NEC generation for cleaners, platform income tracking, Schedule C data, quarterly tax estimates, monthly breakdowns. |
| **Photo Documentation** | Before/after photo capture required for job completion. Room-by-room organization with notes. Access control for cleaners and homeowners. |
| **Review System** | Multi-aspect bidirectional reviews. Both parties must review before either can see results. Option to mark cleaner as preferred. |
| **Home Size Disputes** | Cleaners can report incorrect bed/bath counts with photo evidence. HR reviews and decides with false claim tracking. |
| **Incentive Programs** | Configurable fee reductions for cleaners and discounts for homeowners based on activity and eligibility requirements. |
| **Referral Programs** | Unique referral codes, tiered rewards for homeowner/cleaner referrals, minimum requirements, referrer and referee bonuses. |
| **Terms & Conditions** | Version-controlled legal documents with PDF/text support, user acceptance tracking, and compliance snapshots. |
| **Push Notifications** | Expo push notifications with preferences. Supply reminder snooze. Multi-channel delivery (push, email, in-app). |
| **Account Security** | JWT authentication, encrypted PII (AES-256), account freezing, warning system, password strength validation. |

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
├── expo-notifications      # Push notifications
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
├── node-ical               # Calendar parsing
└── crypto (AES-256)        # PII encryption
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
npx sequelize-cli db:seed --seed ownerSeeder.js
npx sequelize-cli db:seed --seed termsAndConditionsSeeder.js
npx sequelize-cli db:seed --seed privacyPolicySeeder.js

# Setup Client
cd ../client
npm install
```

### Environment Configuration

Create `server/.env`:

```bash
# ===================
# Core Configuration
# ===================
NODE_ENV=development
PORT=3000
SESSION_SECRET=your_secret_key_here

# ===================
# Database
# ===================
DATABASE_URL=postgresql://localhost/cleaning_company_development

# ===================
# Encryption (Required for PII)
# ===================
ENCRYPTION_KEY=your_32_byte_encryption_key_here

# ===================
# Stripe (Required)
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
COMPANY_NAME=Your Company Name
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
GOOGLE_MAPS_API_KEY=your_key
API_NINJA_API_KEY=your_key
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
├── client/                          # React Native Expo App
│   ├── src/
│   │   ├── components/
│   │   │   ├── appointments/        # Booking & scheduling UI
│   │   │   ├── calendarSync/        # iCal sync management
│   │   │   ├── cleaner/             # Business owner/cleaner features
│   │   │   ├── client/              # Homeowner dashboard & features
│   │   │   ├── hr/                  # HR staff features
│   │   │   ├── messaging/           # Real-time chat
│   │   │   ├── owner/               # Admin dashboard
│   │   │   ├── payments/            # Stripe payment UI
│   │   │   ├── reviews/             # Review system
│   │   │   ├── tax/                 # Tax document views
│   │   │   └── terms/               # Terms & Conditions UI
│   │   ├── context/                 # React contexts
│   │   │   ├── AuthContext.js       # Authentication state
│   │   │   ├── SocketContext.js     # WebSocket provider
│   │   │   └── PricingContext.js    # Pricing state
│   │   └── services/
│   │       └── fetchRequests/       # API service classes
│   └── package.json
│
├── server/                          # Express.js API Server
│   ├── routes/api/v1/
│   │   ├── appointmentsRouter.js    # Scheduling endpoints
│   │   ├── calendarSyncRouter.js    # iCal sync endpoints
│   │   ├── cleanerClientsRouter.js  # Business owner client management
│   │   ├── homeSizeAdjustmentRouter.js  # Dispute system
│   │   ├── hrDashboardRouter.js     # HR features
│   │   ├── incentivesRouter.js      # Incentive programs
│   │   ├── jobPhotosRouter.js       # Before/after photos
│   │   ├── messageRouter.js         # Messaging endpoints
│   │   ├── ownerDashboardRouter.js  # Admin features
│   │   ├── paymentRouter.js         # Stripe payments
│   │   ├── pricingRouter.js         # Dynamic pricing
│   │   ├── referralsRouter.js       # Referral programs
│   │   ├── stripeConnectRouter.js   # Cleaner payouts
│   │   ├── suspiciousActivityRouter.js  # Content moderation
│   │   ├── taxRouter.js             # Tax documents
│   │   └── termsRouter.js           # Terms & Conditions
│   ├── services/
│   │   ├── CalculatePrice.js        # Dynamic pricing logic
│   │   ├── calendarSyncService.js   # iCal parsing & sync
│   │   ├── EncryptionService.js     # PII encryption (AES-256)
│   │   ├── IncentiveService.js      # Incentive calculations
│   │   ├── InvitationService.js     # Client invitations
│   │   ├── ReferralService.js       # Referral code management
│   │   ├── SuspiciousContentDetector.js  # Content moderation
│   │   ├── TaxDocumentService.js    # 1099-NEC generation
│   │   └── sendNotifications/       # Email & push services
│   ├── models/                      # Sequelize models (30+)
│   ├── migrations/                  # Database migrations
│   ├── __tests__/                   # 2809 server tests
│   └── package.json
│
└── README.md
```

---

## User Types & Roles

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Homeowner** | Property owners needing cleaning services | Book appointments, manage homes, pay bills, review cleaners |
| **Cleaner** | Independent cleaning professionals | Apply for work, accept jobs, upload photos, earn money |
| **Business Owner** | Cleaner with own client base | All cleaner features + invite/manage own clients directly |
| **HR Staff** | Support and moderation team | Handle disputes, review reports, manage support, freeze accounts |
| **Owner** | Platform administrator | Full access: financials, employees, pricing, settings, reports |

---

## Testing

```bash
# Run all server tests (2809 tests)
cd server && npm test

# Run specific test file
npm test -- __tests__/routes/messages.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Coverage

| Category | Tests | Description |
|----------|-------|-------------|
| Authentication | 45 | Login, registration, JWT, password reset |
| Appointments | 89 | CRUD, assignments, requests, recurring |
| Calendar Sync | 48 | iCal parsing, sync logic, platforms |
| Payments | 112 | Stripe intents, capture, refund, billing |
| Stripe Connect | 78 | Account creation, payouts |
| Cleaner Clients | 156 | Business owner client management |
| Pricing | 67 | Dynamic pricing, configuration |
| Incentives | 54 | Qualification, discounts |
| Referrals | 48 | Codes, rewards, tracking |
| Tax Documents | 89 | W-9, 1099-NEC, platform taxes |
| Reviews | 67 | Create, read, bidirectional |
| Messaging | 234 | Conversations, reactions, suspicious content |
| Job Photos | 67 | Upload, access control, completion |
| Home Size Disputes | 45 | Filing, evidence, resolution |
| HR Dashboard | 78 | Disputes, reports, support |
| Owner Dashboard | 89 | Financial, analytics, settings |
| Push Notifications | 56 | Token registration, preferences |
| Terms & Conditions | 78 | Version management, acceptance |
| Checklist | 45 | Editor, publishing, versions |
| Applications | 56 | Submission, review, approval |
| Services | 156 | All service unit tests |
| Integration | 67 | Full payment flows, e2e |
| **Total** | **2809** | - |

---

## API Reference

See [Server README](./server/README.md) for complete API documentation. Key endpoint groups:

### Core Endpoints

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Authentication | 7 | Login, register, password reset, current user |
| Users | 8 | Profile management, employee CRUD |
| Homes | 6 | Property CRUD, setup completion |
| Appointments | 10 | Booking, assignments, completion |
| Cleaner Clients | 10 | Business owner client management |
| Recurring Schedules | 8 | Recurring appointment setup |
| Calendar Sync | 6 | iCal integration |

### Payments & Billing

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Payments | 12 | Stripe intents, capture, refund, methods |
| Billing | 3 | Bill summary, history, sync |
| Stripe Connect | 7 | Cleaner account setup, payouts |
| Pricing | 4 | Configuration, calculation |

### Communication

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Messaging | 18 | Conversations, send, reactions, reports |
| Notifications | 6 | In-app notification management |
| Push Notifications | 5 | Token registration, preferences |

### Moderation & Support

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Suspicious Activity | 6 | Reports, warnings, account freeze |
| HR Dashboard | 5 | Disputes, stats, support |
| Home Size Adjustment | 6 | Dispute filing and resolution |

### Programs & Compliance

| Category | Endpoints | Description |
|----------|-----------|-------------|
| Incentives | 5 | Configuration, eligibility |
| Referrals | 6 | Codes, rewards, validation |
| Reviews | 6 | Submit, view, summaries |
| Tax Documents | 8 | W-9, 1099-NEC, platform reports |
| Terms & Conditions | 6 | Version management, acceptance |
| Checklist | 7 | Editor, publishing, versions |
| Applications | 8 | Submission, review, hire |

---

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| `0 7 * * *` | Supply Reminder | Reminds cleaners to bring supplies |
| `0 0 * * *` | Payment Retry | Retries failed payments |
| `0 1 * * *` | Calendar Sync | Syncs all active iCal calendars |
| `0 2 * * *` | Booking Expiration | Expires pending bookings (48-hour window) |
| `0 3 * * 0` | Recurring Generation | Creates appointments from schedules |

---

## WebSocket Events

Real-time communication via Socket.io:

```javascript
// Server → Client
'new_message'              // New message received
'unread_count'             // Updated unread count
'user_typing'              // User is typing
'message_reaction'         // Reaction added/removed
'message_deleted'          // Message was deleted
'participant_added'        // New conversation participant
'conversation_updated'     // Conversation title changed

// Client → Server
'join_conversation'        // Join a conversation room
'send_message'             // Send a message
'typing'                   // Start typing indicator
'add_reaction'             // Add message reaction
'mark_read'                // Mark messages as read
```

---

## Security

- **Authentication**: JWT tokens with 24-hour expiration, bcrypt password hashing
- **Authorization**: Role-based access control with middleware validation
- **Encryption**: AES-256-CBC for PII (names, emails, tax IDs)
- **Payments**: PCI-compliant via Stripe Elements, webhook signature verification
- **Content Moderation**: Automatic suspicious content detection, user reporting
- **Account Protection**: Freezing, warning system, violation tracking

---

## Documentation

| Document | Description |
|----------|-------------|
| [Server README](./server/README.md) | Complete API reference, database models, services, testing |
| [Client README](./client/README.md) | Component documentation, state management, UI patterns |

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

**Built with care for the vacation rental and cleaning service industry**

</div>
