<div align="center">

# Kleanr ![Node](https://img.shields.io/badge/node-v18.x-green) ![React Native](https://img.shields.io/badge/React%20Native-Expo-blue) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-316192)

Kleanr is a comprehensive cleaning service management platform for short-term rental properties. Our mobile app and web platform enable hosts to schedule cleanings, manage turnovers, communicate with cleaners, and process payments seamlessly.

</div>

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Features

### For Homeowners
- Schedule and manage cleaning appointments
- View and manage multiple properties
- Secure payment processing via Stripe
- Real-time messaging with cleaners and management
- View payment history and receipts
- Request specific cleaners

### For Cleaners
- View assigned appointments and schedules
- Track earnings and payment history
- Accept or decline cleaning requests
- Real-time messaging with homeowners and management
- Calendar view of upcoming jobs

### For Managers
- Assign cleaners to appointments
- Send broadcast announcements to all users
- View all appointments and manage scheduling
- Handle support requests from users
- Manage employee information

### Messaging System
- Real-time WebSocket messaging (Socket.io)
- Appointment-based conversations
- Manager broadcast announcements
- Support chat for help requests
- Email notifications for new messages
- In-app unread message indicators

### Payments
- Stripe integration for secure payments
- Apple Pay and Google Pay support
- Payment history tracking
- Refund processing

## Tech Stack

### Client
- React Native (Expo)
- React Router Native
- Stripe React Native SDK
- Socket.io Client
- React Native Vector Icons

### Server
- Node.js / Express
- PostgreSQL
- Sequelize ORM
- Socket.io
- Passport.js (Authentication)
- JWT (JSON Web Tokens)
- Stripe API
- Nodemailer (Email notifications)

## Prerequisites

- [Node.js](https://nodejs.org/) v18.x or higher
- [PostgreSQL](https://www.postgresql.org/download/) v14 or higher
- [Git](https://git-scm.com/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (for mobile development)
- Stripe account (for payment processing)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/kleanr.git
   cd kleanr
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Create the database:**
   ```bash
   createdb cleaning_company_development
   ```

5. **Run database migrations:**
   ```bash
   cd ../server
   npx sequelize-cli db:migrate
   ```

6. **Seed the manager account:**
   ```bash
   npx sequelize-cli db:seed --seed managerSeeder.js
   ```

## Environment Variables

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Configure the following variables:

| Variable | Description |
|----------|-------------|
| `SESSION_SECRET` | Secret key for session encryption |
| `STRIPE_SECRET_KEY` | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `GOOGLE_MAPS` | Google Maps API key (optional) |
| `API_NINJA_API_KEY` | API Ninja key (optional) |

## Running the App

### Start the Server
```bash
cd server
npm start
```
The server will run on `http://localhost:3000`

### Start the Client
In a separate terminal:
```bash
cd client
npm start
```

Then press:
- `w` - Open in web browser
- `i` - Open in iOS simulator
- `a` - Open in Android emulator

## Testing

### Run Server Tests
```bash
cd server
npm test
```

The test suite includes:
- Route tests (authentication, appointments, payments, messaging)
- Model tests (User, Appointments, Bills, Conversations, Messages)
- Integration tests (payment flows, Stripe integration)

## Project Structure

```
kleanr/
├── client/                     # React Native Expo app
│   ├── app/
│   │   ├── components/         # UI components
│   │   │   ├── messaging/      # Chat & messaging components
│   │   │   ├── payments/       # Payment components
│   │   │   ├── appointments/   # Appointment management
│   │   │   └── navBar/         # Navigation components
│   │   └── services/
│   │       ├── fetchRequests/  # API service classes
│   │       ├── styles/         # StyleSheet definitions
│   │       └── SocketContext.js # WebSocket provider
│   └── package.json
│
├── server/                     # Express.js API server
│   ├── __tests__/              # Jest test files
│   ├── migrations/             # Sequelize migrations
│   ├── models/                 # Sequelize models
│   ├── routes/                 # API route handlers
│   ├── services/               # Business logic & utilities
│   ├── middleware/             # Express middleware
│   ├── config/                 # Database configuration
│   ├── app.js                  # Express app setup
│   └── package.json
│
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/v1/user-sessions/login` - User login
- `POST /api/v1/users` - User registration
- `GET /api/v1/user-sessions/current` - Get current user

### Appointments
- `GET /api/v1/appointments/:homeId` - Get appointments for a home
- `POST /api/v1/appointments` - Create appointment
- `DELETE /api/v1/appointments/:id` - Cancel appointment

### Payments
- `GET /api/v1/payments/config` - Get Stripe config
- `POST /api/v1/payments/create-intent` - Create payment intent
- `POST /api/v1/payments/refund` - Process refund

### Messaging
- `GET /api/v1/messages/conversations` - Get user conversations
- `GET /api/v1/messages/conversation/:id` - Get messages
- `POST /api/v1/messages/send` - Send message
- `POST /api/v1/messages/conversation/support` - Create support chat
- `POST /api/v1/messages/broadcast` - Send broadcast (manager only)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

This project is proprietary software.
