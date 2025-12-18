import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { TextInput } from "react-native-paper";
import { useNavigate, useParams } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import formStyles from "../../../services/styles/FormStyle";
import UserFormStyles from "../../../services/styles/UserInputFormStyle";

const EditEmployeeForm = ({ setEmployeeList, employeeList }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const type = "cleaner";

  const [employee, setEmployee] = useState({
    id: id,
    username: "",
    email: "",
    password: "",
  });
  const [redirect, setRedirect] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState([]);

  // ✅ validate user input before submitting
  const validate = () => {
    const validationErrors = [];

    if (employee.username.trim().length < 4) {
      validationErrors.push("Username must be greater than 4 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(employee.email.trim())) {
      validationErrors.push("Please enter a valid email address.");
    }

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  // ✅ Submit handler
  const onSubmit = async () => {
    if (!validate()) return;

    const data = {
      id,
      userName: employee.username,
      password: employee.password,
      email: employee.email,
      type,
    };

    try {
      const response = await FetchData.editEmployee(data);

      if (
        response === "An account already has this email" ||
        response === "Username already exists"
      ) {
        setErrors([response]);
      } else if (response && response.user) {
        const updatedEmployeeList = employeeList
          ? employeeList.filter((existingEmployee) => existingEmployee.id !== Number(id))
          : [];
        updatedEmployeeList.push(response.user);
        setEmployeeList(updatedEmployeeList);
        setRedirect(true);
      }
    } catch (err) {
      console.error("Edit employee failed:", err);
      setErrors(["An unexpected error occurred. Please try again."]);
    }
  };

  // ✅ Load employee info safely
  useEffect(() => {
    if (!employeeList || employeeList.length === 0) return;

    const idNeeded = Number(id);
    const foundEmployee = employeeList.find(
      (emp) => Number(emp.id) === idNeeded
    );

    if (foundEmployee) {
      setEmployee({
        id: foundEmployee.id,
        username: foundEmployee.username || "",
        email: foundEmployee.email || "",
        password: "",
      });
    }
  }, [id, employeeList]);

  // ✅ Redirect after successful update
  useEffect(() => {
    if (redirect) {
      navigate("/employees");
    }
  }, [redirect]);

  // ✅ Handle when no employee found yet
  if (!employee || !employee.username) {
    return (
      <View style={[UserFormStyles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#1a3c6e", fontSize: 16 }}>Loading employee data...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={UserFormStyles.container}>
        <View style={formStyles.container}>
          {errors.length > 0 && (
            <View style={formStyles.errorContainer}>
              {errors.map((error, index) => (
                <Text key={index} style={formStyles.errorText}>
                  {error}
                </Text>
              ))}
            </View>
          )}

          <TextInput
            mode="outlined"
            placeholder="User Name"
            style={formStyles.input}
            value={employee.username}
            onChangeText={(text) => setEmployee({ ...employee, username: text })}
          />

          <TextInput
            mode="outlined"
            secureTextEntry={!showPassword}
            value={employee.password}
            onChangeText={(text) => setEmployee({ ...employee, password: text })}
            placeholder="Password"
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={formStyles.input}
          />

          <TextInput
            mode="outlined"
            placeholder="Email"
            style={formStyles.input}
            value={employee.email}
            onChangeText={(text) => setEmployee({ ...employee, email: text })}
            keyboardType="email-address"
          />

          <Pressable onPress={onSubmit}>
            <Text style={formStyles.button}>Edit employee information</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
};

export default EditEmployeeForm;
