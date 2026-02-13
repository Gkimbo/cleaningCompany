import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import NotificationsService from "../../services/fetchRequests/NotificationsService";
import { Feather } from "@expo/vector-icons";
import styles from "../onboarding/OnboardingStyles";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} from "../../services/styles/theme";
import { usePricing, getTimeWindowOptions } from "../../context/PricingContext";
import PreferredCleanersSection from "./PreferredCleanersSection";

const STEPS = {
  BASICS: 0,
  ACCESS: 1,
  SERVICES: 2,
  REVIEW: 3,
};

const BED_SIZE_OPTIONS = [
  { value: "long_twin", label: "Long Twin" },
  { value: "twin", label: "Twin" },
  { value: "full", label: "Full" },
  { value: "queen", label: "Queen" },
  { value: "king", label: "King" },
  { value: "california_king", label: "California King" },
];

const BED_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const BATH_OPTIONS = [
  "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5",
  "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"
];

const EditHomeForm = ({ state, dispatch }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { pricing } = usePricing();

  const TIME_WINDOW_OPTIONS = getTimeWindowOptions(pricing);

  const [currentStep, setCurrentStep] = useState(STEPS.BASICS);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteFee, setDeleteFee] = useState(0);
  const [showServiceAreaWarning, setShowServiceAreaWarning] = useState(false);
  const [serviceAreaMessage, setServiceAreaMessage] = useState("");
  const [showBedroomPicker, setShowBedroomPicker] = useState(false);
  const [showBathroomPicker, setShowBathroomPicker] = useState(false);

  // New Home Request state
  const [homeRequests, setHomeRequests] = useState([]);
  const [isMarketplaceEnabled, setIsMarketplaceEnabled] = useState(false);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [requestAgainLoading, setRequestAgainLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);

  const [homeData, setHomeData] = useState({
    id: "",
    nickName: "",
    address: "",
    city: "",
    state: "",
    zipcode: "",
    numBeds: "",
    numBaths: "",
    accessType: "code",
    keyPadCode: "",
    keyLocation: "",
    trashLocation: "",
    hasRecycling: false,
    recyclingLocation: "",
    hasCompost: false,
    compostLocation: "",
    timeToBeCompleted: "anytime",
    sheetsProvided: "no",
    towelsProvided: "no",
    contact: "",
    specialNotes: "",
    // New fields for sheets/towels details
    cleanSheetsLocation: "",
    dirtySheetsLocation: "",
    cleanTowelsLocation: "",
    dirtyTowelsLocation: "",
    bedConfigurations: [],
    bathroomConfigurations: [],
  });

  useEffect(() => {
    const idNeeded = Number(id);
    const foundHome = state.homes.find((home) => home.id === idNeeded);
    if (foundHome) {
      setHomeData({
        ...foundHome,
        accessType: foundHome.keyPadCode ? "code" : "key",
        hasRecycling: !!foundHome.recyclingLocation,
        hasCompost: !!foundHome.compostLocation,
        cleanSheetsLocation: foundHome.cleanSheetsLocation || "",
        dirtySheetsLocation: foundHome.dirtySheetsLocation || "",
        cleanTowelsLocation: foundHome.cleanTowelsLocation || "",
        dirtyTowelsLocation: foundHome.dirtyTowelsLocation || "",
        bedConfigurations: foundHome.bedConfigurations || [],
        bathroomConfigurations: foundHome.bathroomConfigurations || [],
      });
      setIsMarketplaceEnabled(foundHome.isMarketplaceEnabled || false);
    }
  }, [id, state.homes]);

  // Fetch new home request status
  useEffect(() => {
    const fetchRequestStatus = async () => {
      if (!id || !user?.token) return;
      setRequestsLoading(true);
      try {
        const result = await NotificationsService.getNewHomeRequestStatus(user.token, id);
        if (result.success) {
          setHomeRequests(result.requests || []);
          setIsMarketplaceEnabled(result.isMarketplaceEnabled || false);
        }
      } catch (error) {
        console.error("Error fetching home request status:", error);
      } finally {
        setRequestsLoading(false);
      }
    };
    fetchRequestStatus();
  }, [id, user?.token]);

  const updateField = (field, value) => {
    setHomeData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Initialize bed configurations when numBeds changes and sheets = "yes"
  const initializeBedConfigurations = (numBeds) => {
    const beds = parseInt(numBeds) || 0;
    const configs = [];
    for (let i = 1; i <= beds; i++) {
      configs.push({ bedNumber: i, size: "queen", needsSheets: true });
    }
    return configs;
  };

  // Initialize bathroom configurations when numBaths changes and towels = "yes"
  // Use Math.ceil to handle half bathrooms (e.g., "2.5" -> 3 configs)
  const initializeBathroomConfigurations = (numBaths) => {
    const baths = Math.ceil(parseFloat(numBaths)) || 0;
    const configs = [];
    for (let i = 1; i <= baths; i++) {
      configs.push({ bathroomNumber: i, towels: 2, faceCloths: 1 });
    }
    return configs;
  };

  // Update a specific bed configuration
  const updateBedConfig = (bedNumber, field, value) => {
    setHomeData((prev) => {
      const updatedConfigs = prev.bedConfigurations.map((bed) =>
        bed.bedNumber === bedNumber ? { ...bed, [field]: value } : bed
      );
      return { ...prev, bedConfigurations: updatedConfigs };
    });
  };

  // Update a specific bathroom configuration
  const updateBathroomConfig = (bathroomNumber, field, value) => {
    setHomeData((prev) => {
      const updatedConfigs = prev.bathroomConfigurations.map((bath) =>
        bath.bathroomNumber === bathroomNumber ? { ...bath, [field]: value } : bath
      );
      return { ...prev, bathroomConfigurations: updatedConfigs };
    });
  };

  // Handle sheets toggle
  const handleSheetsToggle = () => {
    const newValue = homeData.sheetsProvided === "yes" ? "no" : "yes";
    if (newValue === "yes" && homeData.numBeds) {
      setHomeData((prev) => ({
        ...prev,
        sheetsProvided: newValue,
        bedConfigurations:
          prev.bedConfigurations.length > 0
            ? prev.bedConfigurations
            : initializeBedConfigurations(prev.numBeds),
      }));
    } else {
      setHomeData((prev) => ({
        ...prev,
        sheetsProvided: newValue,
      }));
    }
  };

  // Handle towels toggle
  const handleTowelsToggle = () => {
    const newValue = homeData.towelsProvided === "yes" ? "no" : "yes";
    if (newValue === "yes" && homeData.numBaths) {
      setHomeData((prev) => ({
        ...prev,
        towelsProvided: newValue,
        bathroomConfigurations:
          prev.bathroomConfigurations.length > 0
            ? prev.bathroomConfigurations
            : initializeBathroomConfigurations(prev.numBaths),
      }));
    } else {
      setHomeData((prev) => ({
        ...prev,
        towelsProvided: newValue,
      }));
    }
  };

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6)
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(
      6,
      10
    )}`;
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === STEPS.BASICS) {
      if (!homeData.nickName?.trim())
        newErrors.nickName = "Give your home a name";
      if (!homeData.address?.trim()) newErrors.address = "Address is required";
      if (!homeData.city?.trim()) newErrors.city = "City is required";
      if (!homeData.state) newErrors.state = "Select a state";
      if (!homeData.zipcode || homeData.zipcode.length !== 5) {
        newErrors.zipcode = "Enter a valid 5-digit zip code";
      }
      if (!homeData.numBeds) newErrors.numBeds = "Required";
      if (!homeData.numBaths) newErrors.numBaths = "Required";
    }

    if (step === STEPS.ACCESS) {
      if (homeData.accessType === "code" && !homeData.keyPadCode?.trim()) {
        newErrors.keyPadCode = "Enter the door code";
      }
      if (homeData.accessType === "key" && !homeData.keyLocation?.trim()) {
        newErrors.keyLocation = "Describe where the key is located";
      }
      if (!homeData.trashLocation?.trim()) {
        newErrors.trashLocation = "Tell us where to put the trash";
      }
      if (!homeData.contact || homeData.contact.length < 12) {
        newErrors.contact = "Enter a valid phone number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.BASICS) {
      navigate("/edit-home");
    } else {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const submitData = {
        id: homeData.id,
        nickName: homeData.nickName,
        address: homeData.address,
        city: homeData.city,
        state: homeData.state,
        zipcode: homeData.zipcode,
        numBeds: homeData.numBeds,
        numBaths: homeData.numBaths,
        keyPadCode: homeData.accessType === "code" ? homeData.keyPadCode : "",
        keyLocation: homeData.accessType === "key" ? homeData.keyLocation : "",
        trashLocation: homeData.trashLocation,
        recyclingLocation: homeData.hasRecycling
          ? homeData.recyclingLocation
          : "",
        compostLocation: homeData.hasCompost ? homeData.compostLocation : "",
        timeToBeCompleted: homeData.timeToBeCompleted,
        sheetsProvided: homeData.sheetsProvided,
        towelsProvided: homeData.towelsProvided,
        contact: homeData.contact,
        specialNotes: homeData.specialNotes,
        // New fields for sheets/towels details
        cleanSheetsLocation: homeData.sheetsProvided === "no" ? homeData.cleanSheetsLocation : "",
        dirtySheetsLocation: homeData.sheetsProvided === "no" ? homeData.dirtySheetsLocation : "",
        cleanTowelsLocation: homeData.towelsProvided === "no" ? homeData.cleanTowelsLocation : "",
        dirtyTowelsLocation: homeData.towelsProvided === "no" ? homeData.dirtyTowelsLocation : "",
        // Always save configurations so they can be restored when toggled back on
        bedConfigurations: homeData.bedConfigurations,
        bathroomConfigurations: homeData.bathroomConfigurations,
      };

      const response = await FetchData.editHomeInfo(submitData, user);

      if (
        response === "Cannot find zipcode" ||
        response?.error === "Cannot find zipcode"
      ) {
        setErrors({
          submit:
            "We couldn't verify this zip code. Please check and try again.",
        });
        setCurrentStep(STEPS.BASICS);
      } else if (response.error) {
        setErrors({ submit: response.error });
      } else {
        // Include outsideServiceArea flag in the updated home data
        const updatedHomeData = {
          ...submitData,
          outsideServiceArea: response.outsideServiceArea || false,
        };
        dispatch({
          type: "UPDATE_HOME",
          payload: {
            id: homeData.id,
            updatedHome: updatedHomeData,
          },
        });
        // Check if the home is outside service area and show warning
        if (response.outsideServiceArea) {
          setServiceAreaMessage(
            response.serviceAreaMessage ||
              "This home is outside our current service area. It has been saved to your profile, but you won't be able to book appointments until we expand to this area."
          );
          setShowServiceAreaWarning(true);
        } else {
          navigate("/list-of-homes");
        }
      }
    } catch (error) {
      setErrors({ submit: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismissServiceAreaWarning = () => {
    setShowServiceAreaWarning(false);
    navigate("/list-of-homes");
  };

  const checkAppointmentsWithinWeek = async (homeId) => {
    const appointments = await Appointment.getHomeAppointments(homeId);
    const currentDate = new Date();
    const { cancellation } = pricing;
    let fee = 0;

    if (appointments?.appointments) {
      appointments.appointments.forEach((appt) => {
        const date = new Date(appt.date);
        if (
          date.getTime() - currentDate.getTime() <= cancellation.windowDays * 24 * 60 * 60 * 1000 &&
          date.getTime() - currentDate.getTime() >= 0
        ) {
          fee += cancellation.fee;
        }
      });
    }

    setDeleteFee(fee);
    return fee > 0;
  };

  const handleDeletePress = async () => {
    const hasUpcomingAppointments = await checkAppointmentsWithinWeek(
      homeData.id
    );
    setDeleteModalVisible(true);
  };

  // Handle marketplace toggle
  const handleMarketplaceToggle = async (enabled) => {
    setMarketplaceLoading(true);
    try {
      const result = await NotificationsService.toggleHomeMarketplace(user.token, id, enabled);
      if (result.success) {
        setIsMarketplaceEnabled(enabled);
        Alert.alert(
          enabled ? "Marketplace Enabled" : "Marketplace Disabled",
          enabled
            ? "Your home is now visible to cleaners on the marketplace."
            : "Your home has been removed from the marketplace."
        );
      } else {
        Alert.alert("Error", result.error || "Failed to update marketplace setting.");
      }
    } catch (error) {
      console.error("Error toggling marketplace:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setMarketplaceLoading(false);
    }
  };

  // Handle request again for a declined request
  const handleRequestAgain = async (requestId) => {
    setRequestAgainLoading(true);
    try {
      const result = await NotificationsService.requestAgain(user.token, requestId);
      if (result.success) {
        // Refresh the requests list
        const statusResult = await NotificationsService.getNewHomeRequestStatus(user.token, id);
        if (statusResult.success) {
          setHomeRequests(statusResult.requests || []);
        }
        Alert.alert("Request Sent", "Your request has been sent to the cleaner.");
      } else {
        Alert.alert("Error", result.error || "Failed to send request.");
      }
    } catch (error) {
      console.error("Error requesting again:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setRequestAgainLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteModalVisible(false);
    setIsLoading(true);

    try {
      const appointments = await Appointment.getHomeAppointments(homeData.id);
      const deleteHome = await FetchData.deleteHome(homeData.id);

      if (deleteHome) {
        let priceOfAppointments = 0;
        if (appointments?.appointments) {
          appointments.appointments.forEach((appt) => {
            priceOfAppointments += Number(appt.price);
          });

          dispatch({ type: "SUBTRACT_BILL", payload: priceOfAppointments });

          const filteredAppointments = state.appointments.filter(
            (appointment) =>
              !appointments.appointments.some((a) => a.id === appointment.id)
          );
          dispatch({
            type: "USER_APPOINTMENTS",
            payload: filteredAppointments,
          });
        }

        dispatch({ type: "DELETE_HOME", payload: homeData.id });
        navigate("/list-of-homes");
      }
    } catch (error) {
      setErrors({ submit: "Failed to delete home. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[0, 1, 2, 3].map((step, index) => (
        <React.Fragment key={step}>
          <View
            style={[
              styles.stepDot,
              currentStep === step && styles.stepDotActive,
              currentStep > step && styles.stepDotCompleted,
            ]}
          />
          {index < 3 && (
            <View
              style={[
                styles.stepLine,
                currentStep > step && styles.stepLineActive,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderBasicsStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Home Details</Text>
      <Text style={styles.sectionSubtitle}>
        Update your home's basic information.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Home Name <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "nickName" && styles.inputFocused,
            errors.nickName && styles.inputError,
          ]}
          placeholder="e.g., Beach House, Main Residence"
          placeholderTextColor="#94a3b8"
          value={homeData.nickName}
          onChangeText={(text) => updateField("nickName", text)}
          onFocus={() => setFocusedField("nickName")}
          onBlur={() => setFocusedField(null)}
        />
        {errors.nickName && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
            {errors.nickName}
          </Text>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Street Address <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "address" && styles.inputFocused,
            errors.address && styles.inputError,
          ]}
          placeholder="123 Main Street"
          placeholderTextColor="#94a3b8"
          value={homeData.address}
          onChangeText={(text) => updateField("address", text)}
          onFocus={() => setFocusedField("address")}
          onBlur={() => setFocusedField(null)}
        />
        {errors.address && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
            {errors.address}
          </Text>
        )}
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.inputLabel}>
            City <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "city" && styles.inputFocused,
              errors.city && styles.inputError,
            ]}
            placeholder="City"
            placeholderTextColor="#94a3b8"
            value={homeData.city}
            onChangeText={(text) => updateField("city", text)}
            onFocus={() => setFocusedField("city")}
            onBlur={() => setFocusedField(null)}
          />
        </View>

        <View style={[styles.inputGroup, styles.inputThird]}>
          <Text style={styles.inputLabel}>
            State <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "state" && styles.inputFocused,
              errors.state && styles.inputError,
            ]}
            placeholder="CA"
            placeholderTextColor="#94a3b8"
            value={homeData.state}
            onChangeText={(text) =>
              updateField("state", text.toUpperCase().slice(0, 2))
            }
            onFocus={() => setFocusedField("state")}
            onBlur={() => setFocusedField(null)}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Zip Code <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "zipcode" && styles.inputFocused,
            errors.zipcode && styles.inputError,
            { width: 120 },
          ]}
          placeholder="12345"
          placeholderTextColor="#94a3b8"
          value={homeData.zipcode}
          onChangeText={(text) =>
            updateField("zipcode", text.replace(/\D/g, "").slice(0, 5))
          }
          onFocus={() => setFocusedField("zipcode")}
          onBlur={() => setFocusedField(null)}
          keyboardType="number-pad"
          maxLength={5}
        />
        {errors.zipcode && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
            {errors.zipcode}
          </Text>
        )}
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.inputLabel}>
            Bedrooms <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              },
              errors.numBeds && styles.inputError,
            ]}
            onPress={() => setShowBedroomPicker(true)}
          >
            <Text
              style={{
                fontSize: 16,
                color: homeData.numBeds ? "#1e293b" : "#94a3b8",
              }}
            >
              {homeData.numBeds || "Select"}
            </Text>
            <Text style={{ fontSize: 12, color: "#64748b" }}>▼</Text>
          </TouchableOpacity>
          {errors.numBeds && (
            <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
              {errors.numBeds}
            </Text>
          )}
        </View>

        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.inputLabel}>
            Bathrooms <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              },
              errors.numBaths && styles.inputError,
            ]}
            onPress={() => setShowBathroomPicker(true)}
          >
            <Text
              style={{
                fontSize: 16,
                color: homeData.numBaths ? "#1e293b" : "#94a3b8",
              }}
            >
              {homeData.numBaths || "Select"}
            </Text>
            <Text style={{ fontSize: 12, color: "#64748b" }}>▼</Text>
          </TouchableOpacity>
          {errors.numBaths && (
            <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
              {errors.numBaths}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  const renderAccessStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Access & Contact</Text>
      <Text style={styles.sectionSubtitle}>
        Update how cleaners access your home.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Entry Method</Text>
        <View style={styles.choiceRow}>
          <TouchableOpacity
            style={[
              styles.choiceButton,
              styles.choiceButtonFull,
              homeData.accessType === "code" && styles.choiceButtonSelected,
            ]}
            onPress={() => updateField("accessType", "code")}
          >
            <Text
              style={[
                styles.choiceButtonText,
                homeData.accessType === "code" &&
                  styles.choiceButtonTextSelected,
              ]}
            >
              Door Code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.choiceButton,
              styles.choiceButtonFull,
              homeData.accessType === "key" && styles.choiceButtonSelected,
            ]}
            onPress={() => updateField("accessType", "key")}
          >
            <Text
              style={[
                styles.choiceButtonText,
                homeData.accessType === "key" &&
                  styles.choiceButtonTextSelected,
              ]}
            >
              Hidden Key
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {homeData.accessType === "code" ? (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            Door Code <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "keyPadCode" && styles.inputFocused,
              errors.keyPadCode && styles.inputError,
            ]}
            placeholder="1234#"
            placeholderTextColor="#94a3b8"
            value={homeData.keyPadCode}
            onChangeText={(text) => updateField("keyPadCode", text)}
            onFocus={() => setFocusedField("keyPadCode")}
            onBlur={() => setFocusedField(null)}
          />
          <Text style={styles.inputHelper}>
            You can update this before each appointment
          </Text>
          {errors.keyPadCode && (
            <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
              {errors.keyPadCode}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            Key Location <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              focusedField === "keyLocation" && styles.inputFocused,
              errors.keyLocation && styles.inputError,
            ]}
            placeholder="e.g., Under the blue flower pot to the left of the front door"
            placeholderTextColor="#94a3b8"
            value={homeData.keyLocation}
            onChangeText={(text) => updateField("keyLocation", text)}
            onFocus={() => setFocusedField("keyLocation")}
            onBlur={() => setFocusedField(null)}
            multiline
          />
          {errors.keyLocation && (
            <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
              {errors.keyLocation}
            </Text>
          )}
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Trash Location <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "trashLocation" && styles.inputFocused,
            errors.trashLocation && styles.inputError,
          ]}
          placeholder="e.g., Black bin on right side of garage"
          placeholderTextColor="#94a3b8"
          value={homeData.trashLocation}
          onChangeText={(text) => updateField("trashLocation", text)}
          onFocus={() => setFocusedField("trashLocation")}
          onBlur={() => setFocusedField(null)}
        />
        {errors.trashLocation && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
            {errors.trashLocation}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.toggleCard,
          homeData.hasRecycling && styles.toggleCardActive,
        ]}
        onPress={() => updateField("hasRecycling", !homeData.hasRecycling)}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Recycling Available</Text>
          <Text style={styles.toggleCardDescription}>
            Does your home have recycling bins?
          </Text>
        </View>
        <View
          style={[
            styles.toggleSwitch,
            homeData.hasRecycling && styles.toggleSwitchActive,
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              homeData.hasRecycling && styles.toggleKnobActive,
            ]}
          />
        </View>
      </TouchableOpacity>

      {homeData.hasRecycling && (
        <View style={styles.inputGroup}>
          <TextInput
            style={[
              styles.input,
              focusedField === "recyclingLocation" && styles.inputFocused,
            ]}
            placeholder="Where is the recycling bin?"
            placeholderTextColor="#94a3b8"
            value={homeData.recyclingLocation}
            onChangeText={(text) => updateField("recyclingLocation", text)}
            onFocus={() => setFocusedField("recyclingLocation")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.toggleCard,
          homeData.hasCompost && styles.toggleCardActive,
        ]}
        onPress={() => updateField("hasCompost", !homeData.hasCompost)}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Compost Available</Text>
          <Text style={styles.toggleCardDescription}>
            Does your home have compost bins?
          </Text>
        </View>
        <View
          style={[
            styles.toggleSwitch,
            homeData.hasCompost && styles.toggleSwitchActive,
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              homeData.hasCompost && styles.toggleKnobActive,
            ]}
          />
        </View>
      </TouchableOpacity>

      {homeData.hasCompost && (
        <View style={styles.inputGroup}>
          <TextInput
            style={[
              styles.input,
              focusedField === "compostLocation" && styles.inputFocused,
            ]}
            placeholder="Where is the compost bin?"
            placeholderTextColor="#94a3b8"
            value={homeData.compostLocation}
            onChangeText={(text) => updateField("compostLocation", text)}
            onFocus={() => setFocusedField("compostLocation")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>
          Contact Phone <Text style={styles.inputRequired}>*</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "contact" && styles.inputFocused,
            errors.contact && styles.inputError,
          ]}
          placeholder="555-123-4567"
          placeholderTextColor="#94a3b8"
          value={homeData.contact}
          onChangeText={(text) =>
            updateField("contact", formatPhoneNumber(text))
          }
          onFocus={() => setFocusedField("contact")}
          onBlur={() => setFocusedField(null)}
          keyboardType="phone-pad"
          maxLength={12}
        />
        <Text style={styles.inputHelper}>
          We'll call this number if there's an issue
        </Text>
        {errors.contact && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>
            {errors.contact}
          </Text>
        )}
      </View>
    </View>
  );

  const renderServicesStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Preferences</Text>
      <Text style={styles.sectionSubtitle}>
        Update your cleaning preferences.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Preferred Time Window</Text>
        <View style={styles.choiceGroup}>
          {TIME_WINDOW_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.toggleCard,
                homeData.timeToBeCompleted === option.value &&
                  styles.toggleCardActive,
              ]}
              onPress={() => updateField("timeToBeCompleted", option.value)}
            >
              <View style={styles.toggleCardContent}>
                <Text style={styles.toggleCardTitle}>{option.label}</Text>
                <Text style={styles.toggleCardDescription}>
                  {option.description}
                </Text>
              </View>
              <View
                style={[
                  styles.toggleSwitch,
                  homeData.timeToBeCompleted === option.value &&
                    styles.toggleSwitchActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    homeData.timeToBeCompleted === option.value &&
                      styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Sheets Section */}
      <TouchableOpacity
        style={[
          styles.toggleCard,
          homeData.sheetsProvided === "yes" && styles.toggleCardActive,
        ]}
        onPress={handleSheetsToggle}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>We Bring Fresh Sheets</Text>
          <Text style={styles.toggleCardDescription}>
            {homeData.sheetsProvided === "yes" && homeData.bedConfigurations.length > 0
              ? `$${homeData.bedConfigurations.filter(b => b.needsSheets).length * pricing.linens.sheetFeePerBed} ($${pricing.linens.sheetFeePerBed} x ${homeData.bedConfigurations.filter(b => b.needsSheets).length} beds)`
              : homeData.numBeds ? `$${pricing.linens.sheetFeePerBed} x ${homeData.numBeds} beds = $${parseInt(homeData.numBeds) * pricing.linens.sheetFeePerBed}` : "Select to configure sheets for each bed"}
          </Text>
        </View>
        <View
          style={[
            styles.toggleSwitch,
            homeData.sheetsProvided === "yes" && styles.toggleSwitchActive,
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              homeData.sheetsProvided === "yes" && styles.toggleKnobActive,
            ]}
          />
        </View>
      </TouchableOpacity>

      {/* Sheets = YES: Show bed size selectors */}
      {homeData.sheetsProvided === "yes" && homeData.bedConfigurations.length > 0 && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Select bed sizes:</Text>
          {homeData.bedConfigurations.map((bed) => (
            <View key={bed.bedNumber} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>
                Bed {bed.bedNumber}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {BED_SIZE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      {
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: bed.size === option.value ? "#3b82f6" : "#e2e8f0",
                        backgroundColor: bed.size === option.value ? "#eff6ff" : "#fff",
                      },
                    ]}
                    onPress={() => updateBedConfig(bed.bedNumber, "size", option.value)}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: bed.size === option.value ? "#3b82f6" : "#64748b",
                        fontWeight: bed.size === option.value ? "600" : "400",
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sheets = NO: Show location fields */}
      {homeData.sheetsProvided === "no" && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Where can cleaners find clean sheets?</Text>
          <TextInput
            style={[styles.input, focusedField === "cleanSheetsLocation" && styles.inputFocused]}
            placeholder="e.g., Hall closet, top shelf"
            placeholderTextColor="#94a3b8"
            value={homeData.cleanSheetsLocation}
            onChangeText={(text) => updateField("cleanSheetsLocation", text)}
            onFocus={() => setFocusedField("cleanSheetsLocation")}
            onBlur={() => setFocusedField(null)}
          />
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Where should cleaners put dirty sheets?
          </Text>
          <TextInput
            style={[styles.input, focusedField === "dirtySheetsLocation" && styles.inputFocused]}
            placeholder="e.g., Laundry room basket"
            placeholderTextColor="#94a3b8"
            value={homeData.dirtySheetsLocation}
            onChangeText={(text) => updateField("dirtySheetsLocation", text)}
            onFocus={() => setFocusedField("dirtySheetsLocation")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      )}

      {/* Towels Section */}
      <TouchableOpacity
        style={[
          styles.toggleCard,
          homeData.towelsProvided === "yes" && styles.toggleCardActive,
        ]}
        onPress={handleTowelsToggle}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>We Bring Fresh Towels</Text>
          <Text style={styles.toggleCardDescription}>
            {homeData.towelsProvided === "yes" && homeData.bathroomConfigurations.length > 0
              ? `$${homeData.bathroomConfigurations.reduce((sum, b) => sum + (b.towels || 0) * pricing.linens.towelFee + (b.faceCloths || 0) * pricing.linens.faceClothFee, 0)} - $${pricing.linens.towelFee}/towel, $${pricing.linens.faceClothFee}/face cloth`
              : homeData.numBaths ? `${homeData.numBaths} bathrooms - $${pricing.linens.towelFee}/towel, $${pricing.linens.faceClothFee}/face cloth` : "Select to configure towels for each bathroom"}
          </Text>
        </View>
        <View
          style={[
            styles.toggleSwitch,
            homeData.towelsProvided === "yes" && styles.toggleSwitchActive,
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              homeData.towelsProvided === "yes" && styles.toggleKnobActive,
            ]}
          />
        </View>
      </TouchableOpacity>

      {/* Towels = YES: Show bathroom config */}
      {homeData.towelsProvided === "yes" && homeData.bathroomConfigurations.length > 0 && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Configure towels per bathroom:</Text>
          {homeData.bathroomConfigurations.map((bath) => (
            <View
              key={bath.bathroomNumber}
              style={{
                marginBottom: 16,
                padding: 12,
                backgroundColor: "#f8fafc",
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 12 }}>
                Bathroom {bath.bathroomNumber}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                <Text style={{ flex: 1, color: "#555" }}>Towels (${pricing.linens.towelFee} each):</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "#e2e8f0",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() =>
                      updateBathroomConfig(bath.bathroomNumber, "towels", Math.max(0, bath.towels - 1))
                    }
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ width: 40, textAlign: "center", fontSize: 16, fontWeight: "600" }}>
                    {bath.towels}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "#3b82f6",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() =>
                      updateBathroomConfig(bath.bathroomNumber, "towels", Math.min(10, bath.towels + 1))
                    }
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold", color: "#fff" }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, color: "#555" }}>Face cloths (${pricing.linens.faceClothFee} each):</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "#e2e8f0",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() =>
                      updateBathroomConfig(
                        bath.bathroomNumber,
                        "faceCloths",
                        Math.max(0, bath.faceCloths - 1)
                      )
                    }
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold" }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ width: 40, textAlign: "center", fontSize: 16, fontWeight: "600" }}>
                    {bath.faceCloths}
                  </Text>
                  <TouchableOpacity
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "#3b82f6",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onPress={() =>
                      updateBathroomConfig(
                        bath.bathroomNumber,
                        "faceCloths",
                        Math.min(10, bath.faceCloths + 1)
                      )
                    }
                  >
                    <Text style={{ fontSize: 18, fontWeight: "bold", color: "#fff" }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Towels = NO: Show location fields */}
      {homeData.towelsProvided === "no" && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Where can cleaners find clean towels?</Text>
          <TextInput
            style={[styles.input, focusedField === "cleanTowelsLocation" && styles.inputFocused]}
            placeholder="e.g., Linen closet in hallway"
            placeholderTextColor="#94a3b8"
            value={homeData.cleanTowelsLocation}
            onChangeText={(text) => updateField("cleanTowelsLocation", text)}
            onFocus={() => setFocusedField("cleanTowelsLocation")}
            onBlur={() => setFocusedField(null)}
          />
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Where should cleaners put dirty towels?
          </Text>
          <TextInput
            style={[styles.input, focusedField === "dirtyTowelsLocation" && styles.inputFocused]}
            placeholder="e.g., Laundry basket in bathroom"
            placeholderTextColor="#94a3b8"
            value={homeData.dirtyTowelsLocation}
            onChangeText={(text) => updateField("dirtyTowelsLocation", text)}
            onFocus={() => setFocusedField("dirtyTowelsLocation")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Special Instructions (Optional)</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            focusedField === "specialNotes" && styles.inputFocused,
          ]}
          placeholder="Any special requests or areas to focus on?"
          placeholderTextColor="#94a3b8"
          value={homeData.specialNotes}
          onChangeText={(text) => updateField("specialNotes", text)}
          onFocus={() => setFocusedField("specialNotes")}
          onBlur={() => setFocusedField(null)}
          multiline
        />
      </View>
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Review Changes</Text>
      <Text style={styles.sectionSubtitle}>
        Make sure everything looks correct before saving.
      </Text>

      {errors.submit && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errors.submit}</Text>
        </View>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoBoxText}>
          <Text style={{ fontWeight: "bold" }}>{homeData.nickName}</Text>
          {"\n"}
          {homeData.address}
          {"\n"}
          {homeData.city}, {homeData.state} {homeData.zipcode}
          {"\n\n"}
          {homeData.numBeds} bed, {homeData.numBaths} bath
          {"\n\n"}
          <Text style={{ fontWeight: "bold" }}>Access: </Text>
          {homeData.accessType === "code"
            ? `Door code: ${homeData.keyPadCode}`
            : `Key: ${homeData.keyLocation}`}
          {"\n\n"}
          <Text style={{ fontWeight: "bold" }}>Preferred Time: </Text>
          {
            TIME_WINDOW_OPTIONS.find((o) => o.value === homeData.timeToBeCompleted)
              ?.label
          }
          {"\n\n"}
          <Text style={{ fontWeight: "bold" }}>Contact: </Text>
          {homeData.contact}
          {homeData.sheetsProvided === "yes" && "\n\n+ Fresh sheets included"}
          {homeData.towelsProvided === "yes" && "\n+ Fresh towels included"}
        </Text>
      </View>

      {/* Preferred Cleaners Management */}
      {homeData.id && (
        <PreferredCleanersSection
          homeId={homeData.id}
          token={user?.token}
        />
      )}

      {/* New Home Request Status Section */}
      {homeRequests.length > 0 && (
        <View style={localStyles.requestSection}>
          <Text style={localStyles.requestSectionTitle}>Cleaner Requests</Text>
          <Text style={localStyles.requestSectionSubtitle}>
            Status of requests to your preferred cleaners
          </Text>

          {requestsLoading ? (
            <ActivityIndicator size="small" color={colors.primary[500]} />
          ) : (
            homeRequests.map((request) => (
              <View key={request.id} style={localStyles.requestCard}>
                <View style={localStyles.requestHeader}>
                  <Text style={localStyles.requestCleanerName}>
                    {request.businessOwner?.name || "Unknown Cleaner"}
                  </Text>
                  <View
                    style={[
                      localStyles.requestStatusBadge,
                      request.status === "accepted" && localStyles.statusAccepted,
                      request.status === "declined" && localStyles.statusDeclined,
                      request.status === "pending" && localStyles.statusPending,
                      request.status === "expired" && localStyles.statusExpired,
                    ]}
                  >
                    <Text
                      style={[
                        localStyles.requestStatusText,
                        request.status === "accepted" && localStyles.statusTextAccepted,
                        request.status === "declined" && localStyles.statusTextDeclined,
                        request.status === "pending" && localStyles.statusTextPending,
                        request.status === "expired" && localStyles.statusTextExpired,
                      ]}
                    >
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Text>
                  </View>
                </View>

                {request.calculatedPrice && (
                  <Text style={localStyles.requestPrice}>
                    Quoted Price: ${request.calculatedPrice}
                  </Text>
                )}

                {request.declineReason && (
                  <Text style={localStyles.requestDeclineReason}>
                    Reason: {request.declineReason}
                  </Text>
                )}

                {/* Request Again button for declined/expired requests */}
                {(request.status === "declined" || request.status === "expired") && (
                  <View style={localStyles.requestActions}>
                    {request.canRequestAgain ? (
                      <TouchableOpacity
                        style={localStyles.requestAgainButton}
                        onPress={() => handleRequestAgain(request.id)}
                        disabled={requestAgainLoading}
                      >
                        {requestAgainLoading ? (
                          <ActivityIndicator size="small" color={colors.primary[600]} />
                        ) : (
                          <>
                            <Feather name="refresh-cw" size={14} color={colors.primary[600]} />
                            <Text style={localStyles.requestAgainText}>Request Again</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <Text style={localStyles.requestCooldownText}>
                        Can request again in {request.daysUntilCanRequestAgain} days
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ))
          )}

          {/* Marketplace Toggle - show if any requests were declined */}
          {homeRequests.some((r) => r.status === "declined" || r.status === "expired") && (
            <View style={localStyles.marketplaceSection}>
              <View style={localStyles.marketplaceHeader}>
                <View style={localStyles.marketplaceInfo}>
                  <Feather name="shopping-bag" size={20} color={colors.primary[600]} />
                  <View style={localStyles.marketplaceTextContainer}>
                    <Text style={localStyles.marketplaceTitle}>
                      Open to Marketplace
                    </Text>
                    <Text style={localStyles.marketplaceDescription}>
                      Allow other cleaners to find and service this home
                    </Text>
                  </View>
                </View>
                {marketplaceLoading ? (
                  <ActivityIndicator size="small" color={colors.primary[500]} />
                ) : (
                  <Switch
                    value={isMarketplaceEnabled}
                    onValueChange={handleMarketplaceToggle}
                    trackColor={{
                      false: colors.neutral[300],
                      true: colors.primary[400],
                    }}
                    thumbColor={isMarketplaceEnabled ? colors.primary[600] : colors.neutral[100]}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={{
          backgroundColor: colors.error[50],
          padding: spacing.lg,
          borderRadius: radius.lg,
          marginTop: spacing.lg,
          borderWidth: 1,
          borderColor: colors.error[200],
          alignItems: "center",
        }}
        onPress={handleDeletePress}
      >
        <Text
          style={{
            color: colors.error[700],
            fontWeight: typography.fontWeight.semibold,
          }}
        >
          Delete This Home
        </Text>
        <Text
          style={{
            color: colors.error[600],
            fontSize: typography.fontSize.xs,
            marginTop: spacing.xs,
          }}
        >
          This will cancel all upcoming appointments
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {currentStep === STEPS.BASICS && "Edit Home"}
              {currentStep === STEPS.ACCESS && "Access Details"}
              {currentStep === STEPS.SERVICES && "Preferences"}
              {currentStep === STEPS.REVIEW && "Review & Save"}
            </Text>
            <Text style={styles.subtitle}>Step {currentStep + 1} of 4</Text>
          </View>

          {renderStepIndicator()}

          <View style={styles.formCard}>
            {currentStep === STEPS.BASICS && renderBasicsStep()}
            {currentStep === STEPS.ACCESS && renderAccessStep()}
            {currentStep === STEPS.SERVICES && renderServicesStep()}
            {currentStep === STEPS.REVIEW && renderReviewStep()}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleBack}
              >
                <Text style={styles.secondaryButtonText}>
                  {currentStep === STEPS.BASICS ? "Cancel" : "Back"}
                </Text>
              </TouchableOpacity>

              {currentStep < STEPS.REVIEW ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleNext}
                >
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isLoading && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.neutral[0],
              borderRadius: radius["2xl"],
              padding: spacing.xl,
              margin: spacing.xl,
              ...shadows.lg,
              maxWidth: 400,
              width: "90%",
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
                marginBottom: spacing.md,
                textAlign: "center",
              }}
            >
              Delete Home?
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.base,
                color: colors.text.secondary,
                marginBottom: spacing.lg,
                textAlign: "center",
                lineHeight: 24,
              }}
            >
              {deleteFee > 0
                ? `This will cancel all appointments. A $${deleteFee} cancellation fee will be charged for appointments within the next 7 days.`
                : "This will permanently delete this home and all associated data."}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>Keep Home</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: colors.error[600],
                  paddingVertical: spacing.lg,
                  borderRadius: radius.lg,
                  alignItems: "center",
                }}
                onPress={handleConfirmDelete}
              >
                <Text
                  style={{
                    color: colors.neutral[0],
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showServiceAreaWarning}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDismissServiceAreaWarning}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              backgroundColor: colors.neutral[0],
              borderRadius: radius.xl,
              padding: spacing.xl,
              width: "100%",
              maxWidth: 340,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.warning[100],
                justifyContent: "center",
                alignItems: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ fontSize: 32 }}>⚠️</Text>
            </View>
            <Text
              style={{
                fontSize: typography.fontSize.xl,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
                marginBottom: spacing.sm,
                textAlign: "center",
              }}
            >
              Changes Saved
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.base,
                color: colors.text.secondary,
                textAlign: "center",
                lineHeight: 22,
                marginBottom: spacing.xl,
              }}
            >
              {serviceAreaMessage}
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary[600],
                paddingVertical: spacing.md,
                paddingHorizontal: spacing["3xl"],
                borderRadius: radius.lg,
                width: "100%",
                alignItems: "center",
              }}
              onPress={handleDismissServiceAreaWarning}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.bold,
                  color: colors.neutral[0],
                }}
              >
                Got It
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBedroomPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBedroomPicker(false)}
      >
        <TouchableOpacity
          style={localStyles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowBedroomPicker(false)}
        >
          <View style={localStyles.pickerContainer}>
            <View style={localStyles.pickerHeader}>
              <Text style={localStyles.pickerTitle}>Select Bedrooms</Text>
              <TouchableOpacity onPress={() => setShowBedroomPicker(false)}>
                <Text style={localStyles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={localStyles.pickerScroll}>
              {BED_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    localStyles.pickerOption,
                    String(homeData.numBeds) === option && localStyles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    updateField("numBeds", option);
                    setShowBedroomPicker(false);
                  }}
                >
                  <Text
                    style={[
                      localStyles.pickerOptionText,
                      String(homeData.numBeds) === option && localStyles.pickerOptionTextSelected,
                    ]}
                  >
                    {option} {option === "1" ? "bedroom" : "bedrooms"}
                  </Text>
                  {String(homeData.numBeds) === option && (
                    <Text style={localStyles.pickerCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showBathroomPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBathroomPicker(false)}
      >
        <TouchableOpacity
          style={localStyles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowBathroomPicker(false)}
        >
          <View style={localStyles.pickerContainer}>
            <View style={localStyles.pickerHeader}>
              <Text style={localStyles.pickerTitle}>Select Bathrooms</Text>
              <TouchableOpacity onPress={() => setShowBathroomPicker(false)}>
                <Text style={localStyles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={localStyles.pickerScroll}>
              {BATH_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    localStyles.pickerOption,
                    String(homeData.numBaths) === option && localStyles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    updateField("numBaths", option);
                    setShowBathroomPicker(false);
                  }}
                >
                  <Text
                    style={[
                      localStyles.pickerOptionText,
                      String(homeData.numBaths) === option && localStyles.pickerOptionTextSelected,
                    ]}
                  >
                    {option} {option === "1" ? "bathroom" : "bathrooms"}
                  </Text>
                  {String(homeData.numBaths) === option && (
                    <Text style={localStyles.pickerCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const localStyles = StyleSheet.create({
  // New Home Request Styles
  requestSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  requestSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  requestSectionSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  requestCleanerName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  requestStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[200],
  },
  statusAccepted: {
    backgroundColor: colors.success[100],
  },
  statusDeclined: {
    backgroundColor: colors.error[100],
  },
  statusPending: {
    backgroundColor: colors.warning[100],
  },
  statusExpired: {
    backgroundColor: colors.neutral[200],
  },
  requestStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[600],
  },
  statusTextAccepted: {
    color: colors.success[700],
  },
  statusTextDeclined: {
    color: colors.error[700],
  },
  statusTextPending: {
    color: colors.warning[700],
  },
  statusTextExpired: {
    color: colors.neutral[600],
  },
  requestPrice: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  requestDeclineReason: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontStyle: "italic",
    marginBottom: spacing.sm,
  },
  requestActions: {
    marginTop: spacing.sm,
  },
  requestAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.xs,
  },
  requestAgainText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  requestCooldownText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: "center",
    fontStyle: "italic",
  },
  marketplaceSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  marketplaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marketplaceInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
  },
  marketplaceTextContainer: {
    flex: 1,
  },
  marketplaceTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  marketplaceDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  // Picker Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "60%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  pickerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  pickerDone: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  pickerScroll: {
    maxHeight: 300,
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary[50],
  },
  pickerOptionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  pickerOptionTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  pickerCheckmark: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.bold,
  },
});

export default EditHomeForm;
