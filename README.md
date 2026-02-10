<div align="center">

# Kleanr

![Node](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Connect-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-10599_Passing-brightgreen?style=for-the-badge)

**A comprehensive cleaning service marketplace platform connecting homeowners with professional cleaners and cleaning businesses**

[Features](#-features) | [Quick Start](#-quick-start) | [Documentation](#-documentation) | [API Reference](#-api-reference)

---

</div>

## Overview

Kleanr is a full-stack mobile platform that connects vacation rental hosts with professional cleaners and cleaning businesses. The platform supports multiple user types including homeowners, independent cleaners, business owners with their own employees, HR staff for dispute resolution, and platform administrators.

**Key Capabilities:**
- Multi-tenant cleaning service marketplace with offline support
- Business owner onboarding with employee management and payroll
- **Business client portal** for companies to manage their cleaning services
- Multi-cleaner job support for large homes with room assignments
- Real-time messaging with suspicious content detection
- Dynamic pricing with incentive and referral programs
- Last-minute booking with urgent cleaner notifications
- Large business volume-based fee tiers
- Preferred cleaner tier system (Bronze/Silver/Gold/Platinum) with bonuses
- Stripe Connect for instant cleaner payouts
- iCal calendar sync with Airbnb, VRBO, Booking.com
- Comprehensive tax reporting (1099-NEC, W-9 collection, platform reports)
- **Unified Conflict Resolution Center** for appeals and disputes
- **Cancellation Appeals System** with 72-hour appeal window and HR review
- **Job Ledger** with double-entry accounting and Stripe reconciliation
- **Employee timesheets** with hours tracking and payroll integration
- **Transit time calculation** between jobs for scheduling optimization
- HR dispute management and content moderation
- Before/after job photo documentation with offline capture
- Guest-not-left tracking with GPS verification
- **Preview as Role** feature for admin testing

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### Homeowners

- **Multi-Home Management**: Add multiple properties with detailed configurations
- **Calendar Sync**: Auto-sync with Airbnb, VRBO, Booking.com via iCal
- **Auto-Booking**: Automatic appointments from guest checkouts
- **Flexible Scheduling**: One-time or recurring cleanings (weekly/biweekly/monthly)
- **Time Windows**: Choose preferred cleaning times with surcharges
- **Last-Minute Booking**: Book within 48 hours with additional fee for urgent cleanings
- **Preferred Cleaners**: Mark favorites for priority assignment with tier tracking
- **Multi-Cleaner Jobs**: Large homes automatically split across multiple cleaners
- **Secure Payments**: Stripe with prepayment options and saved cards
- **Real-time Messaging**: Chat with cleaners and support
- **Bidirectional Reviews**: Multi-aspect ratings for cleaners
- **Bill Management**: View dues, pay, access history
- **Home Size Disputes**: Respond to cleaner-reported size adjustments
- **Linen Services**: Add-on pricing for sheets, towels, face cloths

</td>
<td width="50%" valign="top">

### Cleaners

- **Job Application**: Comprehensive onboarding with background check consent
- **View Available Jobs**: Browse and request assignments with filters
- **Photo Documentation**: Before/after photos (required) with offline capture
- **Digital Checklists**: Room-by-room cleaning guides (73 tasks)
- **Earnings Dashboard**: Track daily/weekly/monthly income
- **Stripe Connect**: Instant payouts to bank account
- **Tax Documents**: W-9 submission, 1099-NEC access
- **Review Management**: View ratings and multi-aspect feedback
- **Supply Reminders**: Notifications with snooze option
- **Recurring Clients**: Build regular client relationships
- **Preferred Tier System**: Bronze/Silver/Gold/Platinum with bonuses (0-7%)
- **Guest-Not-Left Reporting**: GPS-verified escalation workflow
- **Home Size Adjustments**: Report incorrect bed/bath counts with photos
- **Service Area Config**: Set location and radius for last-minute job notifications
- **Last-Minute Job Alerts**: Receive urgent notifications for nearby last-minute bookings

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Business Owners

- **Upgrade Path**: Cleaners can become business owners
- **Employee Management**: Invite and manage team members
- **Employee Payroll**: Hourly or flat-rate pay with automatic calculations
- **Timesheet Management**: Track employee hours and approve timesheets
- **Client Invitations**: Invite clients via email with token expiration
- **Business Client Portal**: Dedicated portal for business clients
- **Client Management**: View all direct clients
- **Book For Clients**: Create appointments on their behalf
- **Custom Pricing**: Set per-home pricing
- **Platform Price Alignment**: One-click platform rate matching
- **Direct Revenue**: No platform fee on own clients
- **Client History**: View appointment and payment history
- **Recurring Schedules**: Set up weekly/biweekly/monthly
- **Job Assignment**: Assign jobs to specific employees with transit time
- **Team Calendar**: View all employee schedules
- **Team Messaging**: Communicate with employees
- **Financial Dashboard**: Revenue, payroll, and analytics

</td>
<td width="50%" valign="top">

### Business Employees

- **Invitation-Based Onboarding**: Accept invites with secure tokens
- **Personal Dashboard**: View assigned jobs and earnings
- **Job List & Calendar**: Track upcoming and past assignments
- **Availability Settings**: Set daily availability windows
- **Job Type Restrictions**: Owner can limit job types
- **Max Daily Jobs**: Configurable limits per employee
- **Payment Methods**: Stripe Connect or direct from owner
- **Self-Assignment**: Business owners can assign themselves
- **Marketplace Pickup**: Option to pick up open jobs
- **Coworker Messaging**: Communicate with team members
- **Earnings Tracking**: View pay history and totals
- **Timesheet Submission**: Log hours worked per job
- **Photo & Checklist**: Same job completion workflow as cleaners

</td>
</tr>
<tr>
<td width="50%" valign="top">

### HR Staff

- **Conflict Resolution Center**: Unified queue for all disputes and appeals
- **Cancellation Appeals**: Review and decide on user appeals within 48-hour SLA
- **Dispute Management**: Review home size adjustment claims
- **Photo Evidence Review**: Examine cleaner-submitted photos with comparison tools
- **Financial Breakdown**: View detailed charges, refunds, and payouts per case
- **Audit Trail**: Complete event history for every case
- **Suspicious Activity**: Review flagged messages and reports
- **User Warnings**: Issue warnings to policy violators
- **Account Freezing**: Freeze repeat offenders
- **Support Conversations**: Handle customer inquiries
- **Internal Messaging**: Communicate with owner/staff
- **Quick Stats Dashboard**: Overview of pending items
- **Application Review**: Process cleaner applications

</td>
<td width="50%" valign="top">

### Platform Owner/Admin

- **Financial Dashboard**: Revenue metrics (today, week, month, year, all-time)
- **Platform Withdrawals**: Transfer earnings via Stripe
- **Internal Analytics**: Track flow abandonment, job duration, offline usage, disputes, pay overrides
- **Preview as Role**: Test the app as any user type (Cleaner, Homeowner, Business Owner, Employee)
- **Employee Management**: Create/edit HR staff and cleaners
- **Pricing Configuration**: Base prices, per-bed/bath fees, time windows, cancellation fees, last-minute fees
- **Large Business Fees**: Configure volume thresholds and reduced fees for high-volume business owners
- **Incentive Programs**: Configure cleaner fee reductions, homeowner discounts
- **Referral Programs**: Create tiered referral rewards (4 program types)
- **Preferred Perks Config**: Set tier thresholds, bonuses, payout speeds
- **Checklist Management**: Create and publish cleaning checklists with versioning
- **Terms & Conditions**: Manage legal documents with acceptance tracking
- **Application Review**: Approve/reject cleaner applications with hire flow
- **Broadcast Messaging**: Send announcements to all users
- **Tax Reporting**: Platform reports, contractor 1099s with IRS filing tracking
- **Service Area Management**: Configure geographic restrictions

</td>
</tr>
</table>

### Core Platform Features

| Feature | Description |
|---------|-------------|
| **Calendar Sync** | Automatic iCal sync with Airbnb, VRBO, Booking.com. Auto-create cleaning appointments based on guest checkouts with configurable offset days. Duplicate prevention and manual deletion tracking. |
| **Multi-Cleaner Jobs** | Large homes (3+ beds AND 3+ baths) automatically require multiple cleaners. Room-level assignments, offer management, slot tracking, and split pricing. Edge-case homes allow solo with warning. |
| **Real-time Messaging** | Socket.io-powered chat with message reactions, read receipts, typing indicators. Suspicious content auto-detection for phone numbers/emails. Broadcast messaging for owners. |
| **Payment Processing** | Stripe integration with saved payment methods. Platform fee collection and instant cleaner payouts via Stripe Connect. Authorization, capture, and refund tracking. |
| **Tax Management** | Automated W-9 collection, 1099-NEC generation for cleaners with all box fields, platform income tracking, IRS filing status, corrections support, and delivery tracking. |
| **Photo Documentation** | Before/after photo capture required for job completion. Room-by-room organization with notes. Offline capture with automatic sync. Access control for cleaners and homeowners. |
| **Review System** | Multi-aspect bidirectional reviews (cleaning quality, punctuality, professionalism, communication, etc.). Both parties must review before either can see results. Option to mark cleaner as preferred. |
| **Home Size Disputes** | Cleaners can report incorrect bed/bath counts with photo evidence. Two-stage approval (homeowner then HR). Automatic price recalculation and expiration windows. |
| **Preferred Cleaner Tiers** | 4-tier loyalty program (Bronze/Silver/Gold/Platinum) based on preferred home count. Bonuses (0-7%), faster payouts (24h vs 48h), early job access, backup cleaner priority. |
| **Incentive Programs** | Configurable fee reductions for cleaners (up to 100%) and discounts for homeowners based on activity and eligibility requirements. |
| **Referral Programs** | 4 program types (client-to-client, client-to-cleaner, cleaner-to-cleaner, cleaner-to-client). Progress tracking, qualification requirements, rewards for both parties. |
| **Guest-Not-Left Tracking** | Cleaners report when guests haven't left by checkout time. GPS verification at job location. Escalation workflow with resolution tracking. |
| **Last-Minute Booking** | Bookings within 48 hours incur a $50 fee (configurable). Triggers urgent push, email, and in-app notifications to all cleaners within 25-mile radius of the property. Cleaners can configure their service area location and radius. |
| **Large Business Fees** | High-volume business owners (50+ jobs/month) receive reduced platform fees (7% vs 10%). Configurable threshold and lookback period. Automatic qualification tracking. |
| **Offline Mode** | Full offline-first architecture with local database. Background sync, conflict resolution, photo queuing. Works for employees, business owners, and messaging. |
| **Terms & Conditions** | Version-controlled legal documents with PDF/text support, user acceptance tracking, and compliance snapshots. |
| **Push Notifications** | Expo push notifications with preferences. Supply reminder snooze. Multi-channel delivery (push, email, in-app). |
| **Account Security** | JWT authentication, encrypted PII (AES-256-CBC), account freezing, warning system, password strength validation. |
| **Conflict Resolution Center** | Unified HR queue for all disputes and appeals. Photo comparison tools, evidence gallery, message threads, audit trail. Priority-based sorting with SLA tracking. |
| **Cancellation Appeals** | 72-hour appeal window for both cleaners and homeowners. 48-hour HR review SLA. Supports penalty waiver, full/partial refunds. Financial breakdown with automatic calculations. |
| **Job Ledger** | Double-entry accounting system tracking all job-related financial transactions. Stripe reconciliation, balance tracking, automated entry creation for fees, payouts, refunds. |
| **Cancellation Audit Log** | Immutable event tracking for all cancellation-related actions. Captures actor, changes, timestamps for compliance and dispute resolution. |
| **Preview as Role** | Platform owners can preview the app as any user type using demo accounts. Preserves owner state for seamless return. Full functionality with demo data. |
| **Internal Analytics** | Platform-level metrics dashboard for owners. Flow abandonment tracking with step-by-step funnel analysis. Job duration statistics (avg/min/max/percentiles). Offline usage monitoring (sync success rate, duration). Dispute and pay override frequency with breakdowns by type/reason. Date range filtering (7/30/90 days). |
| **Transit Time** | Automatic calculation of travel time between jobs for scheduling optimization. Factors in distance and traffic patterns. Helps prevent overbooking and late arrivals. |
| **Employee Timesheets** | Track employee hours worked per job and day. Business owners can review and approve timesheets. Integrates with payroll for accurate wage calculations. Exportable reports for accounting. |

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
├── react-native-paper      # UI components
├── AsyncStorage            # Local persistence
└── expo-location           # GPS verification
```

</td>
<td width="50%" valign="top">

### Backend (API Server)

```
Node.js + Express.js
├── PostgreSQL + Sequelize  # Database & ORM (60 models)
├── Socket.io               # WebSocket server
├── Passport.js + JWT       # Authentication
├── Stripe API              # Payment processing
├── Nodemailer              # Email notifications
├── node-ical               # Calendar parsing
├── crypto (AES-256-CBC)    # PII encryption
└── node-cron               # Scheduled jobs
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
npx sequelize-cli db:seed --seed cleanerChecklistSeeder.js

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
│   │   │   ├── businessEmployee/    # Employee portal components
│   │   │   ├── businessOwner/       # Business owner dashboard
│   │   │   ├── calendarSync/        # iCal sync management
│   │   │   ├── cleaner/             # Cleaner features
│   │   │   ├── client/              # Homeowner dashboard & features
│   │   │   ├── employeeAssignments/ # Job assignments, photos, checklists
│   │   │   ├── hr/                  # HR staff features
│   │   │   ├── messaging/           # Real-time chat
│   │   │   ├── multiCleaner/        # Multi-cleaner job support
│   │   │   ├── offline/             # Offline mode UI
│   │   │   ├── owner/               # Admin dashboard
│   │   │   ├── payments/            # Stripe payment UI
│   │   │   ├── reviews/             # Review system
│   │   │   ├── tax/                 # Tax document views
│   │   │   ├── terms/               # Terms & Conditions UI
│   │   │   ├── conflicts/           # Conflict resolution center
│   │   │   ├── appeals/             # Cancellation appeals
│   │   │   └── preview/             # Preview as Role UI
│   │   ├── context/                 # React contexts
│   │   │   ├── AuthContext.js       # Authentication state
│   │   │   ├── SocketContext.js     # WebSocket provider
│   │   │   ├── PricingContext.js    # Pricing state
│   │   │   └── PreviewContext.js    # Preview as Role state
│   │   └── services/
│   │       ├── fetchRequests/       # API service classes
│   │       ├── offline/             # Offline sync engine
│   │       └── stripe/              # Stripe integration
│   └── package.json
│
├── server/                          # Express.js API Server
│   ├── routes/api/v1/               # 35 API routers
│   │   ├── appointmentsRouter.js    # Scheduling endpoints
│   │   ├── businessEmployeeRouter.js # Employee management
│   │   ├── businessOwnerRouter.js   # Business owner features
│   │   ├── calendarSyncRouter.js    # iCal sync endpoints
│   │   ├── cleanerClientsRouter.js  # Client management
│   │   ├── homeSizeAdjustmentRouter.js  # Dispute system
│   │   ├── hrDashboardRouter.js     # HR features
│   │   ├── incentivesRouter.js      # Incentive programs
│   │   ├── jobPhotosRouter.js       # Before/after photos
│   │   ├── messageRouter.js         # Messaging endpoints
│   │   ├── multiCleanerRouter.js    # Multi-cleaner jobs
│   │   ├── ownerDashboardRouter.js  # Admin features
│   │   ├── paymentRouter.js         # Stripe payments
│   │   ├── preferredCleanerRouter.js # Preferred cleaner system
│   │   ├── pricingRouter.js         # Dynamic pricing
│   │   ├── referralsRouter.js       # Referral programs
│   │   ├── stripeConnectRouter.js   # Cleaner payouts
│   │   ├── suspiciousActivityRouter.js  # Content moderation
│   │   ├── taxRouter.js             # Tax documents
│   │   ├── termsRouter.js           # Terms & Conditions
│   │   ├── conflictRouter.js        # Conflict resolution center
│   │   ├── cancellationAppealRouter.js  # Cancellation appeals
│   │   ├── demoAccountRouter.js     # Preview as Role
│   │   └── analyticsRouter.js       # Internal analytics
│   ├── services/                    # 41 business logic services
│   │   ├── BusinessEmployeeService.js # Employee management
│   │   ├── CalculatePrice.js        # Dynamic pricing logic
│   │   ├── calendarSyncService.js   # iCal parsing & sync
│   │   ├── CleanerAvailabilityService.js # Availability tracking
│   │   ├── EncryptionService.js     # PII encryption (AES-256)
│   │   ├── GuestNotLeftService.js   # Guest escalation
│   │   ├── IncentiveService.js      # Incentive calculations
│   │   ├── MultiCleanerService.js   # Multi-cleaner logic
│   │   ├── PreferredCleanerPerksService.js # Tier bonuses
│   │   ├── PreferredCleanerService.js # Preferred matching
│   │   ├── ReferralService.js       # Referral code management
│   │   ├── SuspiciousContentDetector.js  # Content moderation
│   │   ├── TaxDocumentService.js    # 1099-NEC generation
│   │   ├── ConflictResolutionService.js  # Conflict center logic
│   │   ├── AppealService.js         # Cancellation appeals
│   │   ├── JobLedgerService.js      # Financial ledger
│   │   ├── CancellationAuditService.js   # Audit logging
│   │   ├── DemoAccountService.js    # Preview mode sessions
│   │   ├── AnalyticsService.js      # Event tracking & aggregation
│   │   ├── cron/                    # Scheduled background jobs
│   │   └── sendNotifications/       # Email & push services
│   ├── models/                      # 60 Sequelize models
│   ├── serializers/                 # 37 API serializers
│   ├── migrations/                  # Database migrations
│   ├── __tests__/                   # 4504 server tests
│   └── package.json
│
└── README.md
```

---

## User Types & Roles

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Homeowner** | Property owners needing cleaning services | Book appointments, manage homes, pay bills, review cleaners, respond to disputes |
| **Cleaner** | Independent cleaning professionals | Apply for work, accept jobs, upload photos, earn money, achieve tier bonuses |
| **Business Owner** | Cleaner with own client base and employees | All cleaner features + manage employees, payroll, direct clients, team calendar |
| **Business Client** | Corporate client of a business owner | Book via business portal, manage company properties, view service history |
| **Business Employee** | Works for a business owner | Accept assigned jobs, track earnings, availability settings, coworker messaging |
| **HR Staff** | Support and moderation team | Handle disputes, review reports, manage support, freeze accounts |
| **Owner** | Platform administrator | Full access: financials, employees, pricing, settings, reports, tax filing |

---

## Testing

```bash
# Run all server tests (5038 tests)
cd server && npm test

# Run all client tests (5561 tests)
cd client && npm test

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
| Business Employees | 89 | Employee management, assignments, payroll |
| Multi-Cleaner | 67 | Large home jobs, offers, room assignments |
| Pricing | 67 | Dynamic pricing, configuration |
| Incentives | 54 | Qualification, discounts |
| Referrals | 48 | Codes, rewards, tracking |
| Preferred Cleaners | 56 | Tiers, perks, bonuses |
| Tax Documents | 89 | W-9, 1099-NEC, platform taxes |
| Reviews | 67 | Create, read, bidirectional |
| Messaging | 234 | Conversations, reactions, suspicious content |
| Job Photos | 67 | Upload, access control, completion |
| Home Size Disputes | 45 | Filing, evidence, resolution |
| Guest Not Left | 34 | Reporting, GPS, escalation |
| HR Dashboard | 78 | Disputes, reports, support |
| Owner Dashboard | 89 | Financial, analytics, settings |
| Push Notifications | 56 | Token registration, preferences |
| Terms & Conditions | 78 | Version management, acceptance |
| Checklist | 45 | Editor, publishing, versions |
| Applications | 56 | Submission, review, hire |
| Services | 156 | All service unit tests |
| Serializers | 145 | PII encryption, decimal parsing, data formatting |
| Last-Minute Booking | 45 | Notification service, price calculation, route tests |
| Route Ordering | 12 | Express route interception prevention |
| Integration | 67 | Full payment flows, e2e |
| Offline Sync | 28 | Offline mode, conflict resolution |
| Preferred Cleaner Flow | 17 | End-to-end preferred cleaner integration |
| Conflict Resolution | 56 | Router, service, case management |
| Cancellation Appeals | 67 | Appeal workflow, HR review, decisions |
| Job Ledger | 45 | Double-entry accounting, reconciliation |
| Preview as Role | 129 | Context, modals, demo account services |
| Internal Analytics | 89 | Event tracking, dashboard stats, aggregations |
| Multi-Cleaner Router | 76 | Job creation, offers, room assignments |
| **Server Total** | **5038** | 178 test suites |
| **Client Total** | **5561** | 175 test suites |
| **Combined Total** | **10599** | 353 test suites |

---

## API Reference

See [Server README](./server/README.md) for complete API documentation.

### Endpoint Summary (35 Routers, 200+ Endpoints)

| Category | Router | Key Endpoints |
|----------|--------|---------------|
| **Auth & Users** | usersRouter | Login, register, profile, password reset |
| **Appointments** | appointmentsRouter | CRUD, assign, complete, decline, recurring |
| **Multi-Cleaner** | multiCleanerRouter | Create, offers, slots, room assignments |
| **Business** | businessOwnerRouter | Dashboard, employees, clients, payroll |
| **Employees** | businessEmployeeRouter | Invite, accept, assign, availability |
| **Payments** | paymentRouter | Intents, capture, refund, methods |
| **Payouts** | stripeConnectRouter | Account setup, transfers, history |
| **Messaging** | messageRouter | Conversations, send, reactions, reports |
| **Calendar** | calendarSyncRouter | iCal feeds, sync, auto-appointments |
| **Reviews** | reviewsRouter | Submit, view, multi-aspect ratings |
| **Tax** | taxRouter | W-9, 1099-NEC, platform reports |
| **Preferred** | preferredCleanerRouter | Tiers, perks, availability config |
| **Incentives** | incentivesRouter | Configuration, eligibility |
| **Referrals** | referralsRouter | Codes, rewards, validation |
| **HR** | hrDashboardRouter | Disputes, reports, support |
| **Owner** | ownerDashboardRouter | Financials, settings, perks config |
| **Conflicts** | conflictRouter | Case queue, evidence, resolution, audit |
| **Appeals** | cancellationAppealRouter | Submit, review, decide, stats |
| **Demo Accounts** | demoAccountRouter | Preview enter/exit, role selection |
| **Analytics** | analyticsRouter | Flow abandonment, job duration, offline usage, disputes, pay overrides |

---

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| `*/15 * * * *` | Backup Cleaner Timeout | Escalates unresponded backup cleaner notifications |
| `0 0 * * *` | Booking Expiration | Expires pending bookings (48-hour window) |
| `0 1 * * *` | Calendar Sync | Syncs all active iCal calendars |
| `*/30 * * * *` | Multi-Cleaner Fill Monitor | Escalates unfilled multi-cleaner job slots |
| `*/10 * * * *` | Multi-Cleaner Offer Expiration | Expires unanswered job offers |
| `0 7 * * *` | Supply Reminder | Reminds cleaners to bring supplies |
| `0 0 * * *` | Payment Retry | Retries failed payments |
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
'job_offer_received'       // Multi-cleaner job offer
'appointment_update'       // Appointment status change

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
- **Encryption**: AES-256-CBC for PII (names, emails, addresses, tax IDs, phone numbers)
- **Payments**: PCI-compliant via Stripe Elements, webhook signature verification
- **Content Moderation**: Automatic suspicious content detection, user reporting
- **Account Protection**: Freezing, warning system, violation tracking
- **Data Serialization**: All API responses sanitized through serializers with automatic decryption

---

## Database Models (62 Total)

### Core Models
- User, UserHomes, UserAppointments, UserBills

### Business & Employment
- BusinessEmployee, EmployeeJobAssignment, EmployeePayChangeLog, EmployeeTimesheet

### Multi-Cleaner
- MultiCleanerJob, CleanerJobOffer, CleanerJobCompletion, CleanerRoomAssignment

### Financial
- Payment, Payout, PlatformEarnings, OwnerWithdrawal, StripeConnectAccount

### Preferred Cleaner System
- HomePreferredCleaner, CleanerPreferredPerks, PreferredPerksConfig, PreferredPerksConfigHistory, CleanerAvailabilityConfig

### Communication
- Conversation, ConversationParticipant, Message, MessageReaction, MessageReadReceipt, Notification

### Reviews & Compliance
- UserReviews, SuspiciousActivityReport, HomeSizeAdjustmentRequest, HomeSizeAdjustmentPhoto, GuestNotLeftReport

### Tax & Legal
- TaxDocument, TaxInfo, UserTermsAcceptance

### Programs
- Referral, ReferralConfig, IncentiveConfig

### Scheduling
- RecurringSchedule, CalendarSync, CleanerClient

### Checklists & Photos
- ChecklistVersion, ChecklistDraft, ChecklistSection, ChecklistItem, JobPhoto

### Conflicts & Appeals
- CancellationAppeal, CancellationAuditLog, JobLedger

### Analytics
- AnalyticsEvent

---

## Documentation

| Document | Description |
|----------|-------------|
| [Server README](./server/README.md) | Complete API reference, database models, services, testing |
| [Client README](./client/README.md) | Component documentation, offline architecture, state management |

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
