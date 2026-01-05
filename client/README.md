<div align="center">

# Kleanr Mobile App

![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK_52-000020?style=for-the-badge&logo=expo&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Tests](https://img.shields.io/badge/Tests-1217_Passing-brightgreen?style=for-the-badge)

**Cross-platform mobile application for the Kleanr cleaning service platform**

[Getting Started](#-getting-started) | [Features](#-features) | [Architecture](#-architecture) | [Testing](#-testing)

</div>

---

## Overview

The Kleanr mobile app is a React Native application built with Expo that provides a comprehensive experience for all user types: homeowners booking cleanings, cleaners managing schedules and earnings, business owners managing employees and clients, and platform owners overseeing operations.

**Key Features:**
- Full offline-first architecture with background sync
- Multi-user role support (6 user types)
- Real-time messaging with WebSocket
- Stripe payment integration with Apple Pay/Google Pay
- iCal calendar sync for vacation rentals
- Photo documentation with offline capture
- Push notifications via Expo

---

## Getting Started

### Prerequisites

- Node.js v18.x or higher
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- Expo Go app (for physical device testing)

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

| Key | Platform | Description |
|-----|----------|-------------|
| `w` | Web | Open in browser |
| `i` | iOS | Open in iOS Simulator |
| `a` | Android | Open in Android Emulator |

Or scan the QR code with **Expo Go** on your device.

### Environment Setup

Update the API base URL in `src/services/config.js`:

```javascript
export const API_BASE = "http://localhost:3000/api/v1";
```

---

## Features

### User Types

<table>
<tr>
<td width="50%" valign="top">

#### Homeowners
- Book cleaning appointments
- Manage multiple properties
- Calendar sync (Airbnb, VRBO, Booking.com)
- Secure Stripe payments
- Real-time messaging with cleaners
- Recurring schedule setup
- Bill management & history
- Multi-aspect cleaner reviews
- Preferred cleaner selection
- Respond to size adjustment claims

</td>
<td width="50%" valign="top">

#### Cleaners
- View and request available jobs
- Photo documentation (before/after)
- Digital cleaning checklists (73 tasks)
- Earnings dashboard with charts
- Stripe Connect payouts
- W-9 submission & 1099-NEC access
- Preferred cleaner tier status
- Guest-not-left reporting
- Home size adjustment filing
- Supply reminders with snooze

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### Business Owners
- Employee invitation & management
- Team calendar view
- Job assignment to employees
- Payroll tracking (hourly/flat rate)
- Client invitation via email
- Direct client management
- Custom per-home pricing
- Financial dashboard
- Team messaging
- Recurring schedule setup

</td>
<td width="50%" valign="top">

#### Business Employees
- Personal job dashboard
- Assigned job list & calendar
- Earnings tracking
- Availability settings
- Photo & checklist workflow
- Coworker messaging
- Job completion with pay tracking
- Self-assignment (if owner)
- Marketplace job pickup (if enabled)

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### HR Staff
- Dispute management dashboard
- Suspicious activity review
- Photo evidence examination
- User warning system
- Account freezing
- Support conversation handling
- Application processing

</td>
<td width="50%" valign="top">

#### Platform Owner/Admin
- Financial dashboard & analytics
- Employee management
- Pricing configuration
- Incentive & referral programs
- Preferred perks configuration
- Checklist editor with versioning
- Terms & Conditions management
- Broadcast messaging
- Tax reporting
- Platform withdrawals

</td>
</tr>
</table>

### Core Features

| Feature | Description |
|---------|-------------|
| **Offline Mode** | Full offline-first architecture with local database, background sync, conflict resolution, and photo queuing |
| **Calendar Sync** | Connect Airbnb, VRBO, Booking.com calendars. Auto-create cleanings after checkouts with configurable offset |
| **Photo Documentation** | Before/after photos with room-by-room organization, offline capture support, and automatic sync |
| **Cleaning Checklists** | Digital task lists with 73 tasks across 10 sections, progress tracking, and completion percentage |
| **Real-time Messaging** | WebSocket-powered chat with message reactions, read receipts, typing indicators, and unread badges |
| **Stripe Payments** | Apple Pay, Google Pay, and card payments with saved payment methods |
| **Review System** | Multi-aspect bidirectional reviews (cleaning quality, punctuality, professionalism, communication) |
| **Push Notifications** | Expo push notifications with preferences per notification type |
| **Preferred Tiers** | Display cleaner tier status (Bronze/Silver/Gold/Platinum) with bonus tracking |

---

## Architecture

### Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── account/              # Account settings
│   │   ├── admin/                # Admin/owner features
│   │   │   ├── CleanerApplications/
│   │   │   ├── AssignAppointments/
│   │   │   └── forms/
│   │   ├── appointments/         # Booking & scheduling
│   │   ├── business/             # Business signup & upgrade
│   │   ├── businessEmployee/     # Employee portal
│   │   │   ├── EmployeeDashboard.js
│   │   │   ├── EmployeeJobList.js
│   │   │   ├── EmployeeCalendar.js
│   │   │   ├── EmployeeEarnings.js
│   │   │   └── CoworkerMessaging.js
│   │   ├── businessOwner/        # Business owner dashboard
│   │   │   ├── BusinessOwnerDashboard.js
│   │   │   ├── EmployeeManagement.js
│   │   │   ├── JobAssignment.js
│   │   │   ├── FinancialsScreen.js
│   │   │   ├── PayrollScreen.js
│   │   │   └── BusinessOwnerCalendar.js
│   │   ├── calendarSync/         # iCal integration
│   │   ├── cleaner/              # Cleaner dashboard
│   │   ├── client/               # Homeowner views
│   │   ├── editHome/             # Home configuration
│   │   ├── employeeAssignments/  # Job assignments & photos
│   │   │   ├── jobPhotos/
│   │   │   │   ├── JobCompletionFlow.js
│   │   │   │   ├── JobPhotoCapture.js
│   │   │   │   ├── OfflineJobPhotoCapture.js
│   │   │   │   └── CleaningChecklist.js
│   │   │   ├── lists/
│   │   │   └── tiles/
│   │   ├── hr/                   # HR staff features
│   │   ├── incentives/           # Incentive banners
│   │   ├── messaging/            # Chat system
│   │   ├── modals/               # Modal components
│   │   ├── multiCleaner/         # Multi-cleaner support
│   │   ├── notifications/        # Notification feed
│   │   ├── offline/              # Offline mode UI
│   │   │   ├── OfflineBanner.js
│   │   │   ├── SyncStatusIndicator.js
│   │   │   ├── ManualSyncButton.js
│   │   │   └── OfflineLimitWarning.js
│   │   ├── onboarding/           # User onboarding
│   │   ├── owner/                # Owner dashboard
│   │   │   ├── OwnerDashboard.js
│   │   │   ├── TermsEditor.js
│   │   │   ├── PricingManagement.js
│   │   │   ├── IncentivesManagement.js
│   │   │   ├── ReferralManagement.js
│   │   │   └── ChecklistEditor/
│   │   ├── payments/             # Stripe integration
│   │   ├── pricing/              # Price display
│   │   ├── referrals/            # Referral management
│   │   ├── reviews/              # Review components
│   │   ├── tax/                  # Tax documents
│   │   ├── terms/                # Terms & Conditions
│   │   ├── tiles/                # Reusable UI tiles
│   │   └── userAuthentication/   # Login/registration
│   │
│   ├── context/
│   │   ├── AuthContext.js        # Auth state provider
│   │   ├── PricingContext.js     # Pricing configuration
│   │   └── UserContext.js        # User state
│   │
│   ├── hooks/
│   │   └── useCountdown.js       # Countdown timer hook
│   │
│   └── services/
│       ├── fetchRequests/        # API service classes
│       │   ├── AppointmentClass.js
│       │   ├── ApplicationClass.js
│       │   ├── BillingService.js
│       │   ├── BusinessEmployeeService.js
│       │   ├── BusinessOwnerService.js
│       │   ├── ChecklistService.js
│       │   ├── ClientDashboardService.js
│       │   ├── CleanerClientService.js
│       │   ├── HRDashboardService.js
│       │   ├── IncentivesService.js
│       │   ├── MessageClass.js
│       │   ├── NotificationsService.js
│       │   ├── OwnerDashboardService.js
│       │   ├── PreferredCleanerService.js
│       │   ├── PricingService.js
│       │   ├── ReferralService.js
│       │   ├── ReviewClass.js
│       │   ├── SuspiciousReportsService.js
│       │   └── TaxService.js
│       │
│       ├── offline/              # Offline sync system
│       │   ├── OfflineManager.js
│       │   ├── NetworkMonitor.js
│       │   ├── SyncEngine.js
│       │   ├── ConflictResolver.js
│       │   ├── BackgroundSync.js
│       │   ├── StorageManager.js
│       │   ├── PhotoStorage.js
│       │   ├── OfflineBusinessEmployeeService.js
│       │   ├── OfflineBusinessOwnerService.js
│       │   ├── OfflineMessagingService.js
│       │   └── database/
│       │       ├── index.js
│       │       ├── schema.js
│       │       ├── migrations.js
│       │       └── models/
│       │
│       ├── stripe/               # Stripe integration
│       │   ├── StripeProvider.native.js
│       │   ├── StripeProvider.web.js
│       │   ├── usePaymentSheet.native.js
│       │   └── usePaymentSheet.web.js
│       │
│       ├── styles/               # Design system
│       │   ├── theme.js
│       │   └── [ComponentStyles].js
│       │
│       ├── AuthContext.js
│       ├── SocketContext.js
│       ├── PushNotificationContext.js
│       ├── PushNotificationService.js
│       └── config.js
│
├── __tests__/                    # Test files
├── assets/                       # Images, fonts
└── package.json
```

### Offline Architecture

The app implements a complete offline-first architecture:

```
┌─────────────────────────────────────────────────────┐
│                    App Layer                         │
├─────────────────────────────────────────────────────┤
│  OfflineManager    NetworkMonitor    SyncEngine     │
├─────────────────────────────────────────────────────┤
│              Local Database (SQLite)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │OfflineJob│ │OfflineMsg│ │SyncQueue │            │
│  └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────┤
│  PhotoStorage    ConflictResolver   BackgroundSync  │
└─────────────────────────────────────────────────────┘
```

**Key Components:**
- **OfflineManager**: Orchestrates offline functionality
- **NetworkMonitor**: Tracks network connectivity status
- **SyncEngine**: Handles data synchronization when online
- **ConflictResolver**: Resolves sync conflicts
- **PhotoStorage**: Local photo caching and sync
- **SyncQueue**: Queues operations for later sync

### State Management

The app uses React's `useReducer` with Context for global state:

```javascript
const initialState = {
  currentUser: {
    token: null,
    id: null,
    email: null,
    type: null,        // 'cleaner', 'owner1', 'hr', 'businessOwner', 'businessEmployee'
  },
  homes: [],           // User's properties
  appointments: [],    // Scheduled cleanings
  bill: {},            // Current billing info
  cleaningRequests: [], // Pending job requests
  employees: [],       // Business employees (for owners)
};

// Actions
dispatch({ type: 'SET_USER', payload: user });
dispatch({ type: 'ADD_HOME', payload: home });
dispatch({ type: 'UPDATE_APPOINTMENT', payload: appointment });
dispatch({ type: 'SET_EMPLOYEES', payload: employees });
```

### Navigation

React Router Native handles navigation:

```javascript
import { NativeRouter, Route, Routes } from 'react-router-native';

<NativeRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/details/:homeId" element={<PropertyDetails />} />
    <Route path="/calendar-sync/:homeId" element={<CalendarSyncManager />} />
    <Route path="/messages" element={<MessagingHub />} />
    <Route path="/earnings" element={<EarningsDashboard />} />
    <Route path="/business-dashboard" element={<BusinessOwnerDashboard />} />
    <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
  </Routes>
</NativeRouter>
```

---

## API Services

### BusinessOwnerService

```javascript
import BusinessOwnerService from './services/fetchRequests/BusinessOwnerService';

// Get employees
const employees = await BusinessOwnerService.getEmployees(token);

// Invite employee
await BusinessOwnerService.inviteEmployee(token, { email, firstName, lastName, payType, payRate });

// Assign job to employee
await BusinessOwnerService.assignJob(token, employeeId, appointmentId);

// Get team calendar
const calendar = await BusinessOwnerService.getTeamCalendar(token, startDate, endDate);
```

### BusinessEmployeeService

```javascript
import BusinessEmployeeService from './services/fetchRequests/BusinessEmployeeService';

// Get my assignments
const assignments = await BusinessEmployeeService.getMyAssignments(token);

// Get my earnings
const earnings = await BusinessEmployeeService.getMyEarnings(token);

// Complete assignment
await BusinessEmployeeService.completeAssignment(token, assignmentId);

// Update availability
await BusinessEmployeeService.updateAvailability(token, availabilityData);
```

### PreferredCleanerService

```javascript
import PreferredCleanerService from './services/fetchRequests/PreferredCleanerService';

// Get my perk status (cleaner)
const status = await PreferredCleanerService.getMyPerkStatus(token);

// Get tier info
const tiers = await PreferredCleanerService.getPerkTierInfo(token);

// Get my availability config
const config = await PreferredCleanerService.getMyAvailabilityConfig(token);

// Update availability config
await PreferredCleanerService.updateAvailabilityConfig(token, config);
```

### TaxService

```javascript
import TaxService from './services/fetchRequests/TaxService';

// Cleaner: Get tax summary
const summary = await TaxService.getCleanerTaxSummary(token, 2024);

// Cleaner: Get 1099-NEC data
const form = await TaxService.get1099NECData(token, 2024);

// Owner: Get platform tax report
const report = await TaxService.getPlatformTaxReport(token, 2024);
```

### OfflineManager

```javascript
import OfflineManager from './services/offline/OfflineManager';

// Initialize offline support
await OfflineManager.initialize();

// Check if online
const isOnline = OfflineManager.isOnline();

// Queue operation for sync
await OfflineManager.queueOperation('createAppointment', appointmentData);

// Force sync
await OfflineManager.syncNow();

// Get pending operations count
const count = await OfflineManager.getPendingCount();
```

---

## Key Components

### BusinessOwnerDashboard

Main dashboard for business owners:

```javascript
<BusinessOwnerDashboard
  onNavigateToEmployees={() => navigate('/employees')}
  onNavigateToClients={() => navigate('/clients')}
  onNavigateToCalendar={() => navigate('/team-calendar')}
/>
```

**Features:**
- Financial overview (revenue, pending payouts)
- Quick stats (employees, clients, jobs)
- Recent activity feed
- Quick action buttons

### EmployeeDashboard

Dashboard for business employees:

```javascript
<EmployeeDashboard
  onNavigateToJobs={() => navigate('/my-jobs')}
  onNavigateToEarnings={() => navigate('/earnings')}
/>
```

**Features:**
- Today's assignments
- Earnings summary
- Upcoming jobs calendar
- Availability settings

### OfflineBanner

Displays offline status and sync progress:

```javascript
<OfflineBanner
  showSyncButton={true}
  onSyncPress={() => OfflineManager.syncNow()}
/>
```

### JobPhotoCapture (with Offline Support)

Photo documentation with offline capability:

```javascript
<JobPhotoCapture
  appointmentId={appointmentId}
  photoType="before"
  onPhotoAdded={(photo) => handlePhotoAdded(photo)}
  offlineMode={!isOnline}
/>
```

### CleaningChecklist

Digital checklist with 73 tasks across 10 sections:

```javascript
<CleaningChecklist
  home={homeData}
  onProgressUpdate={(percent, completed, total) => {
    console.log(`${percent}% complete (${completed}/${total})`);
  }}
  onChecklistComplete={() => console.log('All tasks done!')}
/>
```

**Sections:**
- Kitchen (15 tasks)
- Bathrooms (18 tasks)
- Bedrooms (15 tasks)
- Living Areas (15 tasks)
- Dining Room (5 tasks)
- Entryway & Hallways (5 tasks)
- Home Office (5 tasks)
- Laundry Room (3 tasks)
- General Tasks (5 tasks)
- Final Walkthrough (3 tasks)

---

## Styling

### Theme System

```javascript
import { colors, spacing, radius, shadows, typography } from './services/styles/theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    ...shadows.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
});
```

### Design Tokens

```javascript
export const colors = {
  primary: '#4A90A4',
  secondary: '#2ECC71',
  background: '#F8F9FA',
  card: '#FFFFFF',
  text: {
    primary: '#1A1A2E',
    secondary: '#6C757D',
  },
  status: {
    success: '#28A745',
    warning: '#FFC107',
    error: '#DC3545',
  },
  tiers: {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
};
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage

# Run specific test file
npm test -- CleaningChecklist.test.js
```

### Test Coverage

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| CalendarSyncManager | 73 | Calendar sync UI, API calls |
| CleaningChecklist | 42 | Checklist interactions |
| TaxService | 24 | All tax API methods |
| ReviewComponents | 54 | Review forms & display |
| EarningsComponents | 12 | Earnings calculations |
| AuthContext | 18 | Authentication flow |
| TermsComponents | 85 | Terms modal, editor, acceptance |
| SignUpForm | 42 | Registration with terms |
| MessagesButton | 20 | Unread badge, notifications |
| TopBar | 25 | Navigation, notification badges |
| ApplicationClass | 23 | Application API methods |
| CreateNewEmployeeForm | 28 | Username generation, form validation |
| BusinessOwnerDashboard | 45 | Business owner features |
| BusinessEmployeeComponents | 38 | Employee portal features |
| OfflineComponents | 56 | Offline mode UI and sync |
| Pricing & Staffing | 15 | Dynamic pricing, config |
| OwnerDashboard | 45 | Owner dashboard, analytics |
| **Total** | **1217** | - |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `expo` | ~52.0.0 | Development platform |
| `react-native` | 0.76.x | Mobile framework |
| `react-router-native` | ^6.x | Navigation |
| `@stripe/stripe-react-native` | ^0.38.x | Payment UI |
| `socket.io-client` | ^4.x | Real-time messaging |
| `react-native-calendars` | ^1.x | Calendar views |
| `react-native-paper` | ^5.x | UI components |
| `@react-native-async-storage/async-storage` | ^1.x | Local persistence |
| `expo-location` | ~17.x | GPS verification |
| `expo-notifications` | ~0.28.x | Push notifications |
| `expo-file-system` | ~17.x | Photo storage |
| `@testing-library/react-native` | ^12.x | Testing utilities |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm test` | Run Jest tests |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in browser |
| `npm run lint` | Run ESLint |

---

## Troubleshooting

### Common Issues

**Metro bundler cache issues:**
```bash
npx expo start --clear
```

**iOS Simulator not launching:**
```bash
# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase all
```

**Android build issues:**
```bash
cd android && ./gradlew clean
```

**Offline sync stuck:**
```javascript
// Force clear sync queue
await OfflineManager.clearSyncQueue();
await OfflineManager.syncNow();
```

**Photo upload failures:**
```javascript
// Check pending photos
const pending = await PhotoStorage.getPendingPhotos();
console.log(`${pending.length} photos pending sync`);
```

---

## Contributing

See the main [README](../README.md) for contribution guidelines.

---

<div align="center">

**Part of the Kleanr Platform**

[Main Documentation](../README.md) | [Server Documentation](../server/README.md)

</div>
