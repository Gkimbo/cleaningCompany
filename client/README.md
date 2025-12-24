<div align="center">

# Kleanr Mobile App

![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Expo](https://img.shields.io/badge/Expo-SDK_52-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Tests](https://img.shields.io/badge/Tests-1217_Passing-brightgreen?style=for-the-badge)

**Cross-platform mobile application for the Kleanr cleaning service platform**

[Getting Started](#-getting-started) | [Features](#-features) | [Architecture](#-architecture) | [Testing](#-testing)

</div>

---

## Overview

The Kleanr mobile app is a React Native application built with Expo that provides a seamless experience for homeowners to book cleanings, cleaners to manage their schedules and earnings, and owners to oversee platform operations.

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

### By User Type

<table>
<tr>
<td width="33%" valign="top">

#### Homeowners
- Book cleaning appointments
- Manage multiple properties
- Calendar sync (Airbnb, VRBO)
- Secure Stripe payments
- Real-time messaging
- Payment history & receipts

</td>
<td width="33%" valign="top">

#### Cleaners
- View assigned jobs
- Photo documentation
- Digital checklists
- Earnings dashboard
- Stripe Connect payouts
- 1099-NEC tax access

</td>
<td width="33%" valign="top">

#### Owners
- Assign cleaners to jobs
- Platform overview
- Broadcast messages
- Process applications
- Tax reporting
- Terms & Conditions editor
- Service area management
- Notification email settings

</td>
</tr>
</table>

### Key Features

| Feature | Description |
|---------|-------------|
| **Calendar Sync** | Connect Airbnb, VRBO, Booking.com calendars. Auto-create cleanings after checkouts. |
| **Photo Documentation** | Before/after photos with room-by-room organization |
| **Cleaning Checklists** | Digital task lists with progress tracking |
| **Real-time Messaging** | WebSocket-powered chat with unread message badges in navigation |
| **Stripe Payments** | Apple Pay, Google Pay, and card payments |
| **Review System** | Multi-aspect cleaner reviews |
| **Notification Badges** | Unread messages and pending applications shown in top bar |
| **Quick Action Dashboard** | Styled quick action buttons for common tasks on cleaner/client dashboards |

---

## Architecture

### Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── account/              # Account settings
│   │   ├── appointments/         # Booking & scheduling
│   │   ├── calendarSync/         # iCal integration
│   │   ├── cleaner/              # Cleaner dashboard
│   │   ├── client/               # Homeowner views
│   │   ├── employeeAssignments/  # Job photos & checklists
│   │   │   └── jobPhotos/
│   │   │       └── CleaningChecklist.js
│   │   ├── owner/                # Owner dashboard
│   │   ├── messaging/            # Chat system
│   │   ├── navBar/               # Navigation
│   │   ├── onboarding/           # User onboarding flow
│   │   ├── payments/             # Stripe integration
│   │   ├── reviews/              # Review components
│   │   ├── tax/                  # Tax documents
│   │   ├── terms/                # Terms & Conditions
│   │   │   ├── TermsModal.js     # Terms acceptance modal
│   │   │   └── TermsAcceptanceScreen.js
│   │   ├── tiles/                # Reusable UI tiles
│   │   ├── userAuthentication/   # Login/registration
│   │   └── HomePage.js           # Landing page & dashboard
│   │
│   └── services/
│       ├── fetchRequests/        # API service classes
│       │   ├── fetchData.js      # General API
│       │   ├── MessageService.js # Messaging API
│       │   ├── OwnerDashboardService.js # Owner dashboard API
│       │   ├── PaymentService.js # Payment API
│       │   └── TaxService.js     # Tax API
│       ├── styles/
│       │   └── theme.js          # Design system
│       ├── AuthContext.js        # Auth state provider
│       ├── SocketContext.js      # WebSocket provider
│       └── config.js             # App configuration
│
├── __tests__/
│   ├── components/               # Component tests
│   │   ├── CalendarSyncManager.test.js
│   │   ├── CleaningChecklist.test.js
│   │   ├── Earnings.test.js
│   │   ├── Bill.test.js
│   │   ├── TermsModal.test.js
│   │   ├── TermsEditor.test.js
│   │   ├── SignUpForm.test.js
│   │   └── ...
│   └── services/                 # Service tests
│       ├── TaxService.test.js
│       ├── AuthContext.test.js
│       └── reducerFunction.test.js
│
├── assets/                       # Images, fonts
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Test setup
└── package.json
```

### State Management

The app uses React's `useReducer` with Context for global state:

```javascript
const initialState = {
  currentUser: {
    token: null,
    id: null,
    email: null,
    type: null,        // 'cleaner', 'owner1', or null (homeowner)
  },
  homes: [],           // User's properties
  appointments: [],    // Scheduled cleanings
  bill: {},           // Current billing info
  cleaningRequests: [], // Pending job requests
};

// Actions
dispatch({ type: 'SET_USER', payload: user });
dispatch({ type: 'ADD_HOME', payload: home });
dispatch({ type: 'UPDATE_APPOINTMENT', payload: appointment });
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
  </Routes>
</NativeRouter>
```

---

## API Services

### TaxService

```javascript
import TaxService from './services/fetchRequests/TaxService';

// Cleaner: Get tax summary
const summary = await TaxService.getCleanerTaxSummary(token, 2024);

// Cleaner: Get 1099-NEC data
const form = await TaxService.get1099NECData(token, 2024);

// Manager: Get platform tax report
const report = await TaxService.getPlatformTaxReport(token, 2024);

// Homeowner: Get payment history
const history = await TaxService.getPaymentHistory(token, 2024);
```

### MessageService

```javascript
import MessageService from './services/fetchRequests/MessageService';

// Get all conversations
const conversations = await MessageService.getConversations(token);

// Get messages in a conversation
const messages = await MessageService.getMessages(token, conversationId);

// Send a message
await MessageService.sendMessage(token, conversationId, content);

// Create support conversation
await MessageService.createSupportConversation(token);
```

### PaymentService

```javascript
import PaymentService from './services/fetchRequests/PaymentService';

// Create payment intent
const intent = await PaymentService.createPaymentIntent(token, {
  amount: 15000, // $150.00
  appointmentId: 123,
});

// Get payment history
const history = await PaymentService.getPaymentHistory(token);

// Get cleaner earnings
const earnings = await PaymentService.getEarnings(token);
```

### OwnerDashboardService

```javascript
import OwnerDashboardService from './services/fetchRequests/OwnerDashboardService';

// Get financial summary
const financial = await OwnerDashboardService.getFinancialSummary(token);

// Get user analytics
const users = await OwnerDashboardService.getUserAnalytics(token);

// Get service areas
const areas = await OwnerDashboardService.getServiceAreas(token);

// Update notification email
await OwnerDashboardService.updateNotificationEmail(token, 'notify@example.com');

// Get owner settings
const settings = await OwnerDashboardService.getSettings(token);
```

---

## Key Components

### CalendarSyncManager

Manages iCal sync connections with vacation rental platforms:

```javascript
<CalendarSyncManager
  homeId={homeId}
  onSyncComplete={(results) => console.log(results)}
/>
```

**Features:**
- Connect Airbnb, VRBO, Booking.com calendars
- Auto-create appointments from checkout dates
- Manual sync trigger
- Sync status and error display

### CleaningChecklist

Digital checklist for cleaners with progress tracking:

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
- General (10 tasks)

### EarningsDashboard

Cleaner earnings and payout management:

```javascript
<EarningsDashboard
  cleanerId={userId}
  showPayoutButton={true}
/>
```

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
| Pricing & Staffing | 15 | Dynamic pricing, config |
| OwnerDashboard | 45 | Owner dashboard, analytics |
| **Total** | **1217** | - |

### Example Test

```javascript
describe('CleaningChecklist Component', () => {
  it('should update progress when tasks are checked', async () => {
    const mockOnProgressUpdate = jest.fn();
    const { getByText } = render(
      <CleaningChecklist
        home={mockHome}
        onProgressUpdate={mockOnProgressUpdate}
      />
    );

    fireEvent.press(getByText(/Clean all countertops/));

    await waitFor(() => {
      const callWithCompleted = mockOnProgressUpdate.mock.calls.find(
        call => call[1] > 0
      );
      expect(callWithCompleted[1]).toBe(1);
    });
  });
});
```

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

---

## Contributing

See the main [README](../README.md) for contribution guidelines.

---

<div align="center">

**Part of the Kleanr Platform**

[Main Documentation](../README.md) | [Server Documentation](../server/README.md)

</div>
