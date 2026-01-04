import { StripeProvider } from "../src/services/stripe";
import React, { useEffect, useReducer, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeRouter, Route, Routes } from "react-router-native";
import { AuthProvider } from "../src/services/AuthContext";
import { PushNotificationProvider } from "../src/services/PushNotificationContext";
import { SocketProvider } from "../src/services/SocketContext";
import { UserContext } from "../src/context/UserContext";
import getCurrentUser from "../src/services/fetchRequests/getCurrentUser";
import reducer from "../src/services/reducerFunction";
import { API_BASE } from "../src/services/config";

// Import components
import AddHomeForm from "../src/components/addUserInformation/AddHomeForm";
import AddEmployee from "../src/components/admin/AddEmployee";
import AllAppointments from "../src/components/admin/AllAppointments";
import AppointmentDetailsPage from "../src/components/admin/AssignAppointments/AppointmentDetailsPage";
import CleanerApplicationForm from "../src/components/admin/CleanerApplications/ApplicationForm";
import ListOfApplications from "../src/components/admin/CleanerApplications/ListOfApplications";
import EditEmployeeForm from "../src/components/admin/forms/EditEmployeeForm";
import EmployeeShiftForm from "../src/components/admin/forms/employee/EmployeeShiftForm";
import UnassignedAppointments from "../src/components/admin/UnassignedAppointments";
import AllRequestsCalendar from "../src/components/appointments/AllRequestsCalendar";
import AppointmentList from "../src/components/appointments/AppointmentList";
import CleaningRequestList from "../src/components/appointments/CleaningRequestList";
import DetailsComponent from "../src/components/appointments/DetailsComponent";
import HomeList from "../src/components/appointments/HomeList";
import ScheduleCleaningList from "../src/components/appointments/ScheduleCleaningList";
import EditHomeForm from "../src/components/editHome/EditHomeForm";
import EditHomeList from "../src/components/editHome/EditHomeList";
import AppointmentCalendar from "../src/components/employeeAssignments/lists/AppointmentCalendar";
import EmployeeAssignmentsList from "../src/components/employeeAssignments/lists/EmployeeAssignmentsList";
import MyAppointmentsCalendar from "../src/components/employeeAssignments/lists/MyAppointmentsCalendar";
import MyRequests from "../src/components/employeeAssignments/lists/MyRequests";
import MyRequestsCalendar from "../src/components/employeeAssignments/lists/MyRequestsCalendar";
import SelectNewJobList from "../src/components/employeeAssignments/lists/SelectNewJobList";
import HomePage from "../src/components/HomePage";
import TopBar from "../src/components/navBar/TopBar";
import Bill from "../src/components/payments/Bill";
import Earnings from "../src/components/payments/Earnings";
import PaymentSetup from "../src/components/payments/PaymentSetup";
import AllCleanerReviewsList from "../src/components/reviews/AllCleanerReviewsList";
import AllReviewsList from "../src/components/reviews/AllReviewsList";
import PendingReviewsList from "../src/components/reviews/PendingReviewsList";
import SignIn from "../src/components/userAuthentication/SignIn";
import SignUp from "../src/components/userAuthentication/SignUp";
import ForgotCredentials from "../src/components/userAuthentication/ForgotCredentials";
import appStyles from "../src/services/styles/AppStyle";

// Messaging components
import ConversationList from "../src/components/messaging/ConversationList";
import ChatScreen from "../src/components/messaging/ChatScreen";
import BroadcastForm from "../src/components/messaging/BroadcastForm";

// Onboarding components
import {
  WelcomeScreen,
  SignUpWizard,
  HomeSetupWizard,
  QuickBookFlow,
} from "../src/components/onboarding";

// Calendar Sync
import { CalendarSyncManager } from "../src/components/calendarSync";

// Account Settings
import AccountSettings from "../src/components/account/AccountSettings";

// Client components
import ClientRequestsList from "../src/components/client/ClientRequestsList";
import ArchivedCleanings from "../src/components/client/ArchivedCleanings";
import ClientReviews from "../src/components/client/ClientReviews";
import CompleteHomeSetupWizard from "../src/components/client/CompleteHomeSetupWizard";

// Owner components
import TermsEditor from "../src/components/owner/TermsEditor";
import PricingManagement from "../src/components/owner/PricingManagement";
import IncentivesManagement from "../src/components/owner/IncentivesManagement";
import PlatformWithdrawals from "../src/components/owner/PlatformWithdrawals";
import HREmployeeManagement from "../src/components/owner/HREmployeeManagement";
import ChecklistEditor from "../src/components/owner/ChecklistEditor";

