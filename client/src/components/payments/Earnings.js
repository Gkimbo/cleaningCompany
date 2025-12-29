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
import StripeConnectOnboarding from "./StripeConnectOnboarding";
import PayoutHistory from "./PayoutHistory";
import EarningsChart from "./EarningsChart";
import { API_BASE } from "../../services/config";
import { usePricing } from "../../context/PricingContext";

const Earnings = ({ state, dispatch }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [activeTab, setActiveTab] = useState("overview");
  const [earnings, setEarnings] = useState({
    totalEarnings: "0.00",
    pendingEarnings: "0.00",
    completedJobs: 0,
    platformFeePercent: 10,
    cleanerPercent: 90,
  });
  const [accountStatus, setAccountStatus] = useState(null);
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

  const fetchAccountStatus = async () => {
    if (!state?.currentUser?.id) return;
    try {
      const res = await fetch(
        `${API_BASE}/stripe-connect/account-status/${state.currentUser.id}`
      );
      const data = await res.json();
      if (res.ok) {
        setAccountStatus(data);
      }
    } catch (err) {
      console.error("Error fetching account status:", err);
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
    await Promise.all([fetchEarnings(), fetchAccountStatus(), fetchAssignedAppointments()]);
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

  // Calculate cleaner's share for display
  const calculateCleanerShare = (price, numCleaners = 1) => {
    const gross = parseFloat(price) || 0;
    const perCleaner = gross / numCleaners;
    const cleanerShare = perCleaner * cleanerSharePercent;
    return cleanerShare.toFixed(2);
  };

  // Calculate potential earnings from assigned appointments (not completed)
  const calculatePotentialEarnings = () => {
    return assignedAppointments
      .filter((appt) => !appt.completed) // Only non-completed jobs
      .reduce((total, appt) => {
        const numCleaners = appt.employeesAssigned?.length || 1;
        const share = parseFloat(calculateCleanerShare(appt.price, numCleaners));
        return total + share;
      }, 0)
      .toFixed(2);
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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "account":
        return <StripeConnectOnboarding state={state} dispatch={dispatch} />;
      case "history":
        return <PayoutHistory state={state} dispatch={dispatch} />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
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
      {/* Account Status Banner */}
      {accountStatus && !accountStatus.onboardingComplete && (
        <Pressable
          onPress={() => setActiveTab("account")}
          style={{
            backgroundColor: "#FFF3E0",
            borderRadius: 10,
            padding: 15,
            marginBottom: 15,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#E65100", flex: 1, fontWeight: "500" }}>
            {accountStatus.hasAccount
              ? "Complete your account setup to receive payouts"
              : "Set up your payment account to receive earnings"}
          </Text>
          <Text style={{ color: "#E65100", fontWeight: "700" }}>→</Text>
        </Pressable>
      )}

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

      {/* Potential Earnings Card */}
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
          Potential Earnings
        </Text>
        <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>
          ${calculatePotentialEarnings()}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 5 }}>
          {assignedAppointments.filter((a) => !a.completed).length} upcoming {assignedAppointments.filter((a) => !a.completed).length === 1 ? "job" : "jobs"}
        </Text>
      </View>

      {/* Earnings Chart */}
      <EarningsChart
        appointments={state?.appointments || []}
        currentUserId={state?.currentUser?.id}
      />

      {/* Earnings Info */}
      <View
        style={{
          backgroundColor: "#E3F2FD",
          borderRadius: 10,
          padding: 15,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "#1565C0", fontSize: 13, lineHeight: 18 }}>
          Payouts are automatic when you mark jobs complete.
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
            const numCleaners = appt.employeesAssigned?.length || 1;
            const yourShare = calculateCleanerShare(appt.price, numCleaners);
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
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "700", fontSize: 18, color: "#4CAF50" }}>
                      ${yourShare}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#757575" }}>
                      your earnings
                    </Text>
                  </View>
                </View>

                {numCleaners > 1 && (
                  <Text style={{ fontSize: 11, color: "#757575", marginTop: 8 }}>
                    Split between {numCleaners} cleaners (Job total: ${appt.price})
                  </Text>
                )}

                {/* Complete Job Button */}
                {appt.paid && !appt.completed && (
                  <Pressable
                    onPress={() => handleCapturePayment(appt.id)}
                    disabled={isCapturing || !accountStatus?.onboardingComplete}
                    style={{
                      backgroundColor: isCapturing || !accountStatus?.onboardingComplete ? "#aaa" : "#4CAF50",
                      paddingVertical: 12,
                      borderRadius: 10,
                      alignItems: "center",
                      marginTop: 12,
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}
                    >
                      {isCapturing ? "Processing..." : "Mark Complete & Get Paid"}
                    </Text>
                  </Pressable>
                )}

                {appt.paid && !appt.completed && !accountStatus?.onboardingComplete && (
                  <Pressable onPress={() => setActiveTab("account")}>
                    <Text style={{ color: "#E65100", fontSize: 12, textAlign: "center", marginTop: 8 }}>
                      Set up payment account first →
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

  return (
    <View style={{ flex: 1, backgroundColor: "#F0F4F7" }}>
      {/* Tab Navigation */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#fff",
          paddingHorizontal: 10,
          paddingTop: 10,
          borderBottomWidth: 1,
          borderBottomColor: "#E0E0E0",
        }}
      >
        {[
          { key: "overview", label: "Overview" },
          { key: "history", label: "Payouts" },
          { key: "account", label: "Account" },
        ].map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 12,
              borderBottomWidth: 3,
              borderBottomColor: activeTab === tab.key ? "#007BFF" : "transparent",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                fontWeight: activeTab === tab.key ? "700" : "500",
                color: activeTab === tab.key ? "#007BFF" : "#757575",
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Content */}
      {renderTabContent()}
    </View>
  );
};

export default Earnings;
