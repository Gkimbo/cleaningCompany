import React, { useEffect, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import FetchData from "../../../services/fetchRequests/fetchData";
import CleanerCancellationWarningModal from "../../modals/CleanerCancellationWarningModal";

const EmployeeAssignmentTile = ({
  id,
  cleanerId,
  date,
  price,
  homeId,
  bringSheets,
  bringTowels,
  completed,
  keyPadCode,
  keyLocation,
  addEmployee,
  removeEmployee,
  assigned,
  distance,
  timeToBeCompleted,
  token,
  onCancelComplete,
}) => {
  const navigate = useNavigate();
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({
    address: "",
    city: "",
    state: "",
    zipcode: "",
    numBaths: "",
    numBeds: "",
    cleanersNeeded: "",
  });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [loadingCancellation, setLoadingCancellation] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState(null);

  const amount = Number(price) * 0.9;

  const formatDate = (dateString) => {
    const date = new Date(dateString + "T00:00:00");
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return date.toLocaleDateString(undefined, options);
  };

  const expandDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(true);
  };

  const contractDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(false);
  };

  useEffect(() => {
    FetchData.getHome(homeId).then((response) => {
      setHome(response.home);
    });
  }, [homeId]);

  const miles = distance ? (distance * 0.621371).toFixed(1) : null;
  const kilometers = distance ? distance.toFixed(1) : null;

  const timeOptions = {
    anytime: "anytime",
    "10-3": "Between 10am and 3pm",
    "11-4": "Between 11am and 4pm",
    "12-2": "Between 12pm and 2pm",
  };

  const formattedTime = timeOptions[timeToBeCompleted] || null;

  // Handle opening cancellation modal
  const handleCancelPress = async () => {
    if (!token) {
      // Fall back to old behavior if no token
      removeEmployee(cleanerId, id);
      return;
    }
    setLoadingCancellation(true);
    setError(null);
    try {
      const info = await FetchData.getCancellationInfo(id, token);
      if (info.error) {
        setError(info.error);
        setLoadingCancellation(false);
        return;
      }
      setCancellationInfo(info);
      setShowCancelModal(true);
    } catch (err) {
      setError("Failed to load cancellation info");
    } finally {
      setLoadingCancellation(false);
    }
  };

  // Handle confirming cancellation
  const handleConfirmCancel = async () => {
    setCancelLoading(true);
    try {
      // Pass acknowledged: true since user confirmed via the modal checkbox
      const result = await FetchData.cancelAsCleaner(id, token, true);
      if (result.error) {
        setError(result.error);
        setCancelLoading(false);
        return;
      }
      setShowCancelModal(false);

      // Show account frozen alert if applicable
      if (result.accountFrozen) {
        setError("Your account has been frozen due to too many cancellations. Please contact support.");
      }

      // Call the callback to remove from list
      if (onCancelComplete) {
        onCancelComplete(id, result);
      } else {
        // Fall back to removeEmployee if no callback provided
        removeEmployee(cleanerId, id);
      }
    } catch (err) {
      setError("Failed to cancel job");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <View style={styles.tileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        <Text style={styles.date}>{formatDate(date)}</Text>

        {formattedTime && (
          <View style={styles.timeContainer}>
            <Text style={styles.timeLabel}>Time to complete:</Text>
            <Text style={styles.timeText}>{`${formattedTime} on ${formatDate(date)}`}</Text>
          </View>
        )}

        <Text style={styles.amount}>You could make ${amount} cleaning this home</Text>
        <Text style={styles.location}>{home.city}</Text>
        <Text style={styles.location}>
          {home.state}, {home.zipcode}
        </Text>

        <View style={styles.distanceContainer}>
          {distance !== null ? (
            <>
              <Text style={styles.distanceLabel}>Distance to the center of town:</Text>
              <Text style={styles.distanceValue}>
                {miles} mi <Text style={styles.distanceKm}>({kilometers} km)</Text>
              </Text>
              <Text style={styles.addressInfo}>Address available on the day of the appointment.</Text>
            </>
          ) : (
            <Text style={styles.unknownDistance}>Distance: Unknown</Text>
          )}
        </View>

        {(expandWindow || assigned) && (
          <>
            <Text style={styles.infoText}>Beds: {home.numBeds}</Text>
            <Text style={styles.infoText}>Bathrooms: {home.numBaths}</Text>
            <Text style={styles.infoText}>Sheets needed: {bringSheets}</Text>
            <Text style={styles.infoText}>Towels needed: {bringTowels}</Text>

            {home.cleanersNeeded > 1 && (
              <>
                <Text style={styles.warning}>
                  This is a larger home. You may need more people to clean it in a timely manner.
                </Text>
                <Text style={styles.infoText}>
                  If you don’t think you can complete it, please choose a smaller home!
                </Text>
              </>
            )}
          </>
        )}
      </Pressable>

      {assigned ? (
        <Pressable
          style={[styles.button, styles.cancelButton, loadingCancellation && styles.buttonDisabled]}
          onPress={handleCancelPress}
          disabled={loadingCancellation}
        >
          {loadingCancellation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>I no longer want to clean this home!</Text>
          )}
        </Pressable>
      ) : (
        <Pressable
          style={[styles.button, styles.acceptButton]}
          onPress={() => addEmployee(cleanerId, id)}
        >
          <Text style={styles.buttonText}>I want to clean this home!</Text>
        </Pressable>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Cleaner Cancellation Warning Modal */}
      <CleanerCancellationWarningModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        cancellationInfo={cancellationInfo}
        loading={cancelLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  tileContainer: {
    backgroundColor: "#fff",
    padding: 18,
    marginVertical: 10,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    alignItems: "center",
  },
  date: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C3E50",
    marginBottom: 6,
    textAlign: "center",
  },
  amount: {
    fontSize: 15,
    fontWeight: "600",
    color: "#34495E",
    marginBottom: 6,
    textAlign: "center",
  },
  location: {
    fontSize: 14,
    fontWeight: "500",
    color: "#7F8C8D",
    textAlign: "center",
  },
  distanceContainer: {
    marginVertical: 10,
  },
  distanceLabel: {
    fontSize: 12,
    color: "#7F8C8D",
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C3E50",
  },
  distanceKm: {
    fontSize: 12,
    color: "#7F8C8D",
  },
  addressInfo: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 4,
    textAlign: "center",
  },
  unknownDistance: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#34495E",
    marginTop: 4,
    textAlign: "center",
  },
  warning: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#E74C3C",
    marginTop: 8,
    textAlign: "center",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    marginTop: 12,
    justifyContent: "center",
    alignItems: "center",
    minWidth: "80%",
  },
  cancelButton: {
    backgroundColor: "#E74C3C",
  },
  acceptButton: {
    backgroundColor: "#2ECC71",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  errorContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#FDECEA",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F5C6CB",
  },
  errorText: {
    color: "#C0392B",
    fontSize: 13,
    textAlign: "center",
  },
  timeContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#34495E",
  },
  timeText: {
    fontSize: 13,
    color: "#7F8C8D",
    marginTop: 2,
    textAlign: "center",
  },
});

export default EmployeeAssignmentTile;
