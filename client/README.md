<div align="center">

# Kleanr Client

![React Native](https://img.shields.io/badge/React%20Native-0.76-blue)
![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020)
![Tests](https://img.shields.io/badge/tests-92%20passing-brightgreen)

**React Native mobile application for the Kleanr cleaning service platform**

</div>

---

## Overview

The Kleanr client is a cross-platform mobile application built with React Native and Expo. It provides interfaces for homeowners to book cleanings, cleaners to manage their schedules, and managers to oversee operations.

## Getting Started

### Prerequisites

- Node.js v18.x or higher
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App

After starting the development server, press:

| Key | Platform |
|-----|----------|
| `w` | Open in web browser |
| `i` | Open in iOS Simulator |
| `a` | Open in Android Emulator |

Or scan the QR code with the Expo Go app on your device.

## Project Structure

```
client/
├── app/
│   ├── components/
│   │   ├── addUserInformation/   # User profile forms
│   │   ├── admin/                # Manager dashboard
│   │   ├── appointments/         # Appointment management
│   │   ├── calender/             # Calendar views
│   │   ├── editHome/             # Property editing
│   │   ├── employeeAssignments/  # Cleaner assignments
│   │   ├── messaging/            # Chat & messaging
│   │   ├── navBar/               # Navigation components
│   │   ├── payments/             # Payment UI & Stripe
│   │   ├── reviews/              # Review system
│   │   ├── tax/                  # Tax documents section
│   │   ├── tiles/                # Reusable tile components
│   │   ├── userAuthentication/   # Login/registration
│   │   └── HomePage.js           # Main dashboard
│   │
│   └── services/
│       ├── fetchRequests/        # API service classes
│       │   ├── fetchData.js      # General API calls
│       │   ├── MessageService.js # Messaging API
│       │   ├── PaymentService.js # Payment API
│       │   └── TaxService.js     # Tax documents API
│       ├── styles/               # StyleSheet definitions
│       ├── data/                 # Static data
│       └── SocketContext.js      # WebSocket provider
│
├── __tests__/
│   ├── components/               # Component tests
│   │   ├── Bill.test.js
│   │   ├── Earnings.test.js
│   │   └── TaxFormsSection.test.js
│   └── services/                 # Service tests
│       ├── reducerFunction.test.js
│       └── TaxService.test.js
│
├── assets/                       # Images and fonts
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Test setup
└── package.json
```

## Key Components

### HomePage
Main dashboard that displays different content based on user type:
- **Cleaners**: Today's appointments, upcoming jobs, earnings, reviews, tax documents
- **Homeowners**: Service information, booking options, payment history, tax documents
- **Managers**: Platform overview, tax reports, quarterly estimates

### TaxFormsSection
Displays tax-related information at the bottom of the home page:
- Cleaners see 1099-NEC summary and total earnings
- Homeowners see payment history
- Managers see platform income and quarterly tax estimates

### Messaging
Real-time chat system with Socket.io:
- Appointment-based conversations
- Support chat with managers
- Broadcast announcements
- Unread message indicators

### Payments
Stripe integration for secure payments:
- Payment sheet with Apple Pay / Google Pay
- Payment history view
- Cleaner earnings tracking

## API Services

### FetchData
General-purpose API service for user data, appointments, and homes.

```javascript
import FetchData from './services/fetchRequests/fetchData';

// Get user info
const userInfo = await FetchData.get('/api/v1/user-info', token);

// Login
const response = await FetchData.login({ userName, password });
```

### TaxService
Tax document and reporting API.

```javascript
import TaxService from './services/fetchRequests/TaxService';

// Get cleaner tax summary
const summary = await TaxService.getCleanerTaxSummary(token, 2024);

// Get platform tax report (manager)
const report = await TaxService.getPlatformTaxReport(token, 2024);

// Get payment history (homeowner)
const history = await TaxService.getPaymentHistory(token, 2024);
```

### MessageService
Real-time messaging API.

```javascript
import MessageService from './services/fetchRequests/MessageService';

// Get conversations
const conversations = await MessageService.getConversations(token);

// Send message
await MessageService.sendMessage(token, conversationId, content);
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### Test Structure

| Test File | Coverage |
|-----------|----------|
| `TaxFormsSection.test.js` | Tax UI logic, user type detection, API calls |
| `TaxService.test.js` | All tax API methods, error handling |
| `Earnings.test.js` | Earnings calculations, payment capture |
| `Bill.test.js` | Billing display, payment status |
| `reducerFunction.test.js` | State management logic |

## State Management

The app uses React's `useReducer` for state management with the following structure:

```javascript
const initialState = {
  currentUser: { token: null, id: null, email: null },
  account: null,           // 'cleaner', 'manager1', or null (homeowner)
  appointments: [],
  homes: [],
  bill: {},
  cleaningRequests: [],
};
```

## Environment Configuration

The API base URL is configured in `fetchData.js`:

```javascript
const baseURL = "http://localhost:3000";
```

For production, update this to your deployed server URL.

## Styling

Components use React Native's `StyleSheet.create()` with responsive design:

```javascript
import { Dimensions, StyleSheet } from 'react-native';
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    padding: width < 400 ? 10 : 20,
    // Responsive styling based on screen width
  },
});
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `expo` | Development platform |
| `react-native` | Mobile framework |
| `react-router-native` | Navigation |
| `@stripe/stripe-react-native` | Payment UI |
| `socket.io-client` | Real-time messaging |
| `react-native-calendars` | Calendar views |
| `react-native-paper` | UI components |

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo development server |
| `npm test` | Run Jest tests |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS |
| `npm run web` | Run in web browser |

## Contributing

See the main [README](../README.md) for contribution guidelines.
