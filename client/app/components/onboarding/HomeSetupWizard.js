import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigate } from "react-router-native";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import styles from "./OnboardingStyles";

const STEPS = {
  BASICS: 0,
  ACCESS: 1,
  SERVICES: 2,
  REVIEW: 3,
};

const TIME_OPTIONS = [
  { value: "anytime", label: "Anytime", description: "Most flexible, best pricing" },
  { value: "10-3", label: "10am - 3pm", description: "+$30 per cleaning" },
  { value: "11-4", label: "11am - 4pm", description: "+$30 per cleaning" },
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const HomeSetupWizard = ({ state, dispatch }) => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [currentStep, setCurrentStep] = useState(STEPS.BASICS);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const [homeData, setHomeData] = useState({
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

  const updateField = (field, value) => {
    setHomeData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === STEPS.BASICS) {
      if (!homeData.nickName.trim()) newErrors.nickName = "Give your home a name";
      if (!homeData.address.trim()) newErrors.address = "Address is required";
      if (!homeData.city.trim()) newErrors.city = "City is required";
      if (!homeData.state) newErrors.state = "Select a state";
      if (!homeData.zipcode || homeData.zipcode.length !== 5) {
        newErrors.zipcode = "Enter a valid 5-digit zip code";
      }
      if (!homeData.numBeds) newErrors.numBeds = "Required";
      if (!homeData.numBaths) newErrors.numBaths = "Required";
    }

    if (step === STEPS.ACCESS) {
      if (homeData.accessType === "code" && !homeData.keyPadCode.trim()) {
        newErrors.keyPadCode = "Enter the door code";
      }
      if (homeData.accessType === "key" && !homeData.keyLocation.trim()) {
        newErrors.keyLocation = "Describe where the key is located";
      }
      if (!homeData.trashLocation.trim()) {
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
    setCurrentStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const submitData = {
        user: { token: user },
        home: {
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
          recyclingLocation: homeData.hasRecycling ? homeData.recyclingLocation : "",
          compostLocation: homeData.hasCompost ? homeData.compostLocation : "",
          timeToBeCompleted: homeData.timeToBeCompleted,
          sheetsProvided: homeData.sheetsProvided,
          towelsProvided: homeData.towelsProvided,
          contact: homeData.contact,
          specialNotes: homeData.specialNotes,
        },
      };

      const response = await FetchData.addHomeInfo(submitData);

      if (response === "Cannot find zipcode") {
        setErrors({ submit: "We don't service this area yet. Please check the zip code." });
        setCurrentStep(STEPS.BASICS);
      } else if (response.error) {
        setErrors({ submit: response.error });
      } else {
        navigate("/");
      }
    } catch (error) {
      setErrors({ submit: "Something went wrong. Please try again." });
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
      <Text style={styles.sectionTitle}>Tell us about your home</Text>
      <Text style={styles.sectionSubtitle}>
        This helps us match you with the right cleaner and give you an accurate price.
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
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.nickName}</Text>
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
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.address}</Text>
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
            onChangeText={(text) => updateField("state", text.toUpperCase().slice(0, 2))}
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
          onChangeText={(text) => updateField("zipcode", text.replace(/\D/g, "").slice(0, 5))}
          onFocus={() => setFocusedField("zipcode")}
          onBlur={() => setFocusedField(null)}
          keyboardType="number-pad"
          maxLength={5}
        />
        {errors.zipcode && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.zipcode}</Text>
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
            value={homeData.numBeds}
            onChangeText={(text) => updateField("numBeds", text.replace(/\D/g, ""))}
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
            value={homeData.numBaths}
            onChangeText={(text) => updateField("numBaths", text.replace(/\D/g, ""))}
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
        How should our cleaners get into your home?
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
                homeData.accessType === "code" && styles.choiceButtonTextSelected,
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
                homeData.accessType === "key" && styles.choiceButtonTextSelected,
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
          <Text style={styles.inputHelper}>You can update this before each appointment</Text>
          {errors.keyPadCode && (
            <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.keyPadCode}</Text>
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
            <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.keyLocation}</Text>
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
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.trashLocation}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.toggleCard, homeData.hasRecycling && styles.toggleCardActive]}
        onPress={() => updateField("hasRecycling", !homeData.hasRecycling)}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Recycling Available</Text>
          <Text style={styles.toggleCardDescription}>Does your home have recycling bins?</Text>
        </View>
        <View style={[styles.toggleSwitch, homeData.hasRecycling && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, homeData.hasRecycling && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {homeData.hasRecycling && (
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, focusedField === "recyclingLocation" && styles.inputFocused]}
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
        style={[styles.toggleCard, homeData.hasCompost && styles.toggleCardActive]}
        onPress={() => updateField("hasCompost", !homeData.hasCompost)}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Compost Available</Text>
          <Text style={styles.toggleCardDescription}>Does your home have compost bins?</Text>
        </View>
        <View style={[styles.toggleSwitch, homeData.hasCompost && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, homeData.hasCompost && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {homeData.hasCompost && (
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, focusedField === "compostLocation" && styles.inputFocused]}
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
          onChangeText={(text) => updateField("contact", formatPhoneNumber(text))}
          onFocus={() => setFocusedField("contact")}
          onBlur={() => setFocusedField(null)}
          keyboardType="phone-pad"
          maxLength={12}
        />
        <Text style={styles.inputHelper}>We'll call this number if there's an issue</Text>
        {errors.contact && (
          <Text style={[styles.inputHelper, { color: "#e11d48" }]}>{errors.contact}</Text>
        )}
      </View>
    </View>
  );

  const renderServicesStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Preferences</Text>
      <Text style={styles.sectionSubtitle}>
        Customize your cleaning service to fit your needs.
      </Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Preferred Time Window</Text>
        <View style={styles.choiceGroup}>
          {TIME_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.toggleCard,
                homeData.timeToBeCompleted === option.value && styles.toggleCardActive,
              ]}
              onPress={() => updateField("timeToBeCompleted", option.value)}
            >
              <View style={styles.toggleCardContent}>
                <Text style={styles.toggleCardTitle}>{option.label}</Text>
                <Text style={styles.toggleCardDescription}>{option.description}</Text>
              </View>
              <View
                style={[
                  styles.toggleSwitch,
                  homeData.timeToBeCompleted === option.value && styles.toggleSwitchActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    homeData.timeToBeCompleted === option.value && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.toggleCard, homeData.sheetsProvided === "yes" && styles.toggleCardActive]}
        onPress={() =>
          updateField("sheetsProvided", homeData.sheetsProvided === "yes" ? "no" : "yes")
        }
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Bring Fresh Sheets</Text>
          <Text style={styles.toggleCardDescription}>
            +$25 per cleaning - We'll bring and put on fresh sheets
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
        style={[styles.toggleCard, homeData.towelsProvided === "yes" && styles.toggleCardActive]}
        onPress={() =>
          updateField("towelsProvided", homeData.towelsProvided === "yes" ? "no" : "yes")
        }
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Bring Fresh Towels</Text>
          <Text style={styles.toggleCardDescription}>
            +$25 per cleaning - We'll bring and hang fresh towels
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
      <Text style={styles.sectionTitle}>Review Your Home</Text>
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
          {TIME_OPTIONS.find((o) => o.value === homeData.timeToBeCompleted)?.label}
          {"\n\n"}
          <Text style={{ fontWeight: "bold" }}>Contact: </Text>
          {homeData.contact}
          {homeData.sheetsProvided === "yes" && "\n\n+ Fresh sheets included"}
          {homeData.towelsProvided === "yes" && "\n+ Fresh towels included"}
        </Text>
      </View>
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
              {currentStep === STEPS.BASICS && "Add Your Home"}
              {currentStep === STEPS.ACCESS && "Access Details"}
              {currentStep === STEPS.SERVICES && "Preferences"}
              {currentStep === STEPS.REVIEW && "Almost Done!"}
            </Text>
            <Text style={styles.subtitle}>
              Step {currentStep + 1} of 4
            </Text>
          </View>

          {renderStepIndicator()}

          <View style={styles.formCard}>
            {currentStep === STEPS.BASICS && renderBasicsStep()}
            {currentStep === STEPS.ACCESS && renderAccessStep()}
            {currentStep === STEPS.SERVICES && renderServicesStep()}
            {currentStep === STEPS.REVIEW && renderReviewStep()}

            <View style={styles.buttonRow}>
              {currentStep > STEPS.BASICS && (
                <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
                  <Text style={styles.secondaryButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              {currentStep < STEPS.REVIEW ? (
                <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                  <Text style={styles.primaryButtonText}>Continue</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? "Saving..." : "Save Home"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {currentStep === STEPS.BASICS && (
              <TouchableOpacity style={styles.skipButton} onPress={() => navigate("/")}>
                <Text style={styles.skipButtonText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default HomeSetupWizard;
