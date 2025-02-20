import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../../services/styles/TopBarStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";

const EmployeeAssignmentsList = ({ state, dispatch }) => {
  const [allAppointments, setAllAppointments] = useState([]);
  const [refresh, setRefresh] = useState(false);
  const [changesSubmitted, setChangesSubmitted] = useState(false);
  const [redirect, setRedirect] = useState(false);
  const [backRedirect, setBackRedirect] = useState(false);
  const [redirectToJobs, setRedirectToJobs] = useState(false);
  const [userId, setUserId] = useState(null);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const fetchUser = async () => {
    const response = await getCurrentUser();
    setUserId(response.user.id);
  };

  useEffect(() => {
    if (state.currentUser.token) {
      FetchData.get("/api/v1/employee-info", state.currentUser.token).then(
        (response) => {
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: response.employee.cleanerAppointments,
          });
          setAllAppointments(response.employee.cleanerAppointments);
        }
      );
    }
    fetchUser();
    setChangesSubmitted(false);
    if (redirect) {
      navigate("/add-home");
      setRedirect(false);
    }
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
    if (refresh) {
      setRefresh(false);
    }
    if (redirectToJobs) {
      navigate("/new-job-choice");
      setRefresh(false);
    }
  }, [redirect, backRedirect, changesSubmitted, refresh, redirectToJobs]);

  const handlePress = () => {
    setRedirect(true);
  };

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const handlePressToJobsList = () => {
    setRedirectToJobs(true);
  };

  const sortedAppointments = allAppointments.sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });

  const removeEmployee = async (employeeId, appointmentId) => {
    //remove employee from appointment
    const employeeRemoved = await FetchData.removeEmployee(
      employeeId,
      appointmentId
    );
    setRefresh(true);
  };

  const addEmployee = async (employeeId, appointmentId) => {
    //add employee to appointment
    const employeeAdded = await FetchData.addEmployee(
      employeeId,
      appointmentId
    );
    setRefresh(true);
  };

  const assignedAppointments = sortedAppointments.map((appointment) => {
    let isAssigned = appointment.employeesAssigned.includes(String(userId));

    return (
      <View key={appointment.id}>
        <EmployeeAssignmentTile
          id={appointment.id}
          cleanerId={userId}
          date={appointment.date}
          price={appointment.price}
          homeId={appointment.homeId}
          hasBeenAssigned={appointment.hasBeenAssigned}
          bringSheets={appointment.bringSheets}
          bringTowels={appointment.bringTowels}
          completed={appointment.completed}
          keyPadCode={appointment.keyPadCode}
          keyLocation={appointment.keyLocation}
          addEmployee={addEmployee}
          removeEmployee={removeEmployee}
          assigned={isAssigned}
        />
      </View>
    );
  });

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
      }}
    >
      <View style={homePageStyles.backButtonEmployeeAssignmentsList}>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={handleBackPress}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
            }}
          >
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
      </View>
      {sortedAppointments.length ? (
        <>{assignedAppointments}</>
      ) : (
        <>
          <Text
            style={[
              homePageStyles.title,
              {
                fontSize: 18,
                fontWeight: "600",
                color: "#1E1E1E",
                textAlign: "center",
                letterSpacing: 0.5,
              },
            ]}
          >
            You have no jobs scheduled.
          </Text>
          <Text
            style={[
              homePageStyles.homeTileTitle,
              {
                fontSize: 18,
                fontWeight: "600",
                color: "#1E1E1E",
                textAlign: "center",
                letterSpacing: 0.5,
              },
            ]}
          >
            Schedule jobs
            <Pressable
              onPress={handlePressToJobsList}
              style={({ pressed }) => [
                {
                  textDecorationLine: pressed ? "underline" : "none",
                  color: pressed ? "#FF6B00" : "#007AFF",
                  fontWeight: "700",
                },
              ]}
            >
              <Text>{` HERE! `}</Text>
            </Pressable>
          </Text>
        </>
      )}
    </View>
  );
};

export default EmployeeAssignmentsList;
