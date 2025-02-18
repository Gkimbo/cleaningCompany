import React, { useEffect, useReducer, useState } from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
import { NativeRouter, Route, Routes } from "react-router-native";
import reducer from "./services/reducerFunction";
import getCurrentUser from "./services/fetchRequests/getCurrentUser";
import { AuthProvider } from "./services/AuthContext";

import HomePage from "./components/HomePage";
import TopBar from "./components/navBar/TopBar";
import SignIn from "./components/userAuthentication/SignIn";
import SignUp from "./components/userAuthentication/SignUp";
import HomeList from "./components/appointments/HomeList";
import appStyles from "./services/styles/AppStyle";
import AddHomeForm from "./components/addUserInformation/AddHomeForm";
import DetailsComponent from "./components/appointments/DetailsComponent";
import EditHomeList from "./components/editHome/EditHomeList";
import EditHomeForm from "./components/editHome/EditHomeForm";
import AppointmentList from "./components/appointments/AppointmentList";
import Bill from "./components/payments/Bill";
import AddEmployee from "./components/admin/AddEmployee";
import EditEmployeeForm from "./components/admin/forms/EditEmployeeForm";
import AllAppointments from "./components/admin/AllAppointments";
import EmployeeAssignmentsList from "./components/employeeAssignments/lists/EmployeeAssignmentsList";
import EmployeeShiftForm from "./components/admin/forms/employee/EmployeeShiftForm";
import UnassignedAppointments from "./components/admin/UnassignedAppointments";
import AppointmentDetailsPage from "./components/admin/AssignAppointments/AppointmentDetailsPage";
import NewCleanerInformationPage from "./components/admin/CleanerApplications/NewCleanerInformationPage";
import CleanerApplicationForm from "./components/admin/CleanerApplications/ApplicationForm";
import ListOfApplications from "./components/admin/CleanerApplications/ListOfApplications";
import ChooseNewJobButton from "./components/navBar/ChooseNewJobButton";
import SelectNewJobList from "./components/employeeAssignments/lists/SelectNewJobList";
import AllReviewsList from "./components/reviews/AllReviewsList";

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
                <NewCleanerInformationPage state={state} dispatch={dispatch} />
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
              path="/view-all-applications"
              element={<ListOfApplications state={state} dispatch={dispatch} />}
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
              path="/bill"
              element={<Bill state={state} dispatch={dispatch} />}
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
    </AuthProvider>
  );
}
