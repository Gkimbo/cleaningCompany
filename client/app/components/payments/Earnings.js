import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

const API_BASE = "http://localhost:3000/api/v1";

const Earnings = ({ state, dispatch }) => {
  const [earnings, setEarnings] = useState({
    totalEarnings: "0.00",
    pendingEarnings: "0.00",
    completedJobs: 0,
  });
  const [assignedAppointments, setAssignedAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/payments/earnings/${state.currentUser.id}`
      );
      const data = await res.json();
      if (res.ok) {
        setEarnings(data);
      }
    } catch (err) {
      console.error("Error fetching earnings:", err);
    }
  };

  const fetchAssignedAppointments = async () => {
    if (!state?.currentUser?.id) return;
    try {
      // Get appointments assigned to this cleaner
      const myAppointments = (state?.appointments || []).filter(
        (appt) =>
          appt.employeesAssigned &&
          appt.employeesAssigned.includes(String(state.currentUser.id))
      );
      setAssignedAppointments(myAppointments);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([fetchEarnings(), fetchAssignedAppointments()]);
    setIsLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [state?.currentUser?.id, state?.appointments]);

  const handleCapturePayment = async (appointmentId) => {
    Alert.alert("Complete Job", "Mark this job as completed and release payment?", [
      { text: "Cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setIsCapturing(true);
          try {
            const res = await fetch(`${API_BASE}/payments/capture`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appointmentId }),
            });
            const data = await res.json();
            if (!res.ok)
              throw new Error(data.error || "Failed to complete job");
            Alert.alert("Success", "Job completed! Payment captured.");
            await loadData();
          } catch (err) {
            Alert.alert("Error", err.message);
          } finally {
            setIsCapturing(false);
          }
        },
      },
    ]);
  };

  const getStatusBadge = (appt) => {
    if (appt.completed) return { text: "Completed", color: "#4CAF50" };
    if (appt.paid) return { text: "Paid - Awaiting Completion", color: "#2196F3" };
    return { text: "Pending Payment", color: "#FFC107" };
  };

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F0F4F7",
        }}
      >
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={{ marginTop: 10, color: "#757575" }}>Loading earnings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        backgroundColor: "#F0F4F7",
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Total Earnings Card */}
      <View
        style={{
          backgroundColor: "#4CAF50",
          borderRadius: 20,
          padding: 25,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
          marginBottom: 15,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
            marginBottom: 5,
          }}
        >
          Total Earnings
        </Text>
        <Text style={{ color: "#fff", fontSize: 36, fontWeight: "700" }}>
          ${earnings.totalEarnings}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 5 }}>
          {earnings.completedJobs} jobs completed
        </Text>
      </View>

      {/* Pending Earnings Card */}
      <View
        style={{
          backgroundColor: "#2196F3",
          borderRadius: 20,
          padding: 25,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 6,
          marginBottom: 20,
        }}
      >
        <Text
          style={{
            color: "#fff",
            fontSize: 16,
            fontWeight: "600",
            marginBottom: 5,
          }}
        >
          Pending Earnings
        </Text>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>
          ${earnings.pendingEarnings}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 5 }}>
          Jobs in progress
        </Text>
      </View>

      {/* Assigned Appointments */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 15,
          padding: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.1,
          shadowRadius: 5,
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 15 }}>
          Your Assignments
        </Text>

        {assignedAppointments.length === 0 ? (
          <Text style={{ color: "#757575", textAlign: "center", padding: 20 }}>
            No assignments yet
          </Text>
        ) : (
          assignedAppointments.map((appt) => {
            const status = getStatusBadge(appt);
            return (
              <View
                key={appt.id}
                style={{
                  backgroundColor: "#F5F5F5",
                  borderRadius: 12,
                  padding: 15,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "600", fontSize: 16 }}>
                      {new Date(appt.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 6,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: status.color,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {status.text}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ fontWeight: "700", fontSize: 18 }}>
                    ${appt.price}
                  </Text>
                </View>

                {/* Complete Job Button */}
                {appt.paid && !appt.completed && (
                  <Pressable
                    onPress={() => handleCapturePayment(appt.id)}
                    disabled={isCapturing}
                    style={{
                      backgroundColor: isCapturing ? "#aaa" : "#4CAF50",
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      marginTop: 12,
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}
                    >
                      {isCapturing ? "Processing..." : "Mark Complete"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
};

export default Earnings;
