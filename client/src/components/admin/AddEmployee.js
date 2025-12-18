import React, { useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import FetchData from "../../services/fetchRequests/fetchData";
import EmployeeListTile from "../tiles/EmployeeListTile";
import AddEmployeeForm from "./forms/AddNewEmployeeForm";

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
      await FetchData.deleteEmployee(id);
    } catch (error) {
      console.error("Error deleting employee:", error);
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
          (emp) => emp.id !== Number(employeeId)
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
    fetchEmployees();
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [backRedirect]);

  return (
    <ScrollView
      style={{
        flex: 1,
        backgroundColor: "#f5f5f5",
        paddingHorizontal: 10,
        paddingTop: 20,
      }}
    >
  {/* Back Button */}
<View
  style={{
    marginTop: 20, // separation from top/status bar
    marginBottom: 25, // space before form
    alignSelf: "flex-start", // keep it left-aligned
  }}
>
  <Pressable
    style={{
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#ffffff",
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 3,
    }}
    onPress={handleBackPress}
  >
    <Icon name="angle-left" size={iconSize + 4} color="#333" />
    <Text
      style={{
        marginLeft: 10,
        fontSize: 16,
        fontWeight: "600",
        color: "#333",
      }}
    >
      Back
    </Text>
  </Pressable>
</View>


      {/* Add Employee Form */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 15,
          marginBottom: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 3,
        }}
      >
        <AddEmployeeForm
          employeeList={employeeList}
          setEmployeeList={setEmployeeList}
        />
      </View>

      {/* Employee List */}
      <View style={{ marginBottom: 50 }}>
        {employeeList.map((employee) => (
          <View
            key={employee.id}
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 15,
              marginBottom: 12,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
              elevation: 2,
            }}
          >
            <EmployeeListTile
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
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

export default AddEmployee;
