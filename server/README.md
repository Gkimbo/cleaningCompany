<div align="center">

# Kleanr API Server

![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Connect-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-4504_Passing-brightgreen?style=for-the-badge)

**RESTful API server for the Kleanr cleaning service platform**

[Getting Started](#-getting-started) | [Features](#-features) | [API Reference](#-api-reference) | [Database](#-database) | [Services](#-services)

</div>

---

## Overview

Kleanr is a comprehensive cleaning service marketplace platform that connects homeowners with professional cleaners and cleaning businesses. The platform supports multiple user types including platform clients, independent cleaners, business owners with their own clients, HR staff, and platform administrators.

**Key Capabilities:**
- Multi-tenant cleaning service marketplace with offline support
- Business owner onboarding with employee management and payroll
- Multi-cleaner job support for large homes with room assignments
- Real-time messaging with suspicious content detection
- Dynamic pricing with incentive and referral programs
- Last-minute booking with urgent cleaner notifications (within radius)
- Large business volume-based fee tiers for high-volume owners
- Preferred cleaner tier system (Bronze/Silver/Gold/Platinum) with bonuses
- Stripe Connect for instant cleaner payouts
- iCal calendar synchronization with vacation rental platforms
- Comprehensive tax document generation (1099-NEC with IRS filing tracking)
- Guest-not-left tracking with GPS verification
- HR dispute management and content moderation
- Before/after job photo documentation with offline capture
- Home size dispute resolution with photo evidence
- **Unified Conflict Resolution Center** for appeals and disputes
- **Cancellation Appeals System** with 72-hour appeal window and HR review
- **Job Ledger** with double-entry accounting and Stripe reconciliation
- **Cancellation Audit Logging** for compliance tracking
- **Preview as Role** for platform owners to test any user experience
- **Internal Analytics** for tracking flow abandonment, job duration, offline usage, disputes, and pay overrides

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

# Seed initial data (owner account)
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
# Encryption (Required for PII)
# ===================
ENCRYPTION_KEY=your_32_byte_encryption_key_here

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

## Features

### User Types & Roles

| Role | Description |
|------|-------------|
| **Homeowner/Client** | Book cleanings, manage homes, pay bills, leave reviews |
| **Cleaner** | Apply for platform work, accept jobs, earn money, achieve tier bonuses |
| **Business Owner** | Cleaner who can onboard clients and manage employees with payroll |
| **Business Employee** | Works for a business owner, accepts assigned jobs, tracks earnings |
| **HR Staff** | Handle disputes, review suspicious activity reports, manage support |
| **Owner** | Platform administrator with full access to all features |

### Authentication & Account Management

- User registration with email/password
- Business owner signup flow with client management capabilities
- Cleaner upgrade to business owner (existing cleaners can become business owners)
- HR account creation with automatic email invitations
- Password reset/recovery via email
- Password strength validation (8+ chars, uppercase, lowercase, numbers, special)
- Username reset functionality
- Terms & Conditions and Privacy Policy acceptance tracking
- JWT-based authentication with 24-hour token expiration
- Encrypted PII storage (names, emails, tax IDs)
- Login tracking with last login timestamp
- Account freezing with reasons for policy violations
- Warning system with violation counts

### Business Owner Onboarding

Business owners are cleaners who can manage their own clients directly:

- **Upgrade Path**: Existing cleaners can upgrade to business owner status
- **Invite Clients**: Send invitations to new clients by email with home details
- **Client Setup Flow**: Guided onboarding for invited clients
- **Invitation Management**: Resend invitations, track pending responses
- **Recurring Schedules**: Configure weekly/biweekly/monthly cleanings during invite
- **My Clients Page**: View and manage all direct client relationships
- **Book For Client**: Create appointments on behalf of clients
- **Per-Home Pricing**: Set custom pricing for each client's home
- **Platform Price Alignment**: "Align with Platform Pricing" button for easy rate setting
- **Direct Revenue**: Earn full amount from owned clients (no platform fee)
- **Client History**: View historical appointments and payment data per client

### Business Employee Management

Business owners can hire and manage employees:

- **Invite Employees**: Send email invitations with secure tokens
- **Employee Onboarding**: Guided setup with availability configuration
- **Availability Scheduling**: Per-day availability windows (start/end times)
- **Job Type Restrictions**: Limit employees to specific job types
- **Max Daily Jobs**: Configure maximum jobs per employee per day
- **Payment Methods**: Stripe Connect or direct payment from owner
- **Hourly vs Flat Rate**: Flexible pay structure per employee
- **Job Assignment**: Assign specific jobs to employees
- **Self-Assignment**: Business owners can assign jobs to themselves
- **Marketplace Pickup**: Allow employees to pick up open marketplace jobs
- **Pay Tracking**: Track pay per job with audit trail
- **Earnings Dashboard**: Employees view their earnings history
- **Coworker Messaging**: Team communication channels

### Multi-Cleaner Job System

Large homes (3+ beds AND 3+ baths) require multiple cleaners:

- **Automatic Detection**: Homes flagged as multi-cleaner based on size
- **Edge Case Homes**: Allow solo cleaning with warning for borderline homes
- **Slot Management**: Track cleaner slots needed and filled
- **Job Offers**: Send offers to qualified cleaners
- **Offer Expiration**: Configurable timeout for offer responses
- **Room Assignments**: Assign specific rooms to each cleaner
- **Split Pricing**: Automatically split job price across cleaners
- **Completion Tracking**: Track individual cleaner completion status
- **Fill Monitoring**: Cron job escalates unfilled slots
- **Bonus Calculations**: Apply preferred cleaner bonuses per slot

### Preferred Cleaner Tier System

4-tier loyalty program based on preferred home count:

- **Bronze Tier**: 1-2 preferred homes (default)
- **Silver Tier**: 3-5 preferred homes → 3% bonus on preferred jobs
- **Gold Tier**: 6-10 preferred homes → 5% bonus + faster payouts (24h)
- **Platinum Tier**: 11+ preferred homes → 7% bonus + faster payouts + early job access
- **Owner Configurable**: Tier thresholds and bonuses adjustable via Priority Perks menu
- **Backup Cleaner Priority**: Higher tiers get priority for backup notifications
- **Perk Tracking**: Track bonuses applied per payout
- **Config History**: Audit trail of tier configuration changes

### Guest-Not-Left Tracking

Handle situations when guests haven't left by checkout time:

- **Cleaner Reporting**: Cleaners can report guest-not-left scenarios
- **GPS Verification**: Verify cleaner is at the job location
- **Distance Validation**: Check cleaner is within acceptable distance of home
- **Escalation Workflow**: Notify homeowner and support
- **Resolution Options**: Job completed, cancelled, expired, manually resolved
- **Business Employee Support**: Works with employee-assigned jobs

### Homeowner Features

- **Multi-Home Management**: Add and manage multiple properties
- **Home Details**: Beds, baths, half baths, access codes, linen preferences, special notes
- **Home Setup Wizard**: Guided setup for complete home configuration
- **Service Area Validation**: Homes must be within service area to book
- **Appointment Booking**: Schedule one-time or recurring cleanings
- **Time Windows**: Select preferred cleaning times (anytime, 10-3, 11-4, 12-2)
- **Preferred Cleaner**: Mark favorite cleaners for priority assignment
- **Calendar Sync**: Sync with vacation rental platforms (Airbnb, VRBO, Booking.com)
- **Auto-Booking**: Automatic appointment creation from vacation rental checkouts
- **Bill Management**: View and pay appointment and cancellation fees
- **Prepayment**: Pay for multiple upcoming appointments at once
- **Review System**: Rate cleaners on multiple aspects after completion
- **Bidirectional Reviews**: See cleaner's review after submitting yours
- **In-App Messaging**: Communicate with assigned cleaners
- **Support Chat**: Contact owner/HR for help
- **Notification Preferences**: Control email and push notifications

**Home Configuration Options:**
- Access method (keypad code, key location, lockbox)
- Trash/recycling/compost locations
- Sheet preferences (homeowner provides, company provides, no sheets)
- Clean/dirty sheet storage locations
- Towel preferences and locations
- Bed configurations by room
- Bathroom details
- Special instructions
- Contact information per home
- Time requirements (estimated cleaning duration)
- Multi-cleaner needs

### Cleaner Features

- **Job Application**: Submit detailed application with background info
- **Application Review Process**: Photo submissions, reference checks, background consent
- **View Available Jobs**: Browse unassigned appointments to request
- **Request Assignments**: Request to be assigned to specific appointments
- **Job Photos**: Upload before/after photos documenting work (required for completion)
- **Photo Requirements**: Before photos required first, then after photos
- **Recurring Schedules**: Set up regular clients with recurring appointments
- **Earnings Dashboard**: Track income with visual charts (daily, weekly, monthly, yearly)
- **Stripe Connect**: Receive payouts directly to bank account
- **Review Management**: View and respond to client reviews
- **Review Statistics**: Aggregate ratings across all reviews
- **Supply Reminders**: Get reminders to bring supplies (with 1-week snooze option)
- **Tax Documents**: Access W-9 submission and 1099-NEC downloads
- **Working Days Configuration**: Set available days for scheduling

### Job Photo System

- **Before Photos**: Document home state before cleaning (required)
- **After Photos**: Document completed work (requires before photos first)
- **Room Organization**: Photos organized by area/room
- **Photo Notes**: Add annotations to photos
- **Access Control**: Only assigned cleaner and homeowner can view
- **Completion Check**: Both before/after required to complete job
- **Photo Deletion**: Uploader can delete before job completion

### Home Size Disputes

- **Size Mismatch Reporting**: Cleaners can report incorrect bed/bath counts
- **Photo Evidence**: Must provide photos of each bedroom/bathroom as proof
- **Validation**: Photo count must match reported size
- **HR Review**: Disputes reviewed by HR staff with photo evidence
- **Resolution Options**: Approve (adjust price), deny, or expire
- **False Claim Tracking**: Track cleaners with excessive false claims
- **False Complaint Tracking**: Track homeowners with repeated false listings

### HR Staff Features

- **Conflict Resolution Center**: Unified queue for all disputes and appeals
- **Cancellation Appeals Review**: Review appeals within 48-hour SLA
- **Photo Comparison Tools**: Side-by-side evidence examination
- **Financial Breakdown**: View detailed charges, refunds, payouts per case
- **Audit Trail**: Complete event history for compliance
- **Dispute Management**: Review and decide on home size adjustment requests
- **Photo Evidence Review**: Examine cleaner-submitted photos for disputes
- **Suspicious Activity Reports**: Review flagged messages with contact info
- **User Warnings**: Issue warnings to policy violators
- **Warning Counts**: Track number of warnings per user
- **Account Freezing**: Freeze accounts of repeat offenders with reasons
- **Support Conversations**: Handle customer support inquiries
- **Internal Messaging**: Communicate with owner and other HR staff
- **Quick Stats Dashboard**: Overview of pending items and metrics

### Owner/Admin Features

- **Financial Dashboard**: Revenue metrics (today, week, month, year, all-time)
- **Platform Withdrawals**: Transfer earnings to bank via Stripe
- **Stripe Balance**: View pending and available platform balance
- **Preview as Role**: Test the app as any user type via demo accounts
- **Employee Management**: Create/edit/delete HR staff and cleaner employees
- **Pricing Configuration**: Set base prices, per-bed/bath fees, cancellation fees
- **Advanced Pricing**: Half bath fees, sheet/towel fees, time window premiums
- **Incentive Programs**: Configure cleaner fee reductions and homeowner discounts
- **Referral Programs**: Create referral rewards for homeowners and cleaners
- **Checklist Management**: Create and publish cleaning checklists with sections
- **Checklist Versioning**: Maintain history, revert to previous versions
- **Terms & Conditions**: Manage terms versions with acceptance tracking
- **Application Review**: Approve or reject cleaner applications
- **Application Notes**: Add private notes during review process
- **Broadcast Messaging**: Send announcements to all users or specific groups
- **Suspicious Activity**: Review all flagged messages and take action
- **Tax Reporting**: Generate platform tax reports and contractor 1099s
- **Service Area Management**: Configure geographic service restrictions
- **Internal Analytics Dashboard**: Track flow abandonment, job duration, offline usage, disputes, pay overrides

### Messaging System

- **Conversation Types**: Appointment, support, cleaner-client, internal (HR/owner), custom groups
- **Real-Time Updates**: Socket.io for instant message delivery
- **Message Reactions**: React to messages with emojis
- **Read Receipts**: Track message read status with timestamps
- **Mark All Read**: Bulk mark messages as read
- **Suspicious Content Detection**: Auto-flag phone numbers, emails, off-platform offers
- **Report Functionality**: Users can report suspicious messages
- **Group Conversations**: Multi-participant chat support
- **Add Participants**: Invite additional users to conversations
- **Broadcast Announcements**: Platform-wide announcements from owner
- **Conversation Titles**: Custom naming for easy identification
- **Message Deletion**: Delete individual messages
- **Unread Counts**: Per-conversation and total unread badges

### Payments & Billing

- **Stripe Integration**: Secure payment processing
- **Payment Methods**: Add, remove, and manage saved payment methods
- **Payment Intents**: Create and capture payment intents
- **Dynamic Pricing**: Based on home size, time windows, linens, incentives
- **Bill Management**: Appointment dues and cancellation fees
- **Bill Sync**: Automatic synchronization from appointments
- **Prepayment**: Pay for all upcoming or batch of appointments
- **Stripe Connect Payouts**: Direct transfers to cleaner bank accounts
- **Platform Fee**: Configurable percentage (default 10%) on platform jobs
- **Business Owner Fee**: Separate configurable percentage
- **Payment History**: Complete transaction records with pagination
- **Refund Processing**: Handle payment refunds
- **Payment Retry**: Automatic retry of failed payments
- **Overdue Reminders**: Configurable reminder frequency

**Pricing Configuration:**
- Base price per cleaning
- Per bedroom fee
- Per bathroom fee
- Per half-bath fee
- Sheet service fee (per bed)
- Towel service fee
- Face cloth fee
- Time window premiums (anytime, 10-3, 11-4, 12-2)
- Cancellation fee and window
- Refund percentage
- Last-minute booking fee (appointments within 48 hours)
- Large business volume-based fees (for 50+ jobs/month)

### Reviews & Ratings

- **Multi-Aspect Reviews**: Rate on professionalism, attention-to-detail, communication
- **Star Rating**: 1-5 star rating system
- **Written Feedback**: Optional text reviews
- **Bidirectional Reviews**: Both parties review before either can see results
- **Review Visibility**: Reviews hidden until both parties submit
- **Review Statistics**: Aggregate ratings and breakdowns
- **Pending Reviews**: Track appointments needing reviews
- **Preferred Cleaner Award**: Option to mark cleaner as preferred when reviewing

### Incentive Programs

- **Cleaner Incentives**: Fee reduction for qualifying cleaners
- **Homeowner Incentives**: Discounts for frequent customers
- **Eligibility Tracking**: Automatic qualification based on activity
- **Configuration**: Set percentages, max cleanings, eligibility requirements
- **History Tracking**: Record of incentive applications

### Referral Programs

- **Referral Codes**: Unique codes for each user
- **Tiered Rewards**: Different rewards for homeowner vs cleaner referrals
- **Status Tracking**: Pending, qualified, redeemed
- **Reward Types**: Discounts, fee reductions, credit
- **Minimum Requirements**: Configurable cleanings required to qualify
- **Referrer Rewards**: Bonus for successful referrals
- **Referee Rewards**: Welcome bonus for new users

### Tax & Compliance

- **W-9 Collection**: Secure tax information submission
- **Tax Info Fields**: Legal name, business name, entity type, TIN
- **1099-NEC Generation**: Automatic generation for contractors
- **1099-K Calculations**: Expected amounts for high-volume contractors
- **Encrypted Storage**: TIN encrypted with AES-256
- **Platform Tax Reports**: Annual income summaries, quarterly estimates
- **Monthly Earnings Breakdown**: Detailed income by month
- **Schedule C Support**: Data for contractor tax filing
- **Tax Deadlines**: Track important tax filing dates
- **Tax Document History**: Access previous years' documents

### Calendar Integration

- **iCal Sync**: Parse vacation rental calendars
- **Supported Platforms**: Airbnb, VRBO, Booking.com (auto-detected)
- **Auto-Appointment Creation**: Generate appointments from checkout dates
- **Configurable Offset**: Set days after checkout for cleaning
- **Calendar Preview**: Preview events before syncing
- **Multiple Calendars**: Link multiple calendars per home
- **Auto-Sync Toggle**: Enable/disable automatic updates
- **Manual Sync**: Trigger sync on demand
- **Periodic Sync**: Automatic daily calendar updates

### Notifications

- **Push Notifications**: Mobile push via Expo
- **Email Notifications**: HTML email templates for all events
- **In-App Notifications**: Notification feed with unread counts
- **Preferences**: Toggle notification types per channel
- **Supply Reminder Snooze**: Cleaners can snooze reminders for 1 week
- **Action Required Badges**: Highlight notifications needing response
- **Notification Expiration**: Auto-cleanup of old notifications
- **Multi-Channel Delivery**: Push, email, and in-app simultaneously

**Notification Events:**
- Appointment confirmations and reminders
- Booking requests and approvals
- Booking expiration warnings (48-hour window)
- Payment confirmations and receipts
- Review invitations
- Preferred cleaner status earned
- Cleaner application updates
- Support messages
- Referral rewards earned
- Appointment cancellations
- Supply reminders
- Last-minute urgent alerts (cleaners within radius)

### Booking Expiration

- **48-Hour Window**: Clients have 48 hours to respond to bookings
- **Expiration Warnings**: Notifications before booking expires
- **Automatic Expiration**: Pending bookings expire after window
- **Cron Job**: Daily check for expired bookings

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/user-sessions/login` | User login | No |
| `POST` | `/api/v1/users` | Register new user | No |
| `POST` | `/api/v1/users/business-owner` | Register as business owner | No |
| `GET` | `/api/v1/user-sessions/current` | Get current user | Yes |
| `POST` | `/api/v1/user-sessions/logout` | Logout user | Yes |
| `POST` | `/api/v1/users/reset-password` | Request password reset | No |
| `POST` | `/api/v1/users/reset-password/confirm` | Confirm password reset | No |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/user-info` | Get user profile | Yes |
| `PATCH` | `/api/v1/user-info` | Update user profile | Yes |
| `GET` | `/api/v1/user-info/public/:userId` | Get public profile | Yes |
| `GET` | `/api/v1/employee-info` | Get employee details | Yes |
| `POST` | `/api/v1/users/new-employee` | Create employee | Owner |
| `PATCH` | `/api/v1/users/employee` | Update employee | Owner |
| `DELETE` | `/api/v1/users/employee` | Delete employee | Owner |
| `POST` | `/api/v1/users/upgrade-to-business-owner` | Upgrade cleaner to business owner | Yes |

### Homes

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/homes` | Get user's homes | Yes |
| `POST` | `/api/v1/homes` | Add new home | Yes |
| `GET` | `/api/v1/homes/:id` | Get home details | Yes |
| `PATCH` | `/api/v1/homes/:id` | Update home | Yes |
| `DELETE` | `/api/v1/homes/:id` | Delete home | Yes |
| `PATCH` | `/api/v1/homes/:id/setup-complete` | Mark home setup complete | Yes |

### Appointments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/appointments/:homeId` | Get home appointments | Yes |
| `GET` | `/api/v1/appointments/unassigned` | Get unassigned jobs | Yes |
| `GET` | `/api/v1/appointments/pending-approval` | Get pending approvals | Owner |
| `POST` | `/api/v1/appointments` | Create appointment | Yes |
| `PATCH` | `/api/v1/appointments/:id` | Update appointment | Yes |
| `DELETE` | `/api/v1/appointments/:id` | Cancel appointment | Yes |
| `PATCH` | `/api/v1/appointments/request-employee` | Request cleaner | Yes |
| `PATCH` | `/api/v1/appointments/approve-request` | Approve request | Owner |
| `PATCH` | `/api/v1/appointments/:id/complete` | Complete appointment | Cleaner |
| `PATCH` | `/api/v1/appointments/:id/unstart` | Unstart appointment | Cleaner |

### Cleaner Clients (Business Owner)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/cleaner-clients` | Get all clients | Cleaner |
| `POST` | `/api/v1/cleaner-clients/invite` | Invite new client | Cleaner |
| `POST` | `/api/v1/cleaner-clients/resend-invite/:id` | Resend invitation | Cleaner |
| `GET` | `/api/v1/cleaner-clients/:id` | Get client details | Cleaner |
| `GET` | `/api/v1/cleaner-clients/:id/full` | Get full client details with history | Cleaner |
| `PATCH` | `/api/v1/cleaner-clients/:id` | Update client relationship | Cleaner |
| `DELETE` | `/api/v1/cleaner-clients/:id` | Remove client | Cleaner |
| `GET` | `/api/v1/cleaner-clients/:id/platform-price` | Get platform price for home | Cleaner |
| `PATCH` | `/api/v1/cleaner-clients/:id/default-price` | Update default price | Cleaner |
| `POST` | `/api/v1/cleaner-clients/:id/book` | Book appointment for client | Cleaner |

### Recurring Schedules

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/recurring-schedules` | Get all schedules | Yes |
| `POST` | `/api/v1/recurring-schedules` | Create schedule | Yes |
| `PATCH` | `/api/v1/recurring-schedules/:id` | Update schedule | Yes |
| `DELETE` | `/api/v1/recurring-schedules/:id` | Delete schedule | Yes |
| `POST` | `/api/v1/recurring-schedules/:id/pause` | Pause schedule | Yes |
| `POST` | `/api/v1/recurring-schedules/:id/resume` | Resume schedule | Yes |
| `POST` | `/api/v1/recurring-schedules/:id/generate` | Generate appointments | Yes |
| `POST` | `/api/v1/recurring-schedules/generate-all` | Generate all schedules | Owner |

### Business Employees

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/business-employees` | Get all employees | Business Owner |
| `POST` | `/api/v1/business-employees/invite` | Invite new employee | Business Owner |
| `GET` | `/api/v1/business-employees/:id` | Get employee details | Business Owner |
| `PATCH` | `/api/v1/business-employees/:id` | Update employee | Business Owner |
| `DELETE` | `/api/v1/business-employees/:id` | Remove employee | Business Owner |
| `GET` | `/api/v1/business-employees/:id/availability` | Get availability | Business Owner |
| `PATCH` | `/api/v1/business-employees/:id/availability` | Update availability | Business Owner |
| `POST` | `/api/v1/business-employees/accept-invite/:token` | Accept invitation | No |
| `GET` | `/api/v1/business-employees/my-assignments` | Get my assignments | Employee |
| `GET` | `/api/v1/business-employees/my-earnings` | Get my earnings | Employee |

### Employee Job Assignments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/employee-assignments` | Get all assignments | Business Owner |
| `POST` | `/api/v1/employee-assignments` | Assign job to employee | Business Owner |
| `PATCH` | `/api/v1/employee-assignments/:id` | Update assignment | Business Owner |
| `DELETE` | `/api/v1/employee-assignments/:id` | Remove assignment | Business Owner |
| `POST` | `/api/v1/employee-assignments/:id/complete` | Mark completed | Employee |
| `GET` | `/api/v1/employee-assignments/pending-payouts` | Get pending payouts | Business Owner |

### Multi-Cleaner Jobs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/multi-cleaner/jobs` | Get multi-cleaner jobs | Yes |
| `POST` | `/api/v1/multi-cleaner/jobs` | Create multi-cleaner job | Yes |
| `GET` | `/api/v1/multi-cleaner/jobs/:id` | Get job details | Yes |
| `POST` | `/api/v1/multi-cleaner/jobs/:id/offers` | Send job offers | Yes |
| `GET` | `/api/v1/multi-cleaner/jobs/:id/offers` | Get job offers | Yes |
| `POST` | `/api/v1/multi-cleaner/offers/:id/accept` | Accept offer | Cleaner |
| `POST` | `/api/v1/multi-cleaner/offers/:id/decline` | Decline offer | Cleaner |
| `GET` | `/api/v1/multi-cleaner/jobs/:id/rooms` | Get room assignments | Yes |
| `POST` | `/api/v1/multi-cleaner/jobs/:id/rooms` | Assign rooms | Yes |
| `POST` | `/api/v1/multi-cleaner/jobs/:id/complete-slot` | Complete slot | Cleaner |

### Calendar Sync

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/calendar-sync/home/:homeId` | Get syncs for home | Yes |
| `POST` | `/api/v1/calendar-sync` | Create new sync | Yes |
| `PATCH` | `/api/v1/calendar-sync/:id` | Update sync settings | Yes |
| `DELETE` | `/api/v1/calendar-sync/:id` | Remove sync | Yes |
| `POST` | `/api/v1/calendar-sync/:id/sync` | Trigger manual sync | Yes |
| `GET` | `/api/v1/calendar-sync/:id/preview` | Preview calendar events | Yes |

### Job Photos

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/job-photos/upload` | Upload photo | Cleaner |
| `GET` | `/api/v1/job-photos/:appointmentId` | Get photos for appointment | Yes |
| `GET` | `/api/v1/job-photos/:appointmentId/status` | Check photo completion status | Yes |
| `DELETE` | `/api/v1/job-photos/:photoId` | Delete photo | Cleaner |

### Home Size Adjustment

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/home-size-adjustment` | Submit size dispute | Cleaner |
| `GET` | `/api/v1/home-size-adjustment/pending` | Get pending disputes | Owner/HR |
| `GET` | `/api/v1/home-size-adjustment/:id` | Get dispute details | Owner/HR |
| `POST` | `/api/v1/home-size-adjustment/:id/approve` | Approve dispute | Owner/HR |
| `POST` | `/api/v1/home-size-adjustment/:id/deny` | Deny dispute | Owner/HR |
| `GET` | `/api/v1/home-size-adjustment/home/:homeId` | Get disputes for home | Yes |

### Payments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/payments/config` | Get Stripe publishable key | No |
| `POST` | `/api/v1/payments/create-intent` | Create payment intent | Yes |
| `POST` | `/api/v1/payments/capture` | Capture payment | Yes |
| `POST` | `/api/v1/payments/refund` | Process refund | Yes |
| `GET` | `/api/v1/payments/history/:userId` | Payment history | Yes |
| `GET` | `/api/v1/payments/earnings/:employeeId` | Employee earnings | Yes |
| `POST` | `/api/v1/payments/webhook` | Stripe webhook | No |
| `POST` | `/api/v1/payments/setup-method` | Setup payment method | Yes |
| `GET` | `/api/v1/payments/methods` | Get saved payment methods | Yes |
| `DELETE` | `/api/v1/payments/methods/:id` | Remove payment method | Yes |
| `POST` | `/api/v1/payments/prepay-all` | Prepay all upcoming | Yes |
| `POST` | `/api/v1/payments/prepay-batch` | Prepay batch of appointments | Yes |

### Billing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/billing` | Get billing summary | Yes |
| `GET` | `/api/v1/billing/history` | Get billing history | Yes |
| `POST` | `/api/v1/billing/sync` | Sync bills from appointments | Yes |

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

### Pricing

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/pricing/config` | Get pricing configuration | Yes |
| `PUT` | `/api/v1/pricing/config` | Update pricing | Owner |
| `GET` | `/api/v1/pricing/history` | Get pricing history | Owner |
| `GET` | `/api/v1/pricing/calculate` | Calculate appointment price | Yes |

### Incentives

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/incentives/current` | Get current incentive config | No |
| `GET` | `/api/v1/incentives/config` | Get full config (owner) | Owner |
| `PUT` | `/api/v1/incentives/config` | Update incentives | Owner |
| `GET` | `/api/v1/incentives/cleaner-eligibility` | Check cleaner eligibility | Yes |
| `GET` | `/api/v1/incentives/homeowner-eligibility` | Check homeowner eligibility | Yes |

### Referrals

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/referrals/config` | Get referral config | Owner |
| `PUT` | `/api/v1/referrals/config` | Update referral config | Owner |
| `GET` | `/api/v1/referrals/my-referrals` | Get user's referrals | Yes |
| `GET` | `/api/v1/referrals/my-code` | Get user's referral code | Yes |
| `GET` | `/api/v1/referrals/code/:code` | Validate referral code | No |
| `POST` | `/api/v1/referrals/apply` | Apply referral code | Yes |

### Tax Documents

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/tax/info` | Get W-9 info | Yes |
| `POST` | `/api/v1/tax/info` | Submit W-9 | Yes |
| `GET` | `/api/v1/tax/contractor/tax-summary/:year` | Cleaner tax summary | Yes |
| `GET` | `/api/v1/tax/contractor/1099-nec/:year` | Get 1099-NEC | Yes |
| `GET` | `/api/v1/tax/contractor/monthly-breakdown/:year` | Monthly earnings | Yes |
| `GET` | `/api/v1/tax/platform/comprehensive-report/:year` | Full platform report | Owner |
| `GET` | `/api/v1/tax/platform/1099-k-summary/:year` | Platform 1099-K summary | Owner |
| `GET` | `/api/v1/tax/deadlines/:year` | Tax filing deadlines | Yes |

### Reviews

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/reviews/pending` | Get pending reviews | Yes |
| `GET` | `/api/v1/reviews/cleaner/:cleanerId` | Get cleaner reviews | Yes |
| `POST` | `/api/v1/reviews` | Submit review | Yes |
| `GET` | `/api/v1/reviews/cleaner/:cleanerId/summary` | Review summary | Yes |
| `GET` | `/api/v1/reviews/appointment/:appointmentId/status` | Review status for appointment | Yes |
| `GET` | `/api/v1/reviews/user/:userId` | Get user's reviews | Yes |

### Preferred Cleaners & Tier System

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/preferred-cleaners/homes/:homeId/preferred-cleaners` | Get preferred cleaners for home | Yes |
| `POST` | `/api/v1/preferred-cleaners` | Set preferred cleaner | Yes |
| `DELETE` | `/api/v1/preferred-cleaners/:homeId/:cleanerId` | Remove preferred cleaner | Yes |
| `GET` | `/api/v1/preferred-cleaners/my-preferred-homes` | Get homes where cleaner is preferred | Cleaner |
| `GET` | `/api/v1/preferred-cleaners/my-perk-status` | Get cleaner's tier and perks | Cleaner |
| `GET` | `/api/v1/preferred-cleaners/perk-tier-info` | Get tier thresholds and bonuses | Yes |
| `GET` | `/api/v1/preferred-cleaners/my-availability-config` | Get availability config | Cleaner |
| `PUT` | `/api/v1/preferred-cleaners/my-availability-config` | Update availability config | Cleaner |
| `POST` | `/api/v1/preferred-cleaners/my-blackout-dates` | Add blackout dates | Cleaner |
| `GET` | `/api/v1/preferred-cleaners/my-job-counts` | Get daily job counts | Cleaner |
| `GET` | `/api/v1/preferred-cleaners/check-availability/:date` | Check availability for date | Cleaner |

### Priority Perks Config (Owner)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/owner-dashboard/priority-perks/config` | Get tier configuration | Owner |
| `PUT` | `/api/v1/owner-dashboard/priority-perks/config` | Update tier thresholds | Owner |
| `GET` | `/api/v1/owner-dashboard/priority-perks/history` | Get config change history | Owner |

### Messaging

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/messages/conversations` | Get conversations | Yes |
| `GET` | `/api/v1/messages/conversation/:id` | Get messages | Yes |
| `POST` | `/api/v1/messages/send` | Send message | Yes |
| `POST` | `/api/v1/messages/conversation/appointment` | Create for appointment | Yes |
| `POST` | `/api/v1/messages/conversation/support` | Create support chat | Yes |
| `POST` | `/api/v1/messages/conversation/cleaner-client` | Create cleaner-client chat | Yes |
| `POST` | `/api/v1/messages/conversation/hr-direct` | Create HR direct chat | Owner/HR |
| `POST` | `/api/v1/messages/conversation/group` | Create group chat | Yes |
| `POST` | `/api/v1/messages/broadcast` | Broadcast message | Owner |
| `GET` | `/api/v1/messages/unread-count` | Get unread count | Yes |
| `POST` | `/api/v1/messages/:id/react` | Add reaction | Yes |
| `DELETE` | `/api/v1/messages/:id/react` | Remove reaction | Yes |
| `POST` | `/api/v1/messages/:id/report` | Report suspicious message | Yes |
| `POST` | `/api/v1/messages/mark-read/:conversationId` | Mark messages read | Yes |
| `POST` | `/api/v1/messages/mark-all-read` | Mark all messages read | Yes |
| `DELETE` | `/api/v1/messages/:id` | Delete message | Yes |
| `POST` | `/api/v1/messages/conversation/:id/participants` | Add participant | Yes |
| `PATCH` | `/api/v1/messages/conversation/:id/title` | Update conversation title | Yes |

### Suspicious Activity

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/suspicious-activity/reports` | Get all reports | Owner/HR |
| `GET` | `/api/v1/suspicious-activity/reports/:id` | Get report details | Owner/HR |
| `PATCH` | `/api/v1/suspicious-activity/reports/:id` | Update report status | Owner/HR |
| `POST` | `/api/v1/suspicious-activity/warn/:userId` | Issue warning | Owner/HR |
| `POST` | `/api/v1/suspicious-activity/freeze/:userId` | Freeze account | Owner/HR |
| `GET` | `/api/v1/suspicious-activity/user/:userId/history` | Get user report history | Owner/HR |

### HR Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/hr-dashboard/pending-disputes` | Get pending disputes | Owner/HR |
| `GET` | `/api/v1/hr-dashboard/dispute/:id` | Get dispute details | Owner/HR |
| `POST` | `/api/v1/hr-dashboard/dispute/:id/decide` | Decide dispute | Owner/HR |
| `GET` | `/api/v1/hr-dashboard/stats` | Get HR statistics | Owner/HR |
| `GET` | `/api/v1/hr-dashboard/support-conversations` | Get support conversations | Owner/HR |

### Owner Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/owner-dashboard/financial-summary` | Financial overview | Owner |
| `GET` | `/api/v1/owner-dashboard/user-analytics` | User statistics | Owner |
| `GET` | `/api/v1/owner-dashboard/appointments-analytics` | Appointment stats | Owner |
| `GET` | `/api/v1/owner-dashboard/business-metrics` | Business KPIs | Owner |
| `GET` | `/api/v1/owner-dashboard/settings` | Platform settings | Owner |
| `PUT` | `/api/v1/owner-dashboard/settings/notification-email` | Update notification email | Owner |
| `POST` | `/api/v1/owner-dashboard/withdraw` | Request withdrawal | Owner |
| `GET` | `/api/v1/owner-dashboard/stripe-balance` | Get Stripe balance | Owner |

### Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/notifications` | Get notifications | Yes |
| `GET` | `/api/v1/notifications/unread-count` | Get unread count | Yes |
| `POST` | `/api/v1/notifications/:id/read` | Mark as read | Yes |
| `POST` | `/api/v1/notifications/mark-all-read` | Mark all read | Yes |
| `DELETE` | `/api/v1/notifications/:id` | Delete notification | Yes |
| `DELETE` | `/api/v1/notifications/clear-all` | Clear all notifications | Yes |

### Push Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/push-notifications/register-token` | Register Expo token | Yes |
| `DELETE` | `/api/v1/push-notifications/remove-token` | Remove token (logout) | Yes |
| `GET` | `/api/v1/push-notifications/preferences` | Get preferences | Yes |
| `PATCH` | `/api/v1/push-notifications/preferences` | Update preferences | Yes |
| `POST` | `/api/v1/push-notifications/snooze-supply-reminder` | Snooze reminders | Cleaner |

### Terms & Conditions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/terms/current/:type` | Get current terms | No |
| `GET` | `/api/v1/terms/check` | Check acceptance status | Yes |
| `POST` | `/api/v1/terms/accept` | Accept terms | Yes |
| `POST` | `/api/v1/terms` | Create new version | Owner |
| `PATCH` | `/api/v1/terms/:id/publish` | Publish version | Owner |
| `GET` | `/api/v1/terms/versions/:type` | Get version history | Owner |

### Checklist

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/checklist/current` | Get current checklist | Yes |
| `GET` | `/api/v1/checklist/draft` | Get draft checklist | Owner |
| `PUT` | `/api/v1/checklist/draft` | Update draft | Owner |
| `POST` | `/api/v1/checklist/publish` | Publish checklist | Owner |
| `GET` | `/api/v1/checklist/versions` | Get version history | Owner |
| `POST` | `/api/v1/checklist/revert/:version` | Revert to version | Owner |
| `POST` | `/api/v1/checklist/load-template` | Load default template | Owner |

### Applications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/applications` | Submit application | No |
| `GET` | `/api/v1/applications` | Get all applications | Owner/HR |
| `GET` | `/api/v1/applications/pending` | Get pending applications | Owner/HR |
| `GET` | `/api/v1/applications/:id` | Get application details | Owner/HR |
| `PATCH` | `/api/v1/applications/:id/approve` | Approve application | Owner/HR |
| `PATCH` | `/api/v1/applications/:id/reject` | Reject application | Owner/HR |
| `POST` | `/api/v1/applications/:id/hire` | Hire applicant | Owner/HR |
| `PATCH` | `/api/v1/applications/:id/notes` | Update application notes | Owner/HR |

### Conflict Resolution Center

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/conflicts/queue` | Get all conflicts and appeals queue | Owner/HR |
| `GET` | `/api/v1/conflicts/case/:id` | Get full case details | Owner/HR |
| `GET` | `/api/v1/conflicts/case/:id/evidence` | Get evidence gallery | Owner/HR |
| `GET` | `/api/v1/conflicts/case/:id/messages` | Get message thread | Owner/HR |
| `GET` | `/api/v1/conflicts/case/:id/audit-trail` | Get audit trail | Owner/HR |
| `GET` | `/api/v1/conflicts/case/:id/financial-breakdown` | Get financial summary | Owner/HR |
| `POST` | `/api/v1/conflicts/case/:id/note` | Add internal note | Owner/HR |
| `POST` | `/api/v1/conflicts/case/:id/resolve` | Resolve case | Owner/HR |
| `GET` | `/api/v1/conflicts/stats` | Get conflict statistics | Owner/HR |

### Cancellation Appeals

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/cancellation-appeals` | Submit appeal | Yes |
| `GET` | `/api/v1/cancellation-appeals/my-appeals` | Get user's appeals | Yes |
| `GET` | `/api/v1/cancellation-appeals/:id` | Get appeal details | Yes |
| `GET` | `/api/v1/cancellation-appeals/queue` | Get appeals queue | Owner/HR |
| `POST` | `/api/v1/cancellation-appeals/:id/review` | Submit HR decision | Owner/HR |
| `GET` | `/api/v1/cancellation-appeals/stats` | Get appeal statistics | Owner/HR |

### Demo Accounts (Preview as Role)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/v1/demo-accounts` | Get demo accounts | Owner |
| `GET` | `/api/v1/demo-accounts/roles` | Get available roles | Owner |
| `POST` | `/api/v1/demo-accounts/enter/:role` | Enter preview mode | Owner |
| `POST` | `/api/v1/demo-accounts/exit` | Exit preview mode | Owner |
| `GET` | `/api/v1/demo-accounts/check/:role` | Check demo account exists | Owner |

### Internal Analytics

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/analytics/track` | Record analytics event | Yes |
| `GET` | `/api/v1/analytics/dashboard` | Get combined dashboard stats | Owner |
| `GET` | `/api/v1/analytics/flow-abandonment` | Get flow abandonment by step | Owner |
| `GET` | `/api/v1/analytics/job-duration` | Get job duration metrics | Owner |
| `GET` | `/api/v1/analytics/offline-usage` | Get offline mode statistics | Owner |
| `GET` | `/api/v1/analytics/disputes` | Get dispute frequency | Owner |
| `GET` | `/api/v1/analytics/pay-overrides` | Get pay override statistics | Owner |

---

## Database

### Models (60 Total)

#### Core Models

| Model | Description |
|-------|-------------|
| `User` | All user accounts with PII encryption, account status, and role tracking |
| `UserHomes` | Properties with encrypted address, access codes, and configuration |
| `UserAppointments` | Appointments with multi-cleaner support and business employee assignments |
| `UserBills` | Homeowner billing records (appointment + cancellation fees) |
| `UserTermsAcceptance` | Terms and privacy policy acceptance tracking |
| `UserIntroApplication` | Cleaner job applications with comprehensive info |

#### Business & Employment Models

| Model | Description |
|-------|-------------|
| `BusinessEmployee` | Employees of business owners with availability and pay settings |
| `EmployeeJobAssignment` | Job assignments to employees with pay tracking |
| `EmployeePayChangeLog` | Audit trail for pay rate changes |
| `CleanerClient` | Business owner to client relationships with invitation flow |

#### Multi-Cleaner Models

| Model | Description |
|-------|-------------|
| `MultiCleanerJob` | Multi-cleaner job tracking with slot management |
| `CleanerJobOffer` | Job offers sent to cleaners for multi-cleaner jobs |
| `CleanerJobCompletion` | Individual cleaner completion tracking |
| `CleanerRoomAssignment` | Room assignments for multi-cleaner jobs |

#### Preferred Cleaner Models

| Model | Description |
|-------|-------------|
| `HomePreferredCleaner` | Preferred cleaner relationships per home |
| `CleanerPreferredPerks` | Cleaner tier status and earned perks |
| `PreferredPerksConfig` | Owner-configurable tier thresholds and bonuses |
| `PreferredPerksConfigHistory` | Audit trail of tier configuration changes |
| `CleanerAvailabilityConfig` | Cleaner availability windows and blackout dates |

#### Financial Models

| Model | Description |
|-------|-------------|
| `Payment` | Complete payment transaction audit trail |
| `Payout` | Cleaner payouts with preferred bonus tracking |
| `PlatformEarnings` | Aggregated platform earnings |
| `OwnerWithdrawal` | Platform owner withdrawal requests |
| `StripeConnectAccount` | Stripe Connect account status tracking |
| `PricingConfig` | Platform pricing configuration |

#### Communication Models

| Model | Description |
|-------|-------------|
| `Conversation` | Message conversations (appointment, support, group) |
| `ConversationParticipant` | Users in conversations |
| `Message` | Individual messages with content |
| `MessageReaction` | Emoji reactions on messages |
| `MessageReadReceipt` | Read status tracking |
| `Notification` | In-app notifications with types and actions |
| `SuspiciousActivityReport` | Flagged messages for moderation |

#### Scheduling Models

| Model | Description |
|-------|-------------|
| `RecurringSchedule` | Weekly/biweekly/monthly schedules with pause support |
| `CalendarSync` | iCal feed configurations with platform detection |
| `UserPendingRequests` | Pending appointment requests |

#### Review & Compliance Models

| Model | Description |
|-------|-------------|
| `UserReviews` | Bidirectional reviews with multi-aspect ratings |
| `HomeSizeAdjustmentRequest` | Home size dispute requests with approval workflow |
| `HomeSizeAdjustmentPhoto` | Photo evidence for disputes |
| `GuestNotLeftReport` | Guest-not-left scenarios with GPS verification |

#### Tax & Legal Models

| Model | Description |
|-------|-------------|
| `TaxInfo` | W-9 information with encrypted TIN |
| `TaxDocument` | 1099-NEC documents with IRS filing tracking |
| `TermsAndConditions` | Terms versions with PDF/text support |

#### Program Models

| Model | Description |
|-------|-------------|
| `IncentiveConfig` | Cleaner and homeowner incentive configuration |
| `ReferralConfig` | Referral program configuration |
| `Referral` | Individual referral tracking with status workflow |

#### Checklist & Photo Models

| Model | Description |
|-------|-------------|
| `ChecklistVersion` | Published checklist versions |
| `ChecklistDraft` | Work-in-progress checklist drafts |
| `ChecklistSection` | Checklist sections |
| `ChecklistItem` | Individual checklist items |
| `JobPhoto` | Before/after job photos |

#### Job Flow Models

| Model | Description |
|-------|-------------|
| `AppointmentJobFlow` | Job flow state per appointment |
| `CustomJobFlow` | Custom job flow templates |
| `CustomJobFlowChecklist` | Checklist associations for custom flows |
| `ClientJobFlowAssignment` | Client-specific job flow assignments |

#### Conflict & Appeals Models

| Model | Description |
|-------|-------------|
| `CancellationAppeal` | Cancellation appeal requests with HR review workflow |
| `CancellationAuditLog` | Immutable audit log for cancellation-related actions |
| `JobLedger` | Double-entry accounting for job-related financial transactions |

#### Analytics Models

| Model | Description |
|-------|-------------|
| `AnalyticsEvent` | Event tracking for flows, job duration, offline usage, disputes, pay overrides |

### Migrations

```bash
# Run all migrations
npx sequelize-cli db:migrate

# Undo last migration
npx sequelize-cli db:migrate:undo

# Create new migration
npx sequelize-cli migration:generate --name add-new-feature
```

### Seeders

Seed the database with initial required data:

```bash
# Run all seeders (recommended order)
npx sequelize-cli db:seed --seed ownerSeeder.js
npx sequelize-cli db:seed --seed termsAndConditionsSeeder.js
npx sequelize-cli db:seed --seed privacyPolicySeeder.js
npx sequelize-cli db:seed --seed cleanerChecklistSeeder.js

# Or run all seeders at once
npx sequelize-cli db:seed:all

# Undo last seeder
npx sequelize-cli db:seed:undo

# Undo all seeders
npx sequelize-cli db:seed:undo:all
```

| Seeder | Description | Required |
|--------|-------------|----------|
| `ownerSeeder.js` | Creates initial platform owner account. Requires `OWNER1_PASSWORD` environment variable. | **Yes** |
| `termsAndConditionsSeeder.js` | Seeds Terms of Service for homeowners and Independent Contractor Agreement for cleaners. | **Yes** |
| `privacyPolicySeeder.js` | Seeds the comprehensive Privacy Policy document. | **Yes** |
| `cleanerChecklistSeeder.js` | Seeds default cleaning checklist with 10 sections (Kitchen, Bathrooms, Bedrooms, Living Areas, Dining Room, Entryway & Hallways, Home Office, Laundry Room, General Tasks, Final Walkthrough) and detailed items with pro tips. | Recommended |

**Note:** The `ownerSeeder.js` requires the `OWNER1_PASSWORD` environment variable to be set before running:

```bash
# Add to .env file
OWNER1_PASSWORD=your_secure_owner_password

# Then run the seeder
npx sequelize-cli db:seed --seed ownerSeeder.js
```

---

## Services

### EncryptionService

Handles PII encryption/decryption using AES-256-CBC:

```javascript
const EncryptionService = require('./services/EncryptionService');

// Encrypt sensitive data
const encrypted = EncryptionService.encrypt('sensitive-data');

// Decrypt data
const decrypted = EncryptionService.decrypt(encrypted);

// Create searchable hash for encrypted email lookups
const hash = EncryptionService.hash('email@example.com');
```

### CalendarSyncService

Handles iCal parsing and appointment creation:

```javascript
const { syncSingleCalendar, syncAllCalendars } = require('./services/calendarSyncService');

// Sync a single calendar
const result = await syncSingleCalendar(calendarSyncId);

// Sync all active calendars
const results = await syncAllCalendars();
```

### InvitationService

Handles business owner client invitations:

```javascript
const InvitationService = require('./services/InvitationService');

// Send client invitation
await InvitationService.sendInvitation({
  cleanerId,
  clientEmail,
  clientName,
  homeDetails
});
```

### ReferralService

Manages referral codes and rewards:

```javascript
const ReferralService = require('./services/ReferralService');

// Generate referral code for user
const code = await ReferralService.generateReferralCode(user);

// Validate and apply referral
await ReferralService.applyReferral(userId, referralCode);
```

### IncentiveService

Handles incentive qualification and application:

```javascript
const IncentiveService = require('./services/IncentiveService');

// Check eligibility
const eligible = await IncentiveService.checkCleanerEligibility(cleanerId);

// Apply discount
const discount = await IncentiveService.calculateDiscount(appointmentId);
```

### CalculatePrice

Dynamic pricing calculation:

```javascript
const CalculatePrice = require('./services/CalculatePrice');

// Calculate price for appointment
const price = await CalculatePrice.calculate({
  numBeds: 3,
  numBaths: 2,
  numHalfBaths: 1,
  sheets: true,
  towels: true,
  timeWindow: '10-3'
});
```

### TaxDocumentService

Generates tax documents for contractors:

```javascript
const TaxDocumentService = require('./services/TaxDocumentService');

// Generate 1099-NEC
const form = await TaxDocumentService.generate1099NECData(userId, 2024);

// Get tax filing deadlines
const deadlines = TaxDocumentService.getTaxDeadlines(2024);
```

### SuspiciousContentDetector

Detects suspicious content in messages:

```javascript
const SuspiciousContentDetector = require('./services/SuspiciousContentDetector');

// Check message for suspicious content
const result = SuspiciousContentDetector.analyze(messageText);
// Returns: { isSuspicious: true, reasons: ['phone_number', 'email'] }
```

### BusinessEmployeeService

Manages business employee lifecycle:

```javascript
const BusinessEmployeeService = require('./services/BusinessEmployeeService');

// Invite new employee
await BusinessEmployeeService.inviteEmployee(ownerId, {
  email, firstName, lastName, payType, payRate
});

// Get employee assignments
const assignments = await BusinessEmployeeService.getEmployeeAssignments(employeeId);
```

### MultiCleanerService

Handles multi-cleaner job logic:

```javascript
const MultiCleanerService = require('./services/MultiCleanerService');

// Check if home requires multiple cleaners
const isMultiCleaner = MultiCleanerService.isLargeHome(numBeds, numBaths);

// Create multi-cleaner job
const job = await MultiCleanerService.createJob(appointmentId, cleanerCount);

// Send offers to cleaners
await MultiCleanerService.sendOffers(jobId, cleanerIds);
```

### PreferredCleanerPerksService

Calculates tier bonuses and perks:

```javascript
const PreferredCleanerPerksService = require('./services/PreferredCleanerPerksService');

// Get cleaner's current tier
const tier = await PreferredCleanerPerksService.getCleanerTier(cleanerId);

// Calculate bonus for a job
const bonus = await PreferredCleanerPerksService.calculateBonus(cleanerId, jobAmount);

// Check if cleaner has faster payouts
const hasFasterPayouts = await PreferredCleanerPerksService.hasFasterPayouts(cleanerId);
```

### CleanerAvailabilityService

Manages cleaner availability and overbooking safeguards:

```javascript
const CleanerAvailabilityService = require('./services/CleanerAvailabilityService');

// Check if cleaner is available for a date
const available = await CleanerAvailabilityService.isAvailable(cleanerId, date);

// Get cleaner's job count for date
const count = await CleanerAvailabilityService.getDailyJobCount(cleanerId, date);
```

### LastMinuteNotificationService

Handles urgent notifications for last-minute bookings (within 48 hours):

```javascript
const LastMinuteNotificationService = require('./services/LastMinuteNotificationService');

// Find cleaners within radius of property
const nearbyCleaners = await LastMinuteNotificationService.findNearbyCleaners(
  homeLat, homeLon, radiusMiles
);

// Send urgent notifications (push, email, in-app) to nearby cleaners
await LastMinuteNotificationService.notifyNearbyCleaners(appointment, home, io);
```

**Features:**
- Geo-distance filtering using `geoUtils.calculateDistance()`
- Multi-channel delivery: push notifications, email, in-app, and WebSocket
- Cleaners sorted by distance (closest first)
- Configurable notification radius (default 25 miles)

### GuestNotLeftService

Handles guest-not-left scenarios:

```javascript
const GuestNotLeftService = require('./services/GuestNotLeftService');

// Report guest not left with GPS verification
await GuestNotLeftService.reportGuestNotLeft(appointmentId, cleanerId, {
  latitude, longitude
});

// Resolve a report
await GuestNotLeftService.resolveReport(reportId, resolution);
```

### Email & Push Notifications

```javascript
const Email = require('./services/sendNotifications/EmailClass');
const PushNotification = require('./services/sendNotifications/PushNotificationClass');

// Send email
await Email.sendAppointmentConfirmation(user, appointment);

// Send push notification
await PushNotification.sendPushNewMessage(token, userName, senderName, preview);
```

### ConflictResolutionService

Unified conflict and appeal case management:

```javascript
const ConflictResolutionService = require('./services/ConflictResolutionService');

// Get all cases for HR queue
const cases = await ConflictResolutionService.getAllCases({ status: 'pending' });

// Get full case details
const caseDetail = await ConflictResolutionService.getCaseDetails(caseId);

// Resolve a case
await ConflictResolutionService.resolveCase(caseId, {
  resolution: 'approved',
  refundAmount: 50.00,
  payoutAmount: 35.00,
  notes: 'Valid appeal, partial refund granted'
});
```

### AppealService

Handles cancellation appeal workflow:

```javascript
const AppealService = require('./services/AppealService');

// Submit an appeal
const appeal = await AppealService.submitAppeal({
  appointmentId,
  userId,
  reason: 'Emergency situation',
  evidence: ['photo1.jpg'],
  requestedOutcome: 'penalty_waiver'
});

// Review and decide on appeal (HR)
await AppealService.reviewAppeal(appealId, {
  decision: 'approved',
  hrNotes: 'Emergency verified',
  refundPercentage: 100
});
```

### JobLedgerService

Double-entry accounting for job finances:

```javascript
const JobLedgerService = require('./services/JobLedgerService');

// Create ledger entry
await JobLedgerService.createEntry({
  appointmentId,
  entryType: 'platform_fee',
  debitAccount: 'platform_receivable',
  creditAccount: 'platform_revenue',
  amount: 15.00
});

// Get job financial summary
const summary = await JobLedgerService.getJobFinancialSummary(appointmentId);

// Reconcile with Stripe
await JobLedgerService.reconcileWithStripe(appointmentId, stripePaymentId);
```

### CancellationAuditService

Immutable audit logging for cancellations:

```javascript
const CancellationAuditService = require('./services/CancellationAuditService');

// Log an event
await CancellationAuditService.logEvent({
  appointmentId,
  eventType: 'cancellation_initiated',
  actorId: userId,
  actorType: 'homeowner',
  changes: { status: 'cancelled', reason: 'emergency' }
});

// Get audit trail
const trail = await CancellationAuditService.getAuditTrail(appointmentId);
```

### DemoAccountService

Preview mode session management for platform owners:

```javascript
const DemoAccountService = require('./services/DemoAccountService');

// Get available demo accounts
const accounts = await DemoAccountService.getDemoAccounts();

// Create preview session
const session = await DemoAccountService.createPreviewSession(ownerId, 'cleaner');
// Returns: { success, token, user, previewRole, originalOwnerId }

// End preview session
const restored = await DemoAccountService.endPreviewSession(ownerId);
```

### AnalyticsService

Platform analytics tracking and aggregation:

```javascript
const AnalyticsService = require('./services/AnalyticsService');

// Track an event
await AnalyticsService.trackEvent({
  eventType: 'flow_step_completed',
  eventCategory: 'flow_abandonment',
  userId,
  sessionId,
  metadata: { flowName: 'job_completion', stepName: 'before_photos', stepNumber: 1, totalSteps: 5 }
});

// Get dashboard stats (owner only)
const stats = await AnalyticsService.getDashboardStats(startDate, endDate);

// Get flow abandonment by step
const flowStats = await AnalyticsService.getFlowAbandonmentStats('job_completion', startDate, endDate);

// Get job duration statistics
const durationStats = await AnalyticsService.getJobDurationStats(startDate, endDate);

// Get offline usage metrics
const offlineStats = await AnalyticsService.getOfflineUsageStats(startDate, endDate);

// Get dispute frequency
const disputeStats = await AnalyticsService.getDisputeStats(startDate, endDate);

// Get pay override statistics
const overrideStats = await AnalyticsService.getPayOverrideStats(startDate, endDate);
```

---

## Cron Jobs

| Schedule | Job | Description |
|----------|-----|-------------|
| `*/15 * * * *` | Backup Cleaner Timeout | Escalates unresponded backup cleaner notifications |
| `*/30 * * * *` | Multi-Cleaner Fill Monitor | Escalates unfilled multi-cleaner job slots |
| `*/10 * * * *` | Multi-Cleaner Offer Expiration | Expires unanswered job offers |
| `0 0 * * *` | Booking Expiration | Expires old pending bookings (48-hour window) |
| `0 0 * * *` | Payment Retry | Retries failed payments and sends reminders |
| `0 1 * * *` | Calendar Sync | Syncs all active iCal calendars |
| `0 3 * * 0` | Recurring Generation | Generates appointments from recurring schedules |
| `0 7 * * *` | Supply Reminder | Reminds cleaners to bring supplies for today's appointments |

### Cron Job Details

**Backup Cleaner Timeout** (`BackupCleanerTimeoutJob.js`)
- Processes expired backup cleaner notifications
- Escalates to client when no backup cleaner responds within timeout window
- Timeout configurable per tier via Priority Perks config

**Multi-Cleaner Fill Monitor** (`MultiCleanerFillMonitor.js`)
- Monitors multi-cleaner jobs approaching their date
- Sends escalation notifications if slots are not filled
- Alerts owner/HR for manual intervention

**Multi-Cleaner Offer Expiration** (`MultiCleanerOfferExpiration.js`)
- Expires job offers that haven't been accepted
- Frees up slots for new offers

---

## WebSocket Events

Real-time messaging via Socket.io:

```javascript
// Events emitted by server
socket.emit('new_message', message);
socket.emit('unread_count', count);
socket.emit('user_typing', { conversationId, userId });
socket.emit('new_internal_conversation', conversation);
socket.emit('message_reaction', { messageId, reaction, userId });
socket.emit('message_deleted', { messageId, conversationId });
socket.emit('participant_added', { conversationId, user });
socket.emit('conversation_updated', { conversationId, title });

// Events received by server
socket.on('join_conversation', conversationId);
socket.on('leave_conversation', conversationId);
socket.on('send_message', { conversationId, content, senderId });
socket.on('typing', { conversationId, userId });
socket.on('stop_typing', { conversationId, userId });
socket.on('add_reaction', { messageId, reaction });
socket.on('remove_reaction', { messageId, reaction });
socket.on('mark_read', { conversationId, userId });
```

---

## Testing

```bash
# Run all tests (4504 tests across 172 test suites)
npm test

# Run specific test file
npm test -- __tests__/routes/messages.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Categories

| Category | Tests | Description |
|----------|-------|-------------|
| Authentication | 45 | Login, registration, JWT validation |
| Appointments | 89 | CRUD, assignments, requests, recurring |
| Calendar Sync | 48 | iCal parsing, sync logic |
| Payments | 112 | Stripe intents, capture, refund, billing |
| Stripe Connect | 78 | Account creation, payouts |
| Cleaner Clients | 156 | Business owner client management |
| Pricing | 67 | Dynamic pricing, configuration |
| Incentives | 54 | Qualification, discounts |
| Referrals | 48 | Codes, rewards, tracking |
| Tax Documents | 89 | W-9, 1099-NEC, platform taxes |
| Reviews | 67 | Create, read, summaries, bidirectional |
| Messaging | 234 | Conversations, reactions, suspicious content |
| HR Dashboard | 78 | Disputes, reports |
| Owner Dashboard | 89 | Financial, analytics, settings |
| Push Notifications | 56 | Token registration, preferences |
| Terms & Conditions | 78 | Version management, acceptance |
| Checklist | 45 | Editor, publishing, versions |
| Applications | 56 | Submission, review, approval |
| Job Photos | 67 | Upload, access control, completion |
| Home Size Disputes | 45 | Filing, evidence, resolution |
| Preferred Cleaners | 34 | Assignment, client management |
| Integration | 67 | Full payment flows, e2e |
| Services | 156 | All service unit tests |
| Serializers | 85 | PII decryption, decimal parsing, field mapping |
| Route Ordering | 12 | Express route order validation |
| Last-Minute Booking | 35 | Threshold detection, notifications, fees |
| Large Business Fees | 18 | Volume-based fee calculation |
| Offline Sync | 28 | Offline mode, conflict resolution |
| Preferred Cleaner Flow | 17 | End-to-end preferred cleaner integration |
| Conflict Resolution | 56 | Router, service, case management |
| Cancellation Appeals | 67 | Appeal workflow, HR review, decisions |
| Job Ledger | 45 | Double-entry accounting, reconciliation |
| Demo Accounts | 88 | Router, service, preview sessions |
| Internal Analytics | 89 | Event tracking, dashboard stats, aggregations |
| Multi-Cleaner Router | 76 | Job creation, offers, room assignments, completions |
| **Total** | **4504** | 172 test suites |

---

## Security

### Authentication & Authorization
- JWT tokens with 24-hour expiration
- Role-based access control (homeowner, cleaner, HR, owner)
- Password hashed with bcrypt (12 rounds)
- Middleware validates permissions per route
- Account freezing for policy violations
- Warning system with violation tracking

### Data Protection
- PII encrypted at rest with AES-256-CBC (names, emails, tax IDs)
- Searchable encrypted fields via hash lookup
- Stripe webhook signature verification
- PCI-compliant payment handling via Stripe Elements

### Content Moderation
- Automatic suspicious content detection (phone numbers, emails, off-platform offers)
- User reporting system for inappropriate content
- Warning and account freeze capabilities
- False report tracking

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
| `ACCOUNT_FROZEN` | 403 | Account has been frozen |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `STRIPE_ERROR` | 400 | Payment processing error |
| `SYNC_ERROR` | 500 | Calendar sync failed |
| `OUT_OF_SERVICE_AREA` | 400 | Home outside service area |

---

## Contributing

See the main [README](../README.md) for contribution guidelines.

---

<div align="center">

**Part of the Kleanr Platform**

[Main Documentation](../README.md) | [Client Documentation](../client/README.md)

</div>