// Cleaner components
import RecommendedSupplies from "../src/components/cleaner/RecommendedSupplies";
import MyClientsPage from "../src/components/cleaner/MyClientsPage";
import ClientDetailPage from "../src/components/cleaner/ClientDetailPage";

// Business components
import {
  ImportBusinessLanding,
  BusinessSignupWizard,
  ExistingCleanerCheck,
  CleanerUpgradeLanding,
  CleanerUpgradeForm,
  BusinessCalculator,
} from "../src/components/business";

// Referral components
import ReferralManagement from "../src/components/owner/ReferralManagement";
import MyReferralsPage from "../src/components/referrals/MyReferralsPage";

// HR components
import SuspiciousReportsPage from "../src/components/hr/SuspiciousReportsPage";

// Notifications
import NotificationsScreen from "../src/components/notifications/NotificationsScreen";

// Pricing Context
import { PricingProvider } from "../src/context/PricingContext";

// Terms and Conditions
import { TermsAcceptanceScreen } from "../src/components/terms";

// Business Owner components
import {
  BusinessOwnerDashboard,
  EmployeeManagement,
  JobAssignment,
  BusinessOwnerCalendar,
  EmployeeEditForm,
  FinancialsScreen,
  PayrollScreen,
  EmployeeMessaging,
} from "../src/components/businessOwner";

