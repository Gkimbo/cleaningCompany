import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { useParams } from "react-router-native";
import UserFormStyles from "../../../services/styles/UserInputFormStyle";
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import EmployeeShiftAssign from "./EmployeeShiftAssign";

const AppointmentDetailsPage = ({ state }) => {
  const [appointment, setAppointment] = useState(null);
  const [home, setHome] = useState(null);
  const [assignedEmployees, setAssignedEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const { id } = useParams();

  const removeEmployee = (employeeId) => {
    //remove employee from appointment
  };

  const addEmployee = (employeeId) => {
    //add employee to appointment
  };

  const employeeTiles = allEmployees.map((employee) => {
    const isAssigned = assignedEmployees.some((assignedEmployee) => {
      return assignedEmployee.name === employee.username;
    });

    return (
      <EmployeeShiftAssign
        key={employee.id}
        id={employee.id}
        username={employee.username}
        email={employee.email}
        lastLogin={employee.lastLogin}
        type={employee.type}
        assigned={isAssigned}
        removeEmployee={removeEmployee}
        addEmployee={addEmployee}
      />
    );
  });

  const fetchEmployees = async () => {
    const response = await FetchData.get(
      "/api/v1/users/employees",
      state.currentUser.token
    );
    setAllEmployees(response.users);
  };

  useEffect(() => {
    FetchData.get(
      `/api/v1/appointments/unassigned/${id}`,
      state.currentUser.token
    ).then((response) => {
      setAppointment(response.appointment);
      const assignedEmployees = JSON.parse(
        response.appointment.employeesAssigned
      );
      if (!assignedEmployees.length) {
        setAssignedEmployees([assignedEmployees]);
      } else {
        setAssignedEmployees(assignedEmployees);
      }
      const homeId = response.appointment.homeId;

      if (homeId) {
        FetchData.get(
          `/api/v1/employee-info/home/${homeId}`,
          state.currentUser.token
        ).then((response) => {
          setHome(response.home);
        });
      }
    });
    fetchEmployees();
  }, []);

  return (
    <View style={UserFormStyles.container}>
      {appointment && home ? (
        <>
          <View style={homePageStyles.homeTileContainer}>
            <Text style={homePageStyles.homeTileTitle}>{home.nickName}</Text>
            <Text style={{ ...homePageStyles.homeTileAddress, margin: 0 }}>
              {home.address}
            </Text>
            <Text
              style={{ ...homePageStyles.homeTileAddress, marginBottom: 2 }}
            >
              {`${home.city}, ${home.state} ${home.zipcode}`}
            </Text>
            <View style={homePageStyles.appointmentListContainer}>
              <View style={homePageStyles.appointmentListRow}>
                <Text>Employees Required: {appointment.empoyeesNeeded}</Text>
                <Text>Employees Assigned: {assignedEmployees.length}</Text>
                <Text>Date: {appointment.date}</Text>
                <Text>Price: {appointment.price}</Text>
                <Text>Bring Sheets: {appointment.bringSheets}</Text>
                <Text>Bring Towels: {appointment.bringTowels}</Text>
                <Text>
                  Has Been Assigned:{" "}
                  {appointment.hasBeenAssigned ? "Yes" : "No"}
                </Text>
                <Text>Key Location: {appointment.keyLocation}</Text>
                <Text>Key Pad Code: {appointment.keyPadCode}</Text>
                <Text>Completed: {appointment.completed ? "Yes" : "No"}</Text>
                <Text>Paid: {appointment.paid ? "Yes" : "No"}</Text>
                <Text style={homePageStyles.appointmentBanner}>
                  Employees Needed:{" "}
                  {appointment.empoyeesNeeded - assignedEmployees.length}
                </Text>
              </View>
            </View>
          </View>
          {employeeTiles}
        </>
      ) : (
        <Text>The appointment information was not found.</Text>
      )}
    </View>
  );
};

export default AppointmentDetailsPage;
