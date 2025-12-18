import React, { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";

const AppointmentTile = ({
  id,
  date,
  price,
  homeId,
  empoyeesNeeded,
  employeesAssigned,
  handleDeletePress,
  deleteAnimation,
  deleteConfirmation,
  setDeleteConfirmation,
  handleNoPress,
}) => {
  const [home, setHome] = useState({});
  const navigate = useNavigate();
  const numberOfAssigned = Array.isArray(employeesAssigned)
    ? employeesAssigned.length
    : 0;

  const fetchHomeInfo = async () => {
    try {
      const response = await Appointment.getHomeInfo(homeId);
      if (response?.home?.[0]) {
        setHome(response.home[0]);
      }
    } catch (error) {
      console.error("Error fetching home info:", error);
    }
  };

  useEffect(() => {
    fetchHomeInfo();
  }, []);

  const formatDate = (dateString) => {
    const options = { month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const handleAppointmentPress = () => {
    navigate(`/assign-cleaner/${id}`);
  };

  // Determine status color for left accent
  let statusColor = "#dc3545"; // Red = none assigned
  if (numberOfAssigned === empoyeesNeeded) statusColor = "#28a745"; // Green = all assigned
  else if (numberOfAssigned > 0) statusColor = "#ffc107"; // Orange = partially assigned

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#fff",
        borderRadius: 12,
        marginVertical: 8,
        marginHorizontal: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Left colored accent */}
      <View
        style={{
          width: 8,
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
          backgroundColor: statusColor,
        }}
      />

      {/* Main content */}
      <View style={{ flex: 1, padding: 15 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#333" }}>
            {formatDate(date)}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#333" }}>
            ${price}
          </Text>
        </View>

        {/* Home Info */}
        <View style={{ marginTop: 5 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#555" }}>
            {home.nickName || "Home Name"}
          </Text>
          <Text style={{ fontSize: 13, color: "#777", marginTop: 2 }}>
            {home.address}, {home.city}, {home.state} {home.zipcode}
          </Text>
        </View>

        {/* Cleaners Info */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 10,
          }}
        >
          <Text style={{ fontSize: 14, color: "#555" }}>
            Cleaners Needed: {empoyeesNeeded - numberOfAssigned}
          </Text>
          <Text style={{ fontSize: 14, color: "#555" }}>
            Assigned: {numberOfAssigned}
          </Text>
        </View>

        {/* Buttons */}
        <View
          style={{
            flexDirection: "row",
            marginTop: 12,
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          {/* Assign Button */}
          <Pressable
            style={{
              backgroundColor: "#007bff",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 8,
            }}
            onPress={handleAppointmentPress}
          >
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>
              Assign Employees
            </Text>
          </Pressable>

          {/* Delete/Keep Buttons stacked vertically */}
          <View style={{ flexDirection: "column", alignItems: "flex-end" }}>
            {/* Delete Button */}
            <Pressable onPress={() => handleDeletePress(id)}>
              {({ pressed }) => (
                <Animated.View
                  style={{
                    borderRadius: 8,
                    marginBottom: deleteConfirmation[id] ? 6 : 0,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: deleteConfirmation[id]
                      ? "#dc3545"
                      : pressed
                      ? "#c82333"
                      : "#e04e4e",
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: deleteConfirmation[id] ? 12 : 14,
                    }}
                  >
                    {deleteConfirmation[id] ? "Delete Appointment" : "X"}
                  </Text>
                </Animated.View>
              )}
            </Pressable>

            {/* Keep Button */}
            {deleteConfirmation[id] && (
              <Pressable onPress={() => handleNoPress(id)}>
                <View
                  style={{
                    backgroundColor: "#28a745",
                    borderRadius: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: 12,
                    }}
                  >
                    Keep Appointment
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

export default AppointmentTile;
