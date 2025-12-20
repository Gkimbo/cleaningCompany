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
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import styles from "../onboarding/OnboardingStyles";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
} from "../../services/styles/theme";

const STEPS = {
  BASICS: 0,
  ACCESS: 1,
  SERVICES: 2,
  REVIEW: 3,
};

const TIME_OPTIONS = [
  {
    value: "anytime",
    label: "Anytime",
    description: "Most flexible, best pricing",
  },
  { value: "10-3", label: "10am - 3pm", description: "+$30 per cleaning" },
  { value: "11-4", label: "11am - 4pm", description: "+$30 per cleaning" },
  { value: "12-2", label: "12pm - 2pm", description: "+$50 per cleaning" },
];

const EditHomeForm = ({ state, dispatch }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [currentStep, setCurrentStep] = useState(STEPS.BASICS);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteFee, setDeleteFee] = useState(0);
  const [showServiceAreaWarning, setShowServiceAreaWarning] = useState(false);
  const [serviceAreaMessage, setServiceAreaMessage] = useState("");

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
      });
    }
  }, [id, state.homes]);

  const updateField = (field, value) => {
    setHomeData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
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
    let fee = 0;

    if (appointments?.appointments) {
      appointments.appointments.forEach((appt) => {
        const date = new Date(appt.date);
        if (
          date.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000 &&
          date.getTime() - currentDate.getTime() >= 0
        ) {
          fee += 25;
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
          <TextInput
            style={[
              styles.input,
              focusedField === "numBeds" && styles.inputFocused,
              errors.numBeds && styles.inputError,
            ]}
            placeholder="3"
            placeholderTextColor="#94a3b8"
            value={String(homeData.numBeds || "")}
            onChangeText={(text) =>
              updateField("numBeds", text.replace(/\D/g, ""))
            }
            onFocus={() => setFocusedField("numBeds")}
            onBlur={() => setFocusedField(null)}
            keyboardType="number-pad"
          />
        </View>

        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.inputLabel}>
            Bathrooms <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "numBaths" && styles.inputFocused,
              errors.numBaths && styles.inputError,
            ]}
            placeholder="2"
            placeholderTextColor="#94a3b8"
            value={String(homeData.numBaths || "")}
            onChangeText={(text) =>
              updateField("numBaths", text.replace(/\D/g, ""))
            }
            onFocus={() => setFocusedField("numBaths")}
            onBlur={() => setFocusedField(null)}
            keyboardType="number-pad"
          />
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
          {TIME_OPTIONS.map((option) => (
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

      <TouchableOpacity
        style={[
          styles.toggleCard,
          homeData.sheetsProvided === "yes" && styles.toggleCardActive,
        ]}
        onPress={() =>
          updateField(
            "sheetsProvided",
            homeData.sheetsProvided === "yes" ? "no" : "yes"
          )
        }
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Bring Fresh Sheets</Text>
          <Text style={styles.toggleCardDescription}>
            +$50 per cleaning - We'll bring and put on fresh sheets
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

      <TouchableOpacity
        style={[
          styles.toggleCard,
          homeData.towelsProvided === "yes" && styles.toggleCardActive,
        ]}
        onPress={() =>
          updateField(
            "towelsProvided",
            homeData.towelsProvided === "yes" ? "no" : "yes"
          )
        }
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Bring Fresh Towels</Text>
          <Text style={styles.toggleCardDescription}>
            +$50 per cleaning - We'll bring and hang fresh towels
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
            TIME_OPTIONS.find((o) => o.value === homeData.timeToBeCompleted)
              ?.label
          }
          {"\n\n"}
          <Text style={{ fontWeight: "bold" }}>Contact: </Text>
          {homeData.contact}
          {homeData.sheetsProvided === "yes" && "\n\n+ Fresh sheets included"}
          {homeData.towelsProvided === "yes" && "\n+ Fresh towels included"}
        </Text>
      </View>

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
    </KeyboardAvoidingView>
  );
};

export default EditHomeForm;
