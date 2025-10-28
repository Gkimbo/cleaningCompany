import { StripeProvider } from "@stripe/stripe-react-native"; // ✅ Import Stripe provider
import React, { useEffect, useReducer, useState } from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
import { NativeRouter, Route, Routes } from "react-router-native";
import { AuthProvider } from "./services/AuthContext";
import getCurrentUser from "./services/fetchRequests/getCurrentUser";
import reducer from "./services/reducerFunction";

// Import components
import AddHomeForm from "./components/addUserInformation/AddHomeForm";
import AddEmployee from "./components/admin/AddEmployee";
import AllAppointments from "./components/admin/AllAppointments";
import AppointmentDetailsPage from "./components/admin/AssignAppointments/AppointmentDetailsPage";
import CleanerApplicationForm from "./components/admin/CleanerApplications/ApplicationForm";
import ListOfApplications from "./components/admin/CleanerApplications/ListOfApplications";
import NewCleanerInformationPage from "./components/admin/CleanerApplications/NewCleanerInformationPage";
import EditEmployeeForm from "./components/admin/forms/EditEmployeeForm";
import EmployeeShiftForm from "./components/admin/forms/employee/EmployeeShiftForm";
import UnassignedAppointments from "./components/admin/UnassignedAppointments";
import AllRequestsCalendar from "./components/appointments/AllRequestsCalendar";
import AppointmentList from "./components/appointments/AppointmentList";
import CleaningRequestList from "./components/appointments/CleaningRequestList";
import DetailsComponent from "./components/appointments/DetailsComponent";
import HomeList from "./components/appointments/HomeList";
import EditHomeForm from "./components/editHome/EditHomeForm";
import EditHomeList from "./components/editHome/EditHomeList";
import AppointmentCalendar from "./components/employeeAssignments/lists/AppointmentCalendar";
import EmployeeAssignmentsList from "./components/employeeAssignments/lists/EmployeeAssignmentsList";
import MyAppointmentsCalendar from "./components/employeeAssignments/lists/MyAppointmentsCalendar";
import MyRequests from "./components/employeeAssignments/lists/MyRequests";
import MyRequestsCalendar from "./components/employeeAssignments/lists/MyRequestsCalendar";
import SelectNewJobList from "./components/employeeAssignments/lists/SelectNewJobList";
import HomePage from "./components/HomePage";
import TopBar from "./components/navBar/TopBar";
import Bill from "./components/payments/Bill";
import Earnings from "./components/payments/Earnings";
import AllCleanerReviewsList from "./components/reviews/AllCleanerReviewsList";
import AllReviewsList from "./components/reviews/AllReviewsList";
import SignIn from "./components/userAuthentication/SignIn";
import SignUp from "./components/userAuthentication/SignUp";
import appStyles from "./services/styles/AppStyle";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [lastLoginTimestamp, setLastLoginTimestamp] = useState("0");
  const [employeeList, setEmployeeList] = useState([]);
  const [applicationList, setApplicationList] = useState([]);
  const [employeeDays, setEmployeeDays] = useState(null);
  const [state, dispatch] = useReducer(reducer, {
    account: null,
    currentUser: { token: null },
    bill: 0,
    homes: [],
    appointments: [],
    requests: [],
  });

  const fetchCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      dispatch({ type: "CURRENT_USER", payload: user.token });
      if (user.user.username === "manager1") {
        dispatch({ type: "USER_ACCOUNT", payload: user.user.username });
      }
      if (user.user.type === "cleaner") {
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
    fetchCurrentUser();
    setTimeout(() => {
      setIsLoading(false);
    }, 2000);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      {/* ✅ Stripe Provider wraps entire app */}
      <StripeProvider
        publishableKey="pk_test_12345YourPublishableKeyHere"
        merchantIdentifier="merchant.com.kleanr.app" // iOS required
        urlScheme="kleanr" // optional for 3D Secure redirect
      >
        <NativeRouter>
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
                path="/apply"
                element={
                  <NewCleanerInformationPage
                    state={state}
                    dispatch={dispatch}
                  />
                }
              />
              <Route
                path="/application-form"
                element={
                  <CleanerApplicationForm state={state} dispatch={dispatch} />
                }
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
                    applicationList={applicationList}
                    setApplicationList={setApplicationList}
                  />
                }
              />
              <Route
                path="/list-of-homes"
                element={<HomeList state={state} dispatch={dispatch} />}
              />
              <Route path="/add-home" element={<AddHomeForm />} />
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
            </Routes>
          </SafeAreaView>
        </NativeRouter>
      </StripeProvider>
    </AuthProvider>
  );
}
