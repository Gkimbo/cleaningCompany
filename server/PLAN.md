# Business Owner Profile Redesign Plan

## Overview

Redesign the Business Owner profile to clearly separate two modes:
1. **Business Owner Mode (Primary)** - Managing employees, clients, assignments, and payments
2. **Marketplace Cleaner Mode (Secondary)** - Acting as a cleaner in the marketplace

Currently, the business owner profile looks like a regular marketplace cleaner with a few extra features. This plan transforms it into a business management hub with cleaner functionality as a secondary option.

---

## Current State

- Business owner dashboard exists at `/business-owner/dashboard` but is separate from profile
- Profile looks like a regular cleaner profile
- "My Clients" is in the cleaner section
- No clear visual distinction between owner and cleaner roles
- Features are scattered across different sections

---

## Proposed Architecture

### New Business Owner Profile Structure

```
BusinessOwnerProfile/
├── Mode Toggle (Business Owner | Marketplace Cleaner)
│
├── BUSINESS OWNER MODE (Primary)
│   ├── Dashboard Overview
│   │   ├── Quick Stats (Revenue, Payroll Owed, Unpaid Clients)
│   │   ├── Today's Jobs (with assignment status)
│   │   └── Action Alerts (unassigned jobs, pending payments)
│   │
│   ├── My Team Section
│   │   ├── Employee Cards (status, jobs today)
│   │   ├── Quick Assign button
│   │   └── Payroll Summary (owed amounts)
│   │
│   ├── My Clients Section
│   │   ├── Client Cards (with payment status)
│   │   ├── Upcoming Appointments
│   │   └── Payment Tracking (paid/unpaid invoices)
│   │
│   ├── Calendar View
│   │   └── All jobs with employee assignments
│   │
│   └── Financials Quick View
│       ├── Revenue This Month
│       ├── Payroll This Month
│       └── Net Profit
│
└── MARKETPLACE CLEANER MODE (Secondary)
    ├── Available Jobs
    ├── My Marketplace Jobs
    └── Self-Assignment Option
```

---

## Implementation Steps

### Phase 1: Create Mode Toggle Component

**File:** `client/src/components/businessOwner/BusinessOwnerModeToggle.js`

- Create a toggle switch component at top of profile
- Store mode preference in local state or AsyncStorage
- Options: "Manage Business" (default) | "Clean Jobs"
- Visual indicator showing current mode

### Phase 2: Redesign Business Owner Profile Page

**File:** `client/src/components/businessOwner/BusinessOwnerProfile.js` (new)

Create a unified profile page that replaces the current scattered approach:

```jsx
<BusinessOwnerProfile>
  <Header with business name and mode toggle />

  {mode === 'business' ? (
    <BusinessManagementView />
  ) : (
    <MarketplaceCleanerView />
  )}
</BusinessOwnerProfile>
```

### Phase 3: Business Management View Components

#### 3.1 Dashboard Overview Section
**File:** `client/src/components/businessOwner/profile/DashboardOverview.js`

- Quick stats cards:
  - Total Revenue (this month)
  - Payroll Owed (with count of pending)
  - Unpaid Client Invoices (with count)
  - Jobs This Week
- Today's Jobs list with assignment status
- Alert badges for items needing attention

#### 3.2 My Team Section
**File:** `client/src/components/businessOwner/profile/MyTeamSection.js`

- Compact employee cards showing:
  - Name, avatar
  - Jobs assigned today
  - Amount owed (pending payroll)
  - Quick actions (assign job, pay, message)
- "Invite Employee" button
- Link to full employee management

#### 3.3 My Clients Section
**File:** `client/src/components/businessOwner/profile/MyClientsSection.js`

- Client cards showing:
  - Name, address preview
  - Next scheduled appointment
  - Payment status (paid/unpaid/overdue)
  - Preferred status tier badge
- "Add Client" button
- Payment tracking summary
- Link to full client management

#### 3.4 Payroll Tracking Section
**File:** `client/src/components/businessOwner/profile/PayrollSection.js`

- List of employees with unpaid completed jobs
- Total payroll owed
- "Mark as Paid" quick action
- Pay history link

#### 3.5 Client Payment Tracking Section
**File:** `client/src/components/businessOwner/profile/ClientPaymentsSection.js`

- Unpaid/overdue appointments
- Payment status by client
- Send reminder action
- Mark as paid action

### Phase 4: Marketplace Cleaner View

**File:** `client/src/components/businessOwner/profile/MarketplaceCleanerView.js`

When in "Clean Jobs" mode, show:
- Available marketplace jobs in their area
- Their current marketplace job pickups
- Option to self-assign to their own client jobs
- Standard cleaner earnings/stats

### Phase 5: Update Routing

**File:** `client/app/App.js`

