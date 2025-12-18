import React, { useState, useContext, useEffect } from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { Checkbox } from "react-native-paper";
import { AuthContext } from "../../../../services/AuthContext";
import FetchData from "../../../../services/fetchRequests/fetchData";
import UserFormStyles from "../../../../services/styles/UserInputFormStyle";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../../services/styles/HomePageStyles";
import topBarStyles from "../../../../services/styles/TopBarStyles";
import Icon from "react-native-vector-icons/FontAwesome";

const EmployeeShiftForm = ({ employeeDays, setEmployeeDays }) => {
	const { user } = useContext(AuthContext);
	const [employeeShifts, setEmployeeShiftForm] = useState({
		user: user,
		days: [],
	});

	const [error, setError] = useState(null);
	const [formRedirect, setFormRedirect] = useState(false);
	const [redirect, setRedirect] = useState(false);
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	const handleDayChange = (day) => {
		let newDays = [...employeeShifts.days];
		if (newDays.includes(day)) {
			newDays = newDays.filter((d) => d !== day);
		} else {
			newDays.push(day);
		}
		setEmployeeShiftForm((prevState) => ({
			...prevState,
			days: newDays,
		}));
	};

	const handleSubmit = (event) => {
		event.preventDefault();
		if (employeeShifts.days.length < 2) {
			setError("Please signup for at least 2 days a week");
			return;
		}
		setError(null);
		FetchData.addEmployeeShiftsInfo(employeeShifts).then((response) => {
			if (response.user) {
				setError(null);
				setEmployeeDays(employeeShifts.days);
				setFormRedirect(true);
			} else {
				setError("Something went wrong, try again later");
			}
		});
	};

	useEffect(() => {
		if (employeeDays) {
			setEmployeeShiftForm({ ...employeeShifts, days: employeeDays });
		}
		if (formRedirect) {
			navigate("/");
			setFormRedirect(false);
		}
		if (redirect) {
			navigate("/");
			setRedirect(false);
		}
	}, [formRedirect, redirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	return (
		<View style={UserFormStyles.container}>
			<View style={homePageStyles.backButtonContainerForm}>
				<Pressable style={homePageStyles.backButtonForm} onPress={handlePress}>
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
			<form onSubmit={handleSubmit}>
				<View>
					<Text style={UserFormStyles.title}>
						Choose the days you'd like to work (minimum of 2 days a week)
					</Text>
					<Text style={UserFormStyles.smallTitle}>
						When a cleaning is booked you will automatically be assigned if you
						chose the day of the week it is on.
					</Text>

					{[
						"Monday",
						"Tuesday",
						"Wednesday",
						"Thursday",
						"Friday",
						"Saturday",
						"Sunday",
					].map((day) => (
						<View key={day}>
							<Checkbox.Item
								label={day}
								status={
									employeeShifts.days.includes(day) ? "checked" : "unchecked"
								}
								onPress={() => handleDayChange(day)}
							/>
						</View>
					))}

					<Pressable onPress={handleSubmit}>
						<Text style={UserFormStyles.button}>Submit</Text>
					</Pressable>
				</View>
			</form>
			{error && <Text style={UserFormStyles.error}>{error}</Text>}
		</View>
	);
};

export default EmployeeShiftForm;
