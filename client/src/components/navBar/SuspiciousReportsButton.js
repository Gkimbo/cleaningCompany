import React, { useEffect, useState, useContext } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigate } from "react-router-native";
import { UserContext } from "../../context/UserContext";
import { useSocket } from "../../services/SocketContext";
import SuspiciousReportsService from "../../services/fetchRequests/SuspiciousReportsService";
import ButtonStyles from "../../services/styles/ButtonStyles";

const SuspiciousReportsButton = ({ closeModal }) => {
  const [redirect, setRedirect] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const navigate = useNavigate();
  const { state } = useContext(UserContext);
  const { onSuspiciousActivityReport, onSuspiciousReportUpdated } = useSocket();

  // Fetch pending count on mount
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (state.currentUser?.token) {
        const stats = await SuspiciousReportsService.getStats(state.currentUser.token);
        setPendingCount(stats.pending || 0);
      }
    };
    fetchPendingCount();
  }, [state.currentUser?.token]);

  // Listen for new suspicious reports (real-time updates)
  useEffect(() => {
    const unsubscribeNew = onSuspiciousActivityReport((data) => {
      // Update pending count from socket event
      if (data.pendingCount !== undefined) {
        setPendingCount(data.pendingCount);
      } else {
        // Increment count if no pendingCount provided
        setPendingCount((prev) => prev + 1);
      }
    });

    const unsubscribeUpdated = onSuspiciousReportUpdated((data) => {
      // Update pending count when a report is reviewed
      if (data.pendingCount !== undefined) {
        setPendingCount(data.pendingCount);
      }
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdated();
    };
  }, [onSuspiciousActivityReport, onSuspiciousReportUpdated]);

  useEffect(() => {
    if (redirect) {
      navigate("/suspicious-reports");
      setRedirect(false);
    }
  }, [redirect]);

  const handlePress = () => {
    closeModal();
    setRedirect(true);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        ButtonStyles.glassButton,
        pressed && ButtonStyles.glassButtonPressed,
      ]}
      onPress={handlePress}
    >
      <Feather name="alert-triangle" size={18} color="#E5E7EB" style={{ marginRight: 12 }} />
      <Text style={ButtonStyles.buttonText}>Suspicious Reports</Text>
      {pendingCount > 0 && (
        <View style={{
          backgroundColor: "#EF4444",
          borderRadius: 10,
          minWidth: 20,
          height: 20,
          alignItems: "center",
          justifyContent: "center",
          marginLeft: 8,
          paddingHorizontal: 6,
        }}>
          <Text style={{
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: "bold",
          }}>
            {pendingCount > 99 ? "99+" : pendingCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default SuspiciousReportsButton;
