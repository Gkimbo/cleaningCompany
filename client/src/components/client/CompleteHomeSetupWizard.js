import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigate, useParams } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { AuthContext } from "../../services/AuthContext";
import FetchData from "../../services/fetchRequests/fetchData";
import styles from "../onboarding/OnboardingStyles";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const STEPS = {
  ACCESS: 0,
  LINENS: 1,
  REVIEW: 2,
};

const BED_SIZE_OPTIONS = [
  { value: "long_twin", label: "Long Twin" },
  { value: "twin", label: "Twin" },
  { value: "full", label: "Full" },
  { value: "queen", label: "Queen" },
  { value: "king", label: "King" },
  { value: "california_king", label: "California King" },
];

const CompleteHomeSetupWizard = ({ state, dispatch }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const { pricing } = usePricing();

  const [currentStep, setCurrentStep] = useState(STEPS.ACCESS);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [home, setHome] = useState(null);

  const [formData, setFormData] = useState({
    accessType: "code",
    keyPadCode: "",
    keyLocation: "",
    trashLocation: "",
    hasRecycling: false,
    recyclingLocation: "",
    hasCompost: false,
    compostLocation: "",
    contact: "",
    sheetsProvided: "no",
    towelsProvided: "no",
    cleanSheetsLocation: "",
    dirtySheetsLocation: "",
    cleanTowelsLocation: "",
    dirtyTowelsLocation: "",
    bedConfigurations: [],
    bathroomConfigurations: [],
  });

  // Load home data
  useEffect(() => {
    const homeId = Number(id);
    const foundHome = state.homes.find((h) => h.id === homeId);
    if (foundHome) {
      setHome(foundHome);
      // Pre-populate contact if available
      setFormData((prev) => ({
        ...prev,
        contact: foundHome.contact || user?.phone || "",
        // Initialize bed/bathroom configurations based on home data
        bedConfigurations: initializeBedConfigurations(foundHome.numBeds),
        bathroomConfigurations: initializeBathroomConfigurations(foundHome.numBaths),
      }));
    }
  }, [id, state.homes, user]);

  const initializeBedConfigurations = (numBeds) => {
    const beds = parseInt(numBeds) || 0;
    const configs = [];
    for (let i = 1; i <= beds; i++) {
      configs.push({ bedNumber: i, size: "queen", needsSheets: true });
    }
    return configs;
  };

  const initializeBathroomConfigurations = (numBaths) => {
    const baths = Math.ceil(parseFloat(numBaths)) || 0;
    const configs = [];
    for (let i = 1; i <= baths; i++) {
      configs.push({ bathroomNumber: i, towels: 2, faceCloths: 1 });
    }
    return configs;
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const updateBedConfig = (bedNumber, field, value) => {
    setFormData((prev) => {
      const updatedConfigs = prev.bedConfigurations.map((bed) =>
        bed.bedNumber === bedNumber ? { ...bed, [field]: value } : bed
      );
      return { ...prev, bedConfigurations: updatedConfigs };
    });
  };

  const updateBathroomConfig = (bathroomNumber, field, value) => {
    setFormData((prev) => {
      const updatedConfigs = prev.bathroomConfigurations.map((bath) =>
        bath.bathroomNumber === bathroomNumber ? { ...bath, [field]: value } : bath
      );
      return { ...prev, bathroomConfigurations: updatedConfigs };
    });
  };

  const handleSheetsToggle = () => {
    const newValue = formData.sheetsProvided === "yes" ? "no" : "yes";
    setFormData((prev) => ({
      ...prev,
      sheetsProvided: newValue,
    }));
  };

  const handleTowelsToggle = () => {
    const newValue = formData.towelsProvided === "yes" ? "no" : "yes";
    setFormData((prev) => ({
      ...prev,
      towelsProvided: newValue,
    }));
  };

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const validateAccessStep = () => {
    const newErrors = {};

    if (formData.accessType === "code" && !formData.keyPadCode.trim()) {
      newErrors.keyPadCode = "Door code is required";
    }
    if (formData.accessType === "key" && !formData.keyLocation.trim()) {
      newErrors.keyLocation = "Key location is required";
    }
    if (!formData.trashLocation.trim()) {
      newErrors.trashLocation = "Trash location is required";
    }
    if (!formData.contact.trim()) {
      newErrors.contact = "Contact phone is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateLinensStep = () => {
    const newErrors = {};

    // If sheets are provided by homeowner (no = we bring), they need locations
    if (formData.sheetsProvided === "no") {
      if (!formData.cleanSheetsLocation.trim()) {
        newErrors.cleanSheetsLocation = "Clean sheets location is required";
      }
      if (!formData.dirtySheetsLocation.trim()) {
        newErrors.dirtySheetsLocation = "Dirty sheets location is required";
      }
    }

    // If towels are provided by homeowner (no = we bring), they need locations
    if (formData.towelsProvided === "no") {
      if (!formData.cleanTowelsLocation.trim()) {
        newErrors.cleanTowelsLocation = "Clean towels location is required";
      }
      if (!formData.dirtyTowelsLocation.trim()) {
        newErrors.dirtyTowelsLocation = "Dirty towels location is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === STEPS.ACCESS && validateAccessStep()) {
      setCurrentStep(STEPS.LINENS);
    } else if (currentStep === STEPS.LINENS && validateLinensStep()) {
      setCurrentStep(STEPS.REVIEW);
    }
  };

  const handleBack = () => {
    if (currentStep === STEPS.LINENS) {
      setCurrentStep(STEPS.ACCESS);
    } else if (currentStep === STEPS.REVIEW) {
      setCurrentStep(STEPS.LINENS);
    } else {
      navigate(-1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const submitData = {
        keyPadCode: formData.accessType === "code" ? formData.keyPadCode : null,
        keyLocation: formData.accessType === "key" ? formData.keyLocation : null,
        trashLocation: formData.trashLocation,
        recyclingLocation: formData.hasRecycling ? formData.recyclingLocation : null,
        compostLocation: formData.hasCompost ? formData.compostLocation : null,
        contact: formData.contact,
        sheetsProvided: formData.sheetsProvided,
        towelsProvided: formData.towelsProvided,
        cleanSheetsLocation: formData.sheetsProvided === "no" ? formData.cleanSheetsLocation : null,
        dirtySheetsLocation: formData.sheetsProvided === "no" ? formData.dirtySheetsLocation : null,
        cleanTowelsLocation: formData.towelsProvided === "no" ? formData.cleanTowelsLocation : null,
        dirtyTowelsLocation: formData.towelsProvided === "no" ? formData.dirtyTowelsLocation : null,
        bedConfigurations: formData.sheetsProvided === "yes" ? formData.bedConfigurations : null,
        bathroomConfigurations: formData.towelsProvided === "yes" ? formData.bathroomConfigurations : null,
      };

      const result = await FetchData.completeHomeSetup(id, submitData, user.token);

      if (result.error) {
        setErrors({ submit: result.error });
        setIsLoading(false);
        return;
      }

      // Update the home in state
      if (result.home) {
        dispatch({
          type: "UPDATE_HOME",
          payload: result.home,
        });
      }

      // Refresh user data to get updated home list
      const refreshed = await FetchData.getUserInfo(user.token);
      if (refreshed?.user) {
        dispatch({ type: "SET_USER", payload: refreshed.user });
        if (refreshed.user.homes) {
          dispatch({ type: "SET_HOMES", payload: refreshed.user.homes });
        }
      }

      Alert.alert(
        "Setup Complete!",
        "Your home is now fully set up. You can start booking cleanings.",
        [{ text: "OK", onPress: () => navigate("/") }]
      );
    } catch (error) {
      console.error("Error completing setup:", error);
      setErrors({ submit: "Failed to complete setup. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const renderProgressIndicator = () => (
    <View style={styles.progressContainer}>
      {Object.values(STEPS).map((step) => (
        <View
          key={step}
          style={[
            styles.progressStep,
            step <= currentStep && styles.progressStepActive,
          ]}
        />
      ))}
    </View>
  );

  const renderAccessStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Access Information</Text>
      <Text style={styles.sectionSubtitle}>
        How will cleaners access your home?
      </Text>

      {/* Home address display */}
      {home && (
        <View style={localStyles.addressCard}>
          <Feather name="home" size={20} color={colors.primary[600]} />
          <View style={localStyles.addressInfo}>
            <Text style={localStyles.addressText}>{home.address}</Text>
            <Text style={localStyles.cityText}>
              {home.city}, {home.state} {home.zipcode}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Entry Method</Text>
        <View style={styles.choiceRow}>
          <TouchableOpacity
            style={[
              styles.choiceButton,
              styles.choiceButtonFull,
              formData.accessType === "code" && styles.choiceButtonSelected,
            ]}
            onPress={() => updateField("accessType", "code")}
          >
            <Text
              style={[
                styles.choiceButtonText,
                formData.accessType === "code" && styles.choiceButtonTextSelected,
              ]}
            >
              Door Code
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.choiceButton,
              styles.choiceButtonFull,
              formData.accessType === "key" && styles.choiceButtonSelected,
            ]}
            onPress={() => updateField("accessType", "key")}
          >
            <Text
              style={[
                styles.choiceButtonText,
                formData.accessType === "key" && styles.choiceButtonTextSelected,
              ]}
            >
              Hidden Key
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {formData.accessType === "code" ? (
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
            value={formData.keyPadCode}
            onChangeText={(text) => updateField("keyPadCode", text)}
            onFocus={() => setFocusedField("keyPadCode")}
            onBlur={() => setFocusedField(null)}
          />
          {errors.keyPadCode && (
            <Text style={localStyles.errorText}>{errors.keyPadCode}</Text>
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
            value={formData.keyLocation}
            onChangeText={(text) => updateField("keyLocation", text)}
            onFocus={() => setFocusedField("keyLocation")}
            onBlur={() => setFocusedField(null)}
            multiline
          />
          {errors.keyLocation && (
            <Text style={localStyles.errorText}>{errors.keyLocation}</Text>
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
          value={formData.trashLocation}
          onChangeText={(text) => updateField("trashLocation", text)}
          onFocus={() => setFocusedField("trashLocation")}
          onBlur={() => setFocusedField(null)}
        />
        {errors.trashLocation && (
          <Text style={localStyles.errorText}>{errors.trashLocation}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.toggleCard, formData.hasRecycling && styles.toggleCardActive]}
        onPress={() => updateField("hasRecycling", !formData.hasRecycling)}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Recycling Available</Text>
          <Text style={styles.toggleCardDescription}>
            Does your home have recycling bins?
          </Text>
        </View>
        <View style={[styles.toggleSwitch, formData.hasRecycling && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, formData.hasRecycling && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {formData.hasRecycling && (
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, focusedField === "recyclingLocation" && styles.inputFocused]}
            placeholder="Where is the recycling bin?"
            placeholderTextColor="#94a3b8"
            value={formData.recyclingLocation}
            onChangeText={(text) => updateField("recyclingLocation", text)}
            onFocus={() => setFocusedField("recyclingLocation")}
            onBlur={() => setFocusedField(null)}
          />
        </View>
      )}

      <TouchableOpacity
        style={[styles.toggleCard, formData.hasCompost && styles.toggleCardActive]}
        onPress={() => updateField("hasCompost", !formData.hasCompost)}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>Compost Available</Text>
          <Text style={styles.toggleCardDescription}>
            Does your home have a compost bin?
          </Text>
        </View>
        <View style={[styles.toggleSwitch, formData.hasCompost && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, formData.hasCompost && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {formData.hasCompost && (
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, focusedField === "compostLocation" && styles.inputFocused]}
            placeholder="Where is the compost bin?"
            placeholderTextColor="#94a3b8"
            value={formData.compostLocation}
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
          value={formData.contact}
          onChangeText={(text) => updateField("contact", formatPhoneNumber(text))}
          onFocus={() => setFocusedField("contact")}
          onBlur={() => setFocusedField(null)}
          keyboardType="phone-pad"
          maxLength={12}
        />
        <Text style={styles.inputHelper}>We'll call this number if there's an issue</Text>
        {errors.contact && (
          <Text style={localStyles.errorText}>{errors.contact}</Text>
        )}
      </View>
    </View>
  );

  const renderLinensStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Linen Preferences</Text>
      <Text style={styles.sectionSubtitle}>
        Configure sheet and towel options for your cleanings.
      </Text>

      {/* Sheets Section */}
      <TouchableOpacity
        style={[styles.toggleCard, formData.sheetsProvided === "yes" && styles.toggleCardActive]}
        onPress={handleSheetsToggle}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>We Bring Fresh Sheets</Text>
          <Text style={styles.toggleCardDescription}>
            {formData.sheetsProvided === "yes"
              ? `$${pricing?.linens?.sheetFeePerBed || 15} per bed`
              : "You provide your own sheets"}
          </Text>
        </View>
        <View style={[styles.toggleSwitch, formData.sheetsProvided === "yes" && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, formData.sheetsProvided === "yes" && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {/* Sheets = YES: Show bed size selectors */}
      {formData.sheetsProvided === "yes" && formData.bedConfigurations.length > 0 && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Select bed sizes:</Text>
          {formData.bedConfigurations.map((bed) => (
            <View key={bed.bedNumber} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: "#555", marginBottom: 6 }}>
                Bed {bed.bedNumber}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {BED_SIZE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      localStyles.sizeButton,
                      bed.size === option.value && localStyles.sizeButtonActive,
                    ]}
                    onPress={() => updateBedConfig(bed.bedNumber, "size", option.value)}
                  >
                    <Text
                      style={[
                        localStyles.sizeButtonText,
                        bed.size === option.value && localStyles.sizeButtonTextActive,
                      ]}
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
      {formData.sheetsProvided === "no" && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            Where can cleaners find clean sheets? <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "cleanSheetsLocation" && styles.inputFocused,
              errors.cleanSheetsLocation && styles.inputError,
            ]}
            placeholder="e.g., Hall closet, top shelf"
            placeholderTextColor="#94a3b8"
            value={formData.cleanSheetsLocation}
            onChangeText={(text) => updateField("cleanSheetsLocation", text)}
            onFocus={() => setFocusedField("cleanSheetsLocation")}
            onBlur={() => setFocusedField(null)}
          />
          {errors.cleanSheetsLocation && (
            <Text style={localStyles.errorText}>{errors.cleanSheetsLocation}</Text>
          )}

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Where should cleaners put dirty sheets? <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "dirtySheetsLocation" && styles.inputFocused,
              errors.dirtySheetsLocation && styles.inputError,
            ]}
            placeholder="e.g., Laundry room basket"
            placeholderTextColor="#94a3b8"
            value={formData.dirtySheetsLocation}
            onChangeText={(text) => updateField("dirtySheetsLocation", text)}
            onFocus={() => setFocusedField("dirtySheetsLocation")}
            onBlur={() => setFocusedField(null)}
          />
          {errors.dirtySheetsLocation && (
            <Text style={localStyles.errorText}>{errors.dirtySheetsLocation}</Text>
          )}
        </View>
      )}

      {/* Towels Section */}
      <TouchableOpacity
        style={[styles.toggleCard, formData.towelsProvided === "yes" && styles.toggleCardActive]}
        onPress={handleTowelsToggle}
      >
        <View style={styles.toggleCardContent}>
          <Text style={styles.toggleCardTitle}>We Bring Fresh Towels</Text>
          <Text style={styles.toggleCardDescription}>
            {formData.towelsProvided === "yes"
              ? `$${pricing?.linens?.towelFee || 5}/towel, $${pricing?.linens?.faceClothFee || 2}/face cloth`
              : "You provide your own towels"}
          </Text>
        </View>
        <View style={[styles.toggleSwitch, formData.towelsProvided === "yes" && styles.toggleSwitchActive]}>
          <View style={[styles.toggleKnob, formData.towelsProvided === "yes" && styles.toggleKnobActive]} />
        </View>
      </TouchableOpacity>

      {/* Towels = YES: Show bathroom config */}
      {formData.towelsProvided === "yes" && formData.bathroomConfigurations.length > 0 && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Configure towels per bathroom:</Text>
          {formData.bathroomConfigurations.map((bath) => (
            <View key={bath.bathroomNumber} style={localStyles.bathroomConfig}>
              <Text style={localStyles.bathroomTitle}>Bathroom {bath.bathroomNumber}</Text>
              <View style={localStyles.configRow}>
                <Text style={localStyles.configLabel}>
                  Towels (${pricing?.linens?.towelFee || 5} each):
                </Text>
                <View style={localStyles.counterContainer}>
                  <TouchableOpacity
                    style={localStyles.counterButton}
                    onPress={() => updateBathroomConfig(bath.bathroomNumber, "towels", Math.max(0, bath.towels - 1))}
                  >
                    <Text style={localStyles.counterButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={localStyles.counterValue}>{bath.towels}</Text>
                  <TouchableOpacity
                    style={[localStyles.counterButton, localStyles.counterButtonPlus]}
                    onPress={() => updateBathroomConfig(bath.bathroomNumber, "towels", Math.min(10, bath.towels + 1))}
                  >
                    <Text style={[localStyles.counterButtonText, { color: "#fff" }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={localStyles.configRow}>
                <Text style={localStyles.configLabel}>
                  Face cloths (${pricing?.linens?.faceClothFee || 2} each):
                </Text>
                <View style={localStyles.counterContainer}>
                  <TouchableOpacity
                    style={localStyles.counterButton}
                    onPress={() => updateBathroomConfig(bath.bathroomNumber, "faceCloths", Math.max(0, bath.faceCloths - 1))}
                  >
                    <Text style={localStyles.counterButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={localStyles.counterValue}>{bath.faceCloths}</Text>
                  <TouchableOpacity
                    style={[localStyles.counterButton, localStyles.counterButtonPlus]}
                    onPress={() => updateBathroomConfig(bath.bathroomNumber, "faceCloths", Math.min(10, bath.faceCloths + 1))}
                  >
                    <Text style={[localStyles.counterButtonText, { color: "#fff" }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Towels = NO: Show location fields */}
      {formData.towelsProvided === "no" && (
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>
            Where can cleaners find clean towels? <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "cleanTowelsLocation" && styles.inputFocused,
              errors.cleanTowelsLocation && styles.inputError,
            ]}
            placeholder="e.g., Linen closet in hallway"
            placeholderTextColor="#94a3b8"
            value={formData.cleanTowelsLocation}
            onChangeText={(text) => updateField("cleanTowelsLocation", text)}
            onFocus={() => setFocusedField("cleanTowelsLocation")}
            onBlur={() => setFocusedField(null)}
          />
          {errors.cleanTowelsLocation && (
            <Text style={localStyles.errorText}>{errors.cleanTowelsLocation}</Text>
          )}

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>
            Where should cleaners put dirty towels? <Text style={styles.inputRequired}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              focusedField === "dirtyTowelsLocation" && styles.inputFocused,
              errors.dirtyTowelsLocation && styles.inputError,
            ]}
            placeholder="e.g., Laundry basket in bathroom"
            placeholderTextColor="#94a3b8"
            value={formData.dirtyTowelsLocation}
            onChangeText={(text) => updateField("dirtyTowelsLocation", text)}
            onFocus={() => setFocusedField("dirtyTowelsLocation")}
            onBlur={() => setFocusedField(null)}
          />
          {errors.dirtyTowelsLocation && (
            <Text style={localStyles.errorText}>{errors.dirtyTowelsLocation}</Text>
          )}
        </View>
      )}
    </View>
  );

  const renderReviewStep = () => (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Review Your Setup</Text>
      <Text style={styles.sectionSubtitle}>
        Please review your information before completing setup.
      </Text>

      {/* Home Info */}
      {home && (
        <View style={localStyles.reviewSection}>
          <View style={localStyles.reviewHeader}>
            <Feather name="home" size={18} color={colors.primary[600]} />
            <Text style={localStyles.reviewTitle}>Home</Text>
          </View>
          <Text style={localStyles.reviewValue}>{home.address}</Text>
          <Text style={localStyles.reviewSubvalue}>
            {home.city}, {home.state} {home.zipcode}
          </Text>
          <Text style={localStyles.reviewSubvalue}>
            {home.numBeds} bed, {home.numBaths} bath
          </Text>
        </View>
      )}

      {/* Access Info */}
      <View style={localStyles.reviewSection}>
        <View style={localStyles.reviewHeader}>
          <Feather name="key" size={18} color={colors.primary[600]} />
          <Text style={localStyles.reviewTitle}>Access</Text>
        </View>
        <Text style={localStyles.reviewValue}>
          {formData.accessType === "code"
            ? `Door code: ${formData.keyPadCode}`
            : `Key location: ${formData.keyLocation}`}
        </Text>
        <Text style={localStyles.reviewSubvalue}>Trash: {formData.trashLocation}</Text>
        {formData.hasRecycling && (
          <Text style={localStyles.reviewSubvalue}>Recycling: {formData.recyclingLocation}</Text>
        )}
        {formData.hasCompost && (
          <Text style={localStyles.reviewSubvalue}>Compost: {formData.compostLocation}</Text>
        )}
        <Text style={localStyles.reviewSubvalue}>Contact: {formData.contact}</Text>
      </View>

      {/* Linens Info */}
      <View style={localStyles.reviewSection}>
        <View style={localStyles.reviewHeader}>
          <Feather name="box" size={18} color={colors.primary[600]} />
          <Text style={localStyles.reviewTitle}>Linens</Text>
        </View>
        <Text style={localStyles.reviewValue}>
          Sheets: {formData.sheetsProvided === "yes" ? "We bring fresh sheets" : "You provide"}
        </Text>
        {formData.sheetsProvided === "no" && (
          <>
            <Text style={localStyles.reviewSubvalue}>
              Clean sheets: {formData.cleanSheetsLocation}
            </Text>
            <Text style={localStyles.reviewSubvalue}>
              Dirty sheets: {formData.dirtySheetsLocation}
            </Text>
          </>
        )}
        <Text style={[localStyles.reviewValue, { marginTop: 8 }]}>
          Towels: {formData.towelsProvided === "yes" ? "We bring fresh towels" : "You provide"}
        </Text>
        {formData.towelsProvided === "no" && (
          <>
            <Text style={localStyles.reviewSubvalue}>
              Clean towels: {formData.cleanTowelsLocation}
            </Text>
            <Text style={localStyles.reviewSubvalue}>
              Dirty towels: {formData.dirtyTowelsLocation}
            </Text>
          </>
        )}
      </View>

      {errors.submit && (
        <View style={localStyles.errorContainer}>
          <Text style={localStyles.errorText}>{errors.submit}</Text>
        </View>
      )}
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case STEPS.ACCESS:
        return renderAccessStep();
      case STEPS.LINENS:
        return renderLinensStep();
      case STEPS.REVIEW:
        return renderReviewStep();
      default:
        return null;
    }
  };

  if (!home) {
    return (
      <View style={localStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={localStyles.loadingText}>Loading home information...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={handleBack} style={localStyles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>Complete Home Setup</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderProgressIndicator()}

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderCurrentStep()}
      </ScrollView>

      {/* Footer with navigation buttons */}
      <View style={localStyles.footer}>
        {currentStep < STEPS.REVIEW ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleNext}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#fff" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Complete Setup</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const localStyles = {
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral[100],
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  addressInfo: {
    flex: 1,
  },
  addressText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  cityText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  errorText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    marginTop: spacing.xs,
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.md,
  },
  sizeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  sizeButtonActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  sizeButtonText: {
    fontSize: 13,
    color: colors.neutral[500],
  },
  sizeButtonTextActive: {
    color: colors.primary[600],
    fontWeight: "600",
  },
  bathroomConfig: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.neutral[50],
    borderRadius: 8,
  },
  bathroomTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: 12,
  },
  configRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  configLabel: {
    flex: 1,
    color: colors.text.secondary,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neutral[200],
    justifyContent: "center",
    alignItems: "center",
  },
  counterButtonPlus: {
    backgroundColor: colors.primary[600],
  },
  counterButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  counterValue: {
    width: 40,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  reviewSection: {
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  reviewTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  reviewValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  reviewSubvalue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
};

export default CompleteHomeSetupWizard;
