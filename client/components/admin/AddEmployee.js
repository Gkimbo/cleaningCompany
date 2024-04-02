import React, { useEffect, useState } from "react";
import {
  Pressable,
  View,
  Text,
  ScrollView,
  Animated,
  Easing,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import UserFormStyles from "../../services/styles/UserInputFormStyle";
import homePageStyles from "../../services/styles/HomePageStyles";
import topBarStyles from "../../services/styles/TopBarStyles";
import AddEmployeeForm from "./forms/AddNewEmployeeForm";
import FetchData from "../../services/fetchRequests/fetchData";
import EmployeeListTile from "../tiles/EmployeeListTile";

const AddEmployee = ({ state, setEmployeeList, employeeList }) => {
  const [backRedirect, setBackRedirect] = useState(false);
  const [deleteAnimation] = useState(new Animated.Value(0));
  const [deleteConfirmation, setDeleteConfirmation] = useState({});
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const fetchEmployees = async () => {
    const response = await FetchData.get(
      "/api/v1/users/employees",
      state.currentUser.token
    );
    setEmployeeList(response.users);
  };

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const handleEdit = (id) => {
    navigate(`/employee-edit/${id}`);
  };

  const handleNoPress = (employeeId) => {
    setDeleteConfirmation((prevConfirmations) => ({
      [employeeId]: !prevConfirmations[employeeId],
    }));
  };

  const onDeleteEmployee = async (id) => {
    try {
      const deleteEmployee = await FetchData.deleteEmployee(id);
      // if (deleteEmployee) {
      // 	dispatch({ type: "DELETE_EM", payload: id });
      // }
    } catch (error) {
      console.error("Error deleting car:", error);
    }
  };

  const handleDeletePress = (employeeId) => {
    setDeleteConfirmation((prevConfirmations) => ({
      [employeeId]: !prevConfirmations[employeeId],
    }));
    if (deleteConfirmation[employeeId]) {
      Animated.timing(deleteAnimation, {
        toValue: 0,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        onDeleteEmployee(employeeId);
        const updatedEmployeeList = employeeList.filter(
          (existingEmployee) => existingEmployee.id !== Number(employeeId)
        );
        setEmployeeList(updatedEmployeeList);
        setDeleteConfirmation((prevConfirmations) => ({
          ...prevConfirmations,
          [employeeId]: false,
        }));
      });
    } else {
      Animated.timing(deleteAnimation, {
        toValue: 1,
        duration: 300,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    }
  };

  useEffect(() => {
    fetchEmployees().then((response) => {
      console.log("Employees fetched");
    });
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [backRedirect]);

  const renderEmployeeList = employeeList.map((employee) => {
    return (
      <EmployeeListTile
        key={employee.id}
        id={employee.id}
        username={employee.username}
        email={employee.email}
        lastLogin={employee.lastLogin}
        type={employee.type}
        handleDeletePress={handleDeletePress}
        deleteAnimation={deleteAnimation}
        deleteConfirmation={deleteConfirmation}
        setDeleteConfirmation={setDeleteConfirmation}
        handleNoPress={handleNoPress}
        handleEdit={handleEdit}
      />
    );
  });

  return (
    <View style={UserFormStyles.container}>
      <View style={homePageStyles.backButtonContainerList}>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={handleBackPress}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
          >
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
      </View>
      <AddEmployeeForm
        employeeList={employeeList}
        setEmployeeList={setEmployeeList}
      />
      {renderEmployeeList}
    </View>
  );
};

export default AddEmployee;
