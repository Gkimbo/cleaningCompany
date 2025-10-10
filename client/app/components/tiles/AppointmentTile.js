import React, {useEffect, useState} from "react";
import { Pressable, Text, View, Animated, Easing } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Appointment from "../../services/fetchRequests/AppointmentClass";

const AppointmentTile = ({
  id,
  date,
  price,
  homeId,
  empoyeesNeeded,
  employeesAssigned,
  hasBeenAssigned,
  handleDeletePress,
  deleteAnimation,
  deleteConfirmation,
  setDeleteConfirmation,
  handleNoPress,
}) => {
  const[home, setHome] = useState({})
  const navigate = useNavigate();
  const numberOfAssigned = employeesAssigned.length;
  const fetchHomeInfo = async() => {
    const response = await Appointment.getHomeInfo(homeId)
    setHome(response.home[0])
  }

  useEffect(() => {
    fetchHomeInfo()
  }, []);

  const formatDate = (dateString) => {
    const options = { month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleAppointmentPress = () => {
    navigate(`/assign-cleaner/${id}`);
  };


  return (
    <View style={[homePageStyles.homeTileContainer]}>
      <Text style={homePageStyles.appointmentDate}>{formatDate(date)}</Text>
      <Text style={homePageStyles.appointmentDate}>{home.nickName}</Text>
      <Text style={homePageStyles.appointmentPrice}>{`Address: ${home.address}, ${home.city}, ${home.state}, ${home.zipcode}`}</Text>
      <Text style={homePageStyles.appointmentDate}>$ {price}</Text>
      <Text style={homePageStyles.appointmentPrice}>
        Number of cleaners needed: {empoyeesNeeded - numberOfAssigned}
      </Text>
      <Text style={homePageStyles.appointmentPrice}>
        Number of cleaners assigned: {numberOfAssigned}
      </Text>
      <Pressable
        style={{...homePageStyles.backButtonForm, width: "30%", height: "15%",  paddingTop: "4%", alignItems: "center", justifyContent: "center",}}
        onPress={handleAppointmentPress}
          ><Text style={{ fontSize: "150%", fontWeight: "bold", textAlign: "center" }}>Assign Employees</Text>
      </Pressable>
      <View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: deleteConfirmation[id]
						? "flex-start"
						: "space-between",
          paddingTop: "7%"
				}}
			>
				<Pressable
					onPress={() => handleDeletePress(id)}
					accessible={true}
					accessibilityLabel="Delete Button"
				>
					{({ pressed }) => (
						<Animated.View
							style={{
								borderRadius: 20,
								marginRight: 10,
                                padding: 10,
								width: deleteConfirmation[id] ? 75 : pressed ? 40 : 30,
								height: deleteConfirmation[id] ? 25 : pressed ? 40 : 30,
								backgroundColor: deleteConfirmation[id]
									? "red"
									: pressed
										? "red"
										: "#d65d5d",
								justifyContent: "center",
								alignItems: "center",
							}}
						>
							<Text
								style={{
									color: "white",
									fontWeight: "bold",
									fontSize: deleteConfirmation[id] ? 10 : 14,
								}}
							>
								{deleteConfirmation[id] ? "Delete Appointment" : "X"}
							</Text>
						</Animated.View>
					)}
				</Pressable>

				{deleteConfirmation[id] && (
					<Pressable
						onPress={() => handleNoPress(id)}
						accessible={true}
						accessibilityLabel="Keep Button"
					>
						<View
							style={{
								backgroundColor: "#28A745",
								borderRadius: 20,
								width: 80,
								height: 30,
                                padding: 10,
								justifyContent: "center",
								alignItems: "center",
							}}
						>
							<Text
								style={{
									color: "white",
									fontWeight: "bold",
									fontSize: 10,
								}}
							>
								Keep Appointment
							</Text>
						</View>
					</Pressable>
				)}
			</View>
    </View>
  );
};

export default AppointmentTile;