// Business Employee components
import {
  EmployeeDashboard,
  EmployeeJobList,
  EmployeeEarnings,
  EmployeeJobDetail,
  EmployeeCalendar,
  CoworkerMessaging,
} from "../src/components/businessEmployee";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [stripePublishableKey, setStripePublishableKey] = useState(null);
  const [lastLoginTimestamp, setLastLoginTimestamp] = useState("0");
  const [employeeList, setEmployeeList] = useState([]);
  const [applicationList, setApplicationList] = useState([]);
  const [employeeDays, setEmployeeDays] = useState(null);
  const [state, dispatch] = useReducer(reducer, {
    account: null,
    currentUser: { token: null, id: null },
    bill: { cancellationFee: 0, totalPaid: 0 },
    homes: [],
    appointments: [],
    requests: [],
    // Messaging state
    conversations: [],
    currentMessages: [],
    unreadCount: 0,
  });

  const fetchStripeConfig = async () => {
    try {
      const response = await fetch(`${API_BASE}/payments/config`);
      const data = await response.json();
      if (data.publishableKey) {
        setStripePublishableKey(data.publishableKey);
      }
    } catch (err) {
      console.error("Failed to fetch Stripe config:", err);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      dispatch({ type: "CURRENT_USER", payload: user.token });
      dispatch({ type: "SET_USER_ID", payload: user.user.id });
      if (user.user.email) {
        dispatch({ type: "SET_USER_EMAIL", payload: user.user.email });
      }
      if (user.user.type === "owner") {
        dispatch({ type: "USER_ACCOUNT", payload: "owner" });
      }
      if (user.user.type === "cleaner") {
        dispatch({ type: "USER_ACCOUNT", payload: user.user.type });
      }
      if (user.user.type === "humanResources") {
        dispatch({ type: "USER_ACCOUNT", payload: user.user.type });
      }
      if (user.user.daysWorking !== null) {
        setEmployeeDays(user.user.daysWorking);
      }
      setLastLoginTimestamp(user.user.lastLogin);
    } catch (err) {
      dispatch({ type: "CURRENT_USER", payload: null });
    }
  };

  useEffect(() => {
    const initialize = async () => {
      await Promise.all([fetchStripeConfig(), fetchCurrentUser()]);
      setIsLoading(false);
    };
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, color: "#757575" }}>Loading...</Text>
      </View>
    );
  }

  // If no Stripe key, show error
  if (!stripePublishableKey) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ color: "#F44336", textAlign: "center" }}>
          Unable to initialize payment system. Please check server configuration.
        </Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <PushNotificationProvider>
      <StripeProvider publishableKey={stripePublishableKey}>
        <PricingProvider>
        <SocketProvider token={state.currentUser.token}>
          <UserContext.Provider value={{ state, dispatch, currentUser: state.currentUser }}>
          <NativeRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SafeAreaView style={{ ...appStyles.container, paddingBottom: 60 }}>
              <TopBar dispatch={dispatch} state={state} />
              <Routes>
              <Route
                path="/"
                element={<HomePage dispatch={dispatch} state={state} />}
              />
              <Route
                path="/sign-in"
                element={<SignIn state={state} dispatch={dispatch} />}
              />
              <Route
                path="/sign-up"
                element={<SignUp state={state} dispatch={dispatch} />}
              />
              <Route
                path="/forgot-credentials"
                element={<ForgotCredentials />}
              />
              <Route
                path="/terms-acceptance"
                element={<TermsAcceptanceScreen state={state} dispatch={dispatch} />}
              />
              <Route
                path="/welcome"
                element={<WelcomeScreen />}
              />
              <Route
                path="/get-started"
                element={<SignUpWizard dispatch={dispatch} />}
              />
              <Route
                path="/setup-home"
                element={<HomeSetupWizard state={state} dispatch={dispatch} />}
              />
              <Route
                path="/quick-book/:homeId"
                element={<QuickBookFlow state={state} dispatch={dispatch} />}
              />
              <Route
                path="/apply"
                element={
                  <CleanerApplicationForm state={state} dispatch={dispatch} />
                }
              />
              {/* Business Import */}
              <Route
                path="/import-business"
                element={<ImportBusinessLanding />}
              />
              <Route
                path="/business-signup"
                element={<BusinessSignupWizard dispatch={dispatch} />}
              />
              <Route
                path="/business-signup-check"
                element={<ExistingCleanerCheck />}
              />
              {/* Cleaner Upgrade Flow */}
              <Route
                path="/upgrade-to-business"
                element={<CleanerUpgradeLanding state={state} />}
              />
              <Route
                path="/upgrade-form"
                element={<CleanerUpgradeForm state={state} dispatch={dispatch} />}
              />
              {/* Business Calculator */}
              <Route
                path="/earnings-calculator"
                element={<BusinessCalculator state={state} />}
              />
              <Route
                path="/all-reviews"
                element={<AllReviewsList state={state} dispatch={dispatch} />}
              />
              <Route
                path="/all-cleaner-reviews/:id"
                element={
                  <AllCleanerReviewsList state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/pending-reviews"
                element={
                  <PendingReviewsList state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/view-all-applications"
                element={
                  <ListOfApplications state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/list-of-applications"
                element={
                  <ListOfApplications
                    state={state}
                    dispatch={dispatch}
                    applicationList={applicationList}
                    setApplicationList={setApplicationList}
                  />
                }
              />
              <Route
                path="/list-of-homes"
                element={<HomeList state={state} dispatch={dispatch} />}
              />
              <Route
                path="/schedule-cleaning"
                element={<ScheduleCleaningList state={state} dispatch={dispatch} />}
              />
              <Route path="/add-home" element={<AddHomeForm state={state} dispatch={dispatch} />} />
              <Route
                path="/details/:id"
                element={<DetailsComponent state={state} dispatch={dispatch} />}
              />
              <Route
                path="/edit-home"
                element={<EditHomeList state={state} dispatch={dispatch} />}
              />
              <Route
                path="/edit-home/:id"
                element={<EditHomeForm state={state} dispatch={dispatch} />}
              />
              <Route
                path="/complete-home-setup/:id"
                element={<CompleteHomeSetupWizard state={state} dispatch={dispatch} />}
              />
              <Route
                path="/calendar-sync/:homeId"
                element={<CalendarSyncManager state={state} dispatch={dispatch} />}
              />
              <Route
                path="/appointments"
                element={<AppointmentList state={state} dispatch={dispatch} />}
              />
              <Route
                path="/my-requests"
                element={<MyRequests state={state} dispatch={dispatch} />}
              />
              <Route
                path="/cleaner-requests"
                element={
                  <CleaningRequestList state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/my-requests-calendar"
                element={
                  <MyRequestsCalendar state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/all-requests-calendar"
                element={
                  <AllRequestsCalendar state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/appointment-calender"
                element={
                  <AppointmentCalendar state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/my-appointment-calender"
                element={
                  <MyAppointmentsCalendar state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/bill"
                element={<Bill state={state} dispatch={dispatch} />}
              />
              <Route
                path="/payment-setup"
                element={<PaymentSetup state={state} dispatch={dispatch} />}
              />
              <Route
                path="/earnings"
                element={<Earnings state={state} dispatch={dispatch} />}
              />
              <Route
                path="/employee-assignments"
                element={
                  <EmployeeAssignmentsList state={state} dispatch={dispatch} />
                }
              />
              <Route
                path="/new-job-choice"
                element={<SelectNewJobList state={state} dispatch={dispatch} />}
              />
              <Route
                path="/employee-shifts"
                element={
                  <EmployeeShiftForm
                    employeeDays={employeeDays}
                    setEmployeeDays={setEmployeeDays}
                  />
                }
              />
              <Route
                path="/recommended-supplies"
                element={<RecommendedSupplies />}
              />
              {/* Cleaner My Clients */}
              <Route
                path="/my-clients"
                element={<MyClientsPage state={state} />}
              />
              <Route
                path="/client-detail/:clientId"
                element={<ClientDetailPage state={state} dispatch={dispatch} />}
              />
              <Route
                path="/employees"
                element={
                  <AddEmployee
                    state={state}
                    employeeList={employeeList}
                    setEmployeeList={setEmployeeList}
                  />
                }
              />
              <Route
                path="/employee-edit/:id"
                element={
                  <EditEmployeeForm
                    state={state}
                    employeeList={employeeList}
                    setEmployeeList={setEmployeeList}
                  />
                }
              />
              <Route
                path="/all-appointments"
                element={<AllAppointments state={state} />}
              />
              <Route
                path="/unassigned-appointments"
                element={<UnassignedAppointments state={state} />}
              />
              <Route
                path="/assign-cleaner/:id"
                element={<AppointmentDetailsPage state={state} />}
              />
              {/* Messaging routes */}
              <Route
                path="/messages"
                element={<ConversationList />}
              />
              <Route
                path="/messages/:conversationId"
                element={<ChatScreen />}
              />
              <Route
                path="/messages/broadcast"
                element={<BroadcastForm state={state} />}
              />
              {/* Account Settings */}
              <Route
                path="/account-settings"
                element={<AccountSettings state={state} dispatch={dispatch} />}
              />
              {/* Client Requests */}
              <Route
                path="/client-requests"
                element={<ClientRequestsList state={state} dispatch={dispatch} />}
              />
              {/* Archived Cleanings */}
              <Route
                path="/archived-cleanings"
                element={<ArchivedCleanings state={state} />}
              />
              {/* Client Reviews */}
              <Route
                path="/client-reviews"
                element={<ClientReviews state={state} />}
              />
              {/* Owner Terms Editor */}
              <Route
                path="/owner/terms"
                element={<TermsEditor state={state} />}
              />
              {/* Owner Pricing */}
              <Route
                path="/owner/pricing"
                element={<PricingManagement state={state} />}
              />
              {/* Owner Incentives */}
              <Route
                path="/owner/incentives"
                element={<IncentivesManagement state={state} />}
              />
              {/* Owner Withdrawals */}
              <Route
                path="/owner/withdrawals"
                element={<PlatformWithdrawals state={state} />}
              />
              {/* Owner HR Management */}
              <Route
                path="/owner/hr-management"
                element={<HREmployeeManagement state={state} />}
              />
              {/* Owner Checklist Editor */}
              <Route
                path="/owner/checklist"
                element={<ChecklistEditor state={state} />}
              />
              {/* Owner Referral Management */}
              <Route
                path="/owner/referrals"
                element={<ReferralManagement state={state} />}
              />
              {/* User Referrals Page */}
              <Route
                path="/my-referrals"
                element={<MyReferralsPage state={state} dispatch={dispatch} />}
              />
              {/* HR/Owner Suspicious Reports */}
              <Route
                path="/suspicious-reports"
                element={<SuspiciousReportsPage />}
              />
              {/* Notifications */}
              <Route
                path="/notifications"
                element={<NotificationsScreen />}
              />
              {/* Business Owner routes */}
              <Route
                path="/business-owner/dashboard"
                element={<BusinessOwnerDashboard state={state} />}
              />
              <Route
                path="/business-owner/employees"
                element={<EmployeeManagement state={state} />}
              />
              <Route
                path="/business-owner/employees/:id/edit"
                element={<EmployeeEditForm state={state} />}
              />
              <Route
                path="/business-owner/assign"
                element={<JobAssignment state={state} />}
              />
              <Route
                path="/business-owner/calendar"
                element={<BusinessOwnerCalendar state={state} />}
              />
              <Route
                path="/business-owner/financials"
                element={<FinancialsScreen state={state} />}
              />
              <Route
                path="/business-owner/payroll"
                element={<PayrollScreen state={state} />}
              />
              <Route
                path="/business-owner/messages"
                element={<EmployeeMessaging state={state} />}
              />
              {/* Business Employee routes */}
              <Route
                path="/employee/dashboard"
                element={<EmployeeDashboard state={state} />}
              />
              <Route
                path="/employee/jobs"
                element={<EmployeeJobList state={state} />}
              />
              <Route
                path="/employee/jobs/:assignmentId"
                element={<EmployeeJobDetail state={state} />}
              />
              <Route
                path="/employee/calendar"
                element={<EmployeeCalendar state={state} />}
              />
              <Route
                path="/employee/earnings"
                element={<EmployeeEarnings state={state} />}
              />
              <Route
                path="/employee/messages"
                element={<CoworkerMessaging state={state} />}
              />
            </Routes>
            </SafeAreaView>
          </NativeRouter>
          </UserContext.Provider>
        </SocketProvider>
        </PricingProvider>
      </StripeProvider>
      </PushNotificationProvider>
    </AuthProvider>
  );
}