```jsx
// New unified business owner profile route
<Route
  path="/business-owner/profile"
  element={<BusinessOwnerProfile state={state} />}
/>

// Keep existing routes for deep linking
<Route path="/business-owner/employees" ... />
<Route path="/business-owner/clients" ... />
<Route path="/business-owner/payroll" ... />
```

### Phase 6: Update Navigation

**File:** `client/src/components/navBar/TopBar.js`

- Update menu for business owners
- Primary navigation to profile (not dashboard)
- Quick links to key sections

### Phase 7: Backend Enhancements

#### 7.1 Client Payment Tracking
**File:** `server/routes/api/v1/businessOwnerRouter.js`

Add endpoints for:
```
GET /business-owner/client-payments - Get payment status for all clients
POST /business-owner/appointments/:id/mark-paid - Mark appointment as paid
GET /business-owner/dashboard-summary - Aggregated stats for profile
```

#### 7.2 Dashboard Summary Service
**File:** `server/services/BusinessOwnerDashboardService.js` (new)

Create service to aggregate:
- Revenue stats
- Payroll owed
- Unpaid client appointments
- Today's job summary
- Alerts/action items

---

## UI/UX Design Notes

### Mode Toggle Design
```
┌─────────────────────────────────────────┐
│  [Manage Business]  |  Clean Jobs       │
│       ●                                 │
└─────────────────────────────────────────┘
```
- Active mode has filled background
- Subtle animation on switch
- Persists user preference

### Business Mode Layout
```
┌─────────────────────────────────────────┐
│  🏢 Sparkle Clean Co.                   │
│  [Manage Business ●] | [Clean Jobs]     │
├─────────────────────────────────────────┤
│  📊 OVERVIEW                            │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │$2,450  │ │$485    │ │3       │      │
│  │Revenue │ │Payroll │ │Unpaid  │      │
│  └────────┘ └────────┘ └────────┘      │
├─────────────────────────────────────────┤
│  👥 MY TEAM                    [Manage] │
│  ┌─────────────────────────────────────┐│
│  │ 👤 Jane - 2 jobs today - Owed: $85  ││
│  │ 👤 Mike - 1 job today - Owed: $0    ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  🏠 MY CLIENTS                 [Manage] │
│  ┌─────────────────────────────────────┐│
│  │ Smith - Tomorrow 9am - ✓ Paid       ││
│  │ Johnson - Wed 2pm - ⚠ Unpaid        ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  💰 PAYROLL                     [View]  │
│  3 employees owed $485 total            │
│  [Pay All] [View Details]               │
└─────────────────────────────────────────┘
```

### Cleaner Mode Layout
```
┌─────────────────────────────────────────┐
│  🏢 Sparkle Clean Co.                   │
│  [Manage Business] | [Clean Jobs ●]     │
├─────────────────────────────────────────┤
│  🧹 AVAILABLE JOBS                      │
│  Jobs in your area you can pick up      │
│  ┌─────────────────────────────────────┐│
│  │ 123 Main St - Tomorrow - $120       ││
│  │ 456 Oak Ave - Friday - $95          ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  📋 MY JOBS                             │
│  Jobs you're personally cleaning        │
│  ┌─────────────────────────────────────┐│
│  │ (None currently)                    ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  💡 TIP: Assign yourself to client jobs │
│  from the Business tab, or pick up      │
│  marketplace jobs here.                 │
└─────────────────────────────────────────┘
```

---

## Files to Create/Modify

### New Files
1. `client/src/components/businessOwner/BusinessOwnerProfile.js`
2. `client/src/components/businessOwner/BusinessOwnerModeToggle.js`
3. `client/src/components/businessOwner/profile/DashboardOverview.js`
4. `client/src/components/businessOwner/profile/MyTeamSection.js`
5. `client/src/components/businessOwner/profile/MyClientsSection.js`
6. `client/src/components/businessOwner/profile/PayrollSection.js`
7. `client/src/components/businessOwner/profile/ClientPaymentsSection.js`
8. `client/src/components/businessOwner/profile/MarketplaceCleanerView.js`
9. `server/services/BusinessOwnerDashboardService.js`

### Files to Modify
1. `client/app/App.js` - Add new routes
2. `client/src/components/navBar/TopBar.js` - Update navigation
3. `server/routes/api/v1/businessOwnerRouter.js` - Add new endpoints

---

## Migration Notes

- Keep existing `/business-owner/dashboard` route working for backward compatibility
- Redirect from old routes to new profile as needed
- Existing employee management and client pages remain as "full" views linked from profile sections

---

## Success Criteria

1. Business owners see "Manage Business" mode by default
2. Clear toggle to switch to "Clean Jobs" mode
3. At-a-glance view of team, clients, and financials
4. Quick actions for common tasks (assign, pay, message)
5. Payment tracking for both employees (payroll) and clients
6. Seamless switch to marketplace cleaner functionality when needed
