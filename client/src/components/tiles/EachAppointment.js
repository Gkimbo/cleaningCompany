import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SegmentedButtons, TextInput } from "react-native-paper";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import FetchData from "../../services/fetchRequests/fetchData";
import CancellationWarningModal from "../modals/CancellationWarningModal";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";
import { API_BASE } from "../../services/config";

const BED_SIZE_OPTIONS = [
  { value: "long_twin", label: "Long Twin" },
  { value: "twin", label: "Twin" },
  { value: "full", label: "Full" },
  { value: "queen", label: "Queen" },
  { value: "king", label: "King" },
  { value: "california_king", label: "Cal King" },
];

const EachAppointment = ({
  id,
  index,
  date,
  price,
  bringSheets,
  bringTowels,
  keyPadCode,
  keyLocation,
  isDisabled,
  formatDate,
  handleTowelToggle,
  handleSheetsToggle,
  setChangesSubmitted,
  changeNotification,
  setChangeNotification,
  contact,
  paid,
  completed,
  timeToBeCompleted,
  cleanerName,
  token,
  onCancel,
  numBeds,
  numBaths,
  sheetConfigurations: initialSheetConfigs,
  towelConfigurations: initialTowelConfigs,
  onConfigurationsUpdate,
}) => {
  const [code, setCode] = useState("");
  const [key, setKeyLocation] = useState("");
  const [keyCodeToggle, setKeyCodeToggle] = useState("");
  const [error, setError] = useState(null);
  const [redirect, setRedirect] = useState(false);
  const [showAccessDetails, setShowAccessDetails] = useState(false);
  const [showAddons, setShowAddons] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [loadingCancellation, setLoadingCancellation] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [savingConfigs, setSavingConfigs] = useState(false);
  const [showBedOptions, setShowBedOptions] = useState(false);
  const [showTowelOptions, setShowTowelOptions] = useState(false);
  const navigate = useNavigate();

  // Initialize bed configurations
  const initializeBedConfigurations = (beds) => {
    const numBedsInt = parseInt(beds) || 0;
    const configs = [];
    for (let i = 1; i <= numBedsInt; i++) {
      configs.push({ bedNumber: i, size: "queen", needsSheets: true });
    }
    return configs;
  };

  // Initialize bathroom configurations
  const initializeBathroomConfigurations = (baths) => {
    const numBathsInt = parseInt(baths) || 0;
    const configs = [];
    for (let i = 1; i <= numBathsInt; i++) {
      configs.push({ bathroomNumber: i, towels: 2, faceCloths: 1 });
    }
    return configs;
  };

  // State for configurations
  const [bedConfigurations, setBedConfigurations] = useState(
    initialSheetConfigs || initializeBedConfigurations(numBeds)
  );
  const [bathroomConfigurations, setBathroomConfigurations] = useState(
    initialTowelConfigs || initializeBathroomConfigurations(numBaths)
  );

  // Update configurations when props change
  useEffect(() => {
    if (initialSheetConfigs) {
      setBedConfigurations(initialSheetConfigs);
    } else if (numBeds) {
      setBedConfigurations(initializeBedConfigurations(numBeds));
    }
  }, [initialSheetConfigs, numBeds]);

  useEffect(() => {
    if (initialTowelConfigs) {
      setBathroomConfigurations(initialTowelConfigs);
    } else if (numBaths) {
      setBathroomConfigurations(initializeBathroomConfigurations(numBaths));
    }
  }, [initialTowelConfigs, numBaths]);

  // Update a specific bed configuration
  const updateBedConfig = async (bedNumber, field, value) => {
    const updatedConfigs = bedConfigurations.map((bed) =>
      bed.bedNumber === bedNumber ? { ...bed, [field]: value } : bed
    );
    setBedConfigurations(updatedConfigs);
    await saveConfigurations(updatedConfigs, bathroomConfigurations);
  };

  // Update a specific bathroom configuration
  const updateBathroomConfig = async (bathroomNumber, field, value) => {
    const updatedConfigs = bathroomConfigurations.map((bath) =>
      bath.bathroomNumber === bathroomNumber ? { ...bath, [field]: value } : bath
    );
    setBathroomConfigurations(updatedConfigs);
    await saveConfigurations(bedConfigurations, updatedConfigs);
  };

  // Save configurations to server
  const saveConfigurations = async (sheetConfigs, towelConfigs) => {
    if (!token || isDisabled) return;
    setSavingConfigs(true);
    try {
      const response = await fetch(`${API_BASE}/appointments/${id}/linens`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sheetConfigurations: sheetConfigs,
          towelConfigurations: towelConfigs,
          bringSheets,
          bringTowels,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onConfigurationsUpdate) {
          onConfigurationsUpdate(id, data.appointment);
        }
        setChangesSubmitted(true);
        setChangeNotification({
          message: "Configuration updated successfully!",
          appointment: id,
        });
      }
    } catch (err) {
      console.error("Error saving configurations:", err);
      setError("Failed to save configuration");
    } finally {
      setSavingConfigs(false);
    }
  };

  // Handle code and key inputs
  const handleKeyPadCode = (newCode) => {
    const regex = /^[\d#]*(\.\d*)?(\s*)?$/;
    if (!regex.test(newCode)) {
      setError("Key Pad Code can only be a number!");
      return;
    }
    if (newCode === "") {
      setError("Key Pad Code cannot be blank!");
    } else {
      setError(null);
    }
    setCode(newCode);
    setChangeNotification({ message: "", appointment: "" });
  };

  const handleKeyLocation = (newLocation) => {
    setKeyLocation(newLocation);
    setChangeNotification({ message: "", appointment: "" });
  };

  // Submit updates
  const handleSubmit = async () => {
    if (!code && !key) {
      setError(
        "Please provide instructions on how to get into the property with either a key or a code"
      );
      return;
    }
    setError(null);
    if (code !== keyPadCode || key !== keyLocation) {
      if (code) {
        await Appointment.updateCodeAppointments(code, id);
      } else {
        await Appointment.updateKeyAppointments(key, id);
      }
      setChangesSubmitted(true);
      setChangeNotification({
        message: `Changes made only to the ${formatDate(date)} appointment!`,
        appointment: id,
      });
    } else {
      setError("No changes made.");
    }
  };

  // Toggle between code/key
  const handleKeyToggle = (text) => {
    if (text === "code") {
      setKeyCodeToggle("code");
      setKeyLocation("");
    } else {
      setKeyCodeToggle("key");
      setCode("");
    }
    setChangeNotification({ message: "", appointment: "" });
  };

  // Preload values
  useEffect(() => {
    if (keyPadCode !== "") {
      setCode(keyPadCode);
      setKeyCodeToggle("code");
    }
    if (keyLocation !== "") {
      setKeyLocation(keyLocation);
      setKeyCodeToggle("key");
    }
  }, []);

  // Redirect handler
  useEffect(() => {
    if (redirect) {
      navigate("/bill");
      setRedirect(false);
    }
  }, [redirect]);

  const handleRedirectToBill = () => {
    setRedirect(true);
  };

  // Format time display
  const getTimeDisplay = () => {
    switch (timeToBeCompleted) {
      case "anytime":
        return "Anytime";
      case "10-3":
        return "10am - 3pm";
      case "11-4":
        return "11am - 4pm";
      case "12-2":
        return "12pm - 2pm";
      default:
        return "Anytime";
    }
  };

  // Get days until appointment
  const getDaysUntil = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const appointmentDate = new Date(date);
    appointmentDate.setHours(0, 0, 0, 0);
    const diffTime = appointmentDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntil = getDaysUntil();

  // Handle opening cancellation modal
  const handleCancelPress = async () => {
    if (!token) {
      setError("Authentication required to cancel");
      return;
    }
    setLoadingCancellation(true);
    try {
      const info = await FetchData.getCancellationInfo(id, token);
      if (info.error) {
        setError(info.error);
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
      const result = await FetchData.cancelAsHomeowner(id, token);
      if (result.error) {
        setError(result.error);
        setCancelLoading(false);
        return;
      }
      setShowCancelModal(false);
      if (onCancel) {
        onCancel(id, result);
      }
    } catch (err) {
      setError("Failed to cancel appointment");
    } finally {
      setCancelLoading(false);
    }
  };

  // --- Render Completed States ---
  if (completed && !paid) {
    return (
      <Pressable onPress={handleRedirectToBill} style={({ pressed }) => [styles.card, styles.cardNeedsPay, pressed && styles.cardPressed]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.dateRow}>
              <Icon name="calendar" size={14} color={colors.warning[600]} />
              <Text style={styles.dateText}>{formatDate(date)}</Text>
            </View>
            <View style={[styles.badge, styles.badgeWarning]}>
              <Icon name="credit-card" size={10} color={colors.warning[700]} />
              <Text style={[styles.badgeText, styles.badgeTextWarning]}>Payment Due</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceText, styles.priceWarning]}>${price}</Text>
          </View>
        </View>
        <View style={styles.paymentPrompt}>
          <Icon name="hand-pointer-o" size={14} color={colors.warning[700]} />
          <Text style={styles.paymentPromptText}>Cleaning complete - Tap to pay</Text>
          <Icon name="chevron-right" size={12} color={colors.warning[600]} />
        </View>
      </Pressable>
    );
  }

  if (completed && paid) {
    return (
      <View style={[styles.card, styles.cardComplete]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.dateRow}>
              <Icon name="calendar-check-o" size={14} color={colors.success[600]} />
              <Text style={[styles.dateText, styles.dateTextComplete]}>{formatDate(date)}</Text>
            </View>
            <View style={[styles.badge, styles.badgeSuccess]}>
              <Icon name="check" size={10} color={colors.success[700]} />
              <Text style={[styles.badgeText, styles.badgeTextSuccess]}>Completed & Paid</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.priceText, styles.priceComplete]}>${price}</Text>
            <Icon name="check-circle" size={16} color={colors.success[500]} />
          </View>
        </View>
        {cleanerName && (
          <View style={styles.cleanerInfo}>
            <Icon name="user" size={12} color={colors.text.tertiary} />
            <Text style={styles.cleanerName}>Cleaned by {cleanerName}</Text>
          </View>
        )}
      </View>
    );
  }

  // --- Render Active Appointment ---
  return (
    <View style={[styles.card, isDisabled ? styles.cardUpcoming : styles.cardScheduled]}>
      {/* Header with Date & Price */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.dateRow}>
            <Icon name="calendar" size={14} color={colors.primary[500]} />
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </View>
          {isDisabled ? (
            <View style={[styles.badge, styles.badgePrimary]}>
              <Icon name="clock-o" size={10} color={colors.primary[700]} />
              <Text style={[styles.badgeText, styles.badgeTextPrimary]}>
                {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `In ${daysUntil} days`}
              </Text>
            </View>
          ) : (
            <View style={[styles.badge, styles.badgeDefault]}>
              <Text style={[styles.badgeText, styles.badgeTextDefault]}>Scheduled</Text>
            </View>
          )}
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Total</Text>
          <Text style={styles.priceText}>${price}</Text>
        </View>
      </View>

      {/* Quick Info Cards */}
      <View style={styles.infoCards}>
        <View style={styles.infoCard}>
          <Icon name="clock-o" size={14} color={colors.primary[500]} />
          <View>
            <Text style={styles.infoCardLabel}>Time Window</Text>
            <Text style={styles.infoCardValue}>{getTimeDisplay()}</Text>
          </View>
        </View>
        <View style={styles.infoCard}>
          <Icon name="phone" size={14} color={colors.primary[500]} />
          <View>
            <Text style={styles.infoCardLabel}>Contact</Text>
            <Text style={styles.infoCardValue}>{contact}</Text>
          </View>
        </View>
      </View>

      {/* Add-ons Section - Collapsible */}
      <Pressable onPress={() => setShowAddons(!showAddons)} style={styles.collapsibleHeader}>
        <View style={styles.collapsibleTitleRow}>
          <Icon name="plus-circle" size={14} color={colors.secondary[500]} />
          <Text style={styles.collapsibleTitle}>Add-on Services</Text>
          {(bringSheets === "yes" || bringTowels === "yes") && (
            <View style={styles.addonIndicator}>
              <Text style={styles.addonIndicatorText}>
                {[bringSheets === "yes" && "Sheets", bringTowels === "yes" && "Towels"].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}
        </View>
        <Icon name={showAddons ? "chevron-up" : "chevron-down"} size={12} color={colors.text.tertiary} />
      </Pressable>

      {showAddons && (
        <View style={styles.addonsSection}>
          {/* Sheets Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <View style={styles.toggleIconContainer}>
                <Icon name="bed" size={14} color={colors.secondary[500]} />
              </View>
              <View>
                <Text style={styles.toggleLabel}>Fresh Sheets</Text>
                <Text style={styles.togglePrice}>
                  {bringSheets === "yes" && bedConfigurations.length > 0
                    ? `$${bedConfigurations.filter(b => b.needsSheets).length * 30} ($30 x ${bedConfigurations.filter(b => b.needsSheets).length} beds)`
                    : "$30 per bed"}
                </Text>
              </View>
            </View>
            {isDisabled ? (
              <View style={[styles.lockedValue, bringSheets === "yes" && styles.lockedValueActive]}>
                <Text style={[styles.lockedValueText, bringSheets === "yes" && styles.lockedValueTextActive]}>
                  {bringSheets === "yes" ? "Included" : "Not included"}
                </Text>
              </View>
            ) : (
              <SegmentedButtons
                value={bringSheets}
                onValueChange={(value) => handleSheetsToggle(value, id)}
                buttons={[
                  { value: "no", label: "No" },
                  { value: "yes", label: "Yes" },
                ]}
                style={styles.segmentedButton}
                density="small"
              />
            )}
          </View>

          {/* Bed Size Configuration - shown when sheets is "yes" */}
          {bringSheets === "yes" && bedConfigurations.length > 0 && !isDisabled && (
            <View style={styles.expandableSection}>
              {!showBedOptions ? (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setShowBedOptions(true)}
                >
                  <Icon name="cog" size={12} color={colors.primary[600]} />
                  <Text style={styles.expandButtonText}>Configure Bed Sizes</Text>
                  <Icon name="chevron-down" size={10} color={colors.primary[600]} />
                </TouchableOpacity>
              ) : (
                <View style={styles.configurationSection}>
                  <View style={styles.configHeader}>
                    <Text style={styles.configSectionTitle}>Select bed sizes:</Text>
                    <TouchableOpacity
                      style={styles.hideButton}
                      onPress={() => setShowBedOptions(false)}
                    >
                      <Text style={styles.hideButtonText}>Hide</Text>
                      <Icon name="chevron-up" size={10} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  </View>
                  {bedConfigurations.map((bed) => (
                    <View key={bed.bedNumber} style={styles.configRow}>
                      <Text style={styles.configLabel}>Bed {bed.bedNumber}</Text>
                      <View style={styles.bedSizeOptions}>
                        {BED_SIZE_OPTIONS.map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.bedSizeButton,
                              bed.size === option.value && styles.bedSizeButtonActive,
                            ]}
                            onPress={() => updateBedConfig(bed.bedNumber, "size", option.value)}
                            disabled={savingConfigs}
                          >
                            <Text
                              style={[
                                styles.bedSizeButtonText,
                                bed.size === option.value && styles.bedSizeButtonTextActive,
                              ]}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  {savingConfigs && (
                    <View style={styles.savingIndicator}>
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                      <Text style={styles.savingText}>Saving...</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Towels Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <View style={styles.toggleIconContainer}>
                <Icon name="bath" size={14} color={colors.secondary[500]} />
              </View>
              <View>
                <Text style={styles.toggleLabel}>Fresh Towels</Text>
                <Text style={styles.togglePrice}>
                  {bringTowels === "yes" && bathroomConfigurations.length > 0
                    ? `$${bathroomConfigurations.reduce((sum, b) => sum + (b.towels || 0) * 5 + (b.faceCloths || 0) * 2, 0)} - $5/towel, $2/face cloth`
                    : "$5/towel, $2/face cloth"}
                </Text>
              </View>
            </View>
            {isDisabled ? (
              <View style={[styles.lockedValue, bringTowels === "yes" && styles.lockedValueActive]}>
                <Text style={[styles.lockedValueText, bringTowels === "yes" && styles.lockedValueTextActive]}>
                  {bringTowels === "yes" ? "Included" : "Not included"}
                </Text>
              </View>
            ) : (
              <SegmentedButtons
                value={bringTowels}
                onValueChange={(value) => handleTowelToggle(value, id)}
                buttons={[
                  { value: "no", label: "No" },
                  { value: "yes", label: "Yes" },
                ]}
                style={styles.segmentedButton}
                density="small"
              />
            )}
          </View>

          {/* Bathroom Configuration - shown when towels is "yes" */}
          {bringTowels === "yes" && bathroomConfigurations.length > 0 && !isDisabled && (
            <View style={styles.expandableSection}>
              {!showTowelOptions ? (
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setShowTowelOptions(true)}
                >
                  <Icon name="cog" size={12} color={colors.primary[600]} />
                  <Text style={styles.expandButtonText}>Configure Towels</Text>
                  <Icon name="chevron-down" size={10} color={colors.primary[600]} />
                </TouchableOpacity>
              ) : (
                <View style={styles.configurationSection}>
                  <View style={styles.configHeader}>
                    <Text style={styles.configSectionTitle}>Configure towels per bathroom:</Text>
                    <TouchableOpacity
                      style={styles.hideButton}
                      onPress={() => setShowTowelOptions(false)}
                    >
                      <Text style={styles.hideButtonText}>Hide</Text>
                      <Icon name="chevron-up" size={10} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  </View>
                  {bathroomConfigurations.map((bath) => (
                    <View key={bath.bathroomNumber} style={styles.bathroomConfigCard}>
                      <Text style={styles.bathroomTitle}>Bathroom {bath.bathroomNumber}</Text>

                      {/* Towels Counter */}
                      <View style={styles.counterRow}>
                        <Text style={styles.counterLabel}>Towels ($5 each):</Text>
                        <View style={styles.counterControls}>
                          <TouchableOpacity
                            style={styles.counterButton}
                            onPress={() => updateBathroomConfig(bath.bathroomNumber, "towels", Math.max(0, bath.towels - 1))}
                            disabled={savingConfigs}
                          >
                            <Text style={styles.counterButtonText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{bath.towels}</Text>
                          <TouchableOpacity
                            style={[styles.counterButton, styles.counterButtonAdd]}
                            onPress={() => updateBathroomConfig(bath.bathroomNumber, "towels", Math.min(10, bath.towels + 1))}
                            disabled={savingConfigs}
                          >
                            <Text style={[styles.counterButtonText, styles.counterButtonTextAdd]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Face Cloths Counter */}
                      <View style={styles.counterRow}>
                        <Text style={styles.counterLabel}>Face cloths ($2 each):</Text>
                        <View style={styles.counterControls}>
                          <TouchableOpacity
                            style={styles.counterButton}
                            onPress={() => updateBathroomConfig(bath.bathroomNumber, "faceCloths", Math.max(0, bath.faceCloths - 1))}
                            disabled={savingConfigs}
                          >
                            <Text style={styles.counterButtonText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.counterValue}>{bath.faceCloths}</Text>
                          <TouchableOpacity
                            style={[styles.counterButton, styles.counterButtonAdd]}
                            onPress={() => updateBathroomConfig(bath.bathroomNumber, "faceCloths", Math.min(10, bath.faceCloths + 1))}
                            disabled={savingConfigs}
                          >
                            <Text style={[styles.counterButtonText, styles.counterButtonTextAdd]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                  {savingConfigs && (
                    <View style={styles.savingIndicator}>
                      <ActivityIndicator size="small" color={colors.primary[500]} />
                      <Text style={styles.savingText}>Saving...</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {isDisabled && (
            <View style={styles.lockedNotice}>
              <Icon name="lock" size={12} color={colors.text.tertiary} />
              <Text style={styles.lockedNoticeText}>
                Changes locked within 1 week of appointment
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Access Details Section - Collapsible */}
      <Pressable onPress={() => setShowAccessDetails(!showAccessDetails)} style={styles.collapsibleHeader}>
        <View style={styles.collapsibleTitleRow}>
          <Icon name="key" size={14} color={colors.primary[500]} />
          <Text style={styles.collapsibleTitle}>Access Instructions</Text>
          {(code || key) && (
            <View style={styles.accessIndicator}>
              <Icon name="check-circle" size={12} color={colors.success[500]} />
            </View>
          )}
        </View>
        <Icon name={showAccessDetails ? "chevron-up" : "chevron-down"} size={12} color={colors.text.tertiary} />
      </Pressable>

      {showAccessDetails && (
        <View style={styles.accessSection}>
          {/* Access Method Toggle */}
          <View style={styles.accessMethodRow}>
            <SegmentedButtons
              value={keyCodeToggle}
              onValueChange={handleKeyToggle}
              buttons={[
                { value: "key", label: "Key Location", icon: "key" },
                { value: "code", label: "Door Code", icon: "lock" },
              ]}
              style={styles.accessToggle}
            />
          </View>

          {/* Code Input */}
          {keyCodeToggle === "code" && (
            <View style={styles.inputContainer}>
              <View style={styles.inputLabelRow}>
                <Icon name="lock" size={12} color={colors.text.secondary} />
                <Text style={styles.inputLabel}>Door Code</Text>
              </View>
              <TextInput
                mode="outlined"
                value={code || ""}
                onChangeText={handleKeyPadCode}
                style={styles.codeInput}
                placeholder="1234#"
                keyboardType="numeric"
                outlineColor={colors.border.default}
                activeOutlineColor={colors.primary[500]}
              />
            </View>
          )}

          {/* Key Location Input */}
          {keyCodeToggle === "key" && (
            <View style={styles.inputContainer}>
              <View style={styles.inputLabelRow}>
                <Icon name="map-marker" size={12} color={colors.text.secondary} />
                <Text style={styles.inputLabel}>Key Location</Text>
              </View>
              <TextInput
                mode="outlined"
                value={key || ""}
                onChangeText={handleKeyLocation}
                style={styles.keyInput}
                placeholder="Under the mat by the back door..."
                multiline
                outlineColor={colors.border.default}
                activeOutlineColor={colors.primary[500]}
              />
              <View style={styles.inputHintRow}>
                <Icon name="info-circle" size={10} color={colors.text.tertiary} />
                <Text style={styles.inputHint}>
                  Be specific - include landmarks or details
                </Text>
              </View>
            </View>
          )}

          {/* Change Notification */}
          {changeNotification.appointment === id && (
            <View style={styles.successNotice}>
              <Icon name="check-circle" size={14} color={colors.success[600]} />
              <Text style={styles.successNoticeText}>{changeNotification.message}</Text>
            </View>
          )}

          {/* Submit Button */}
          {(code !== keyPadCode || key !== keyLocation) && (
            <Pressable onPress={handleSubmit} style={({ pressed }) => [styles.submitButton, pressed && styles.submitButtonPressed]}>
              <Icon name="save" size={14} color={colors.neutral[0]} />
              <Text style={styles.submitButtonText}>Save Changes</Text>
            </Pressable>
          )}

          {error && (
            <View style={styles.errorNotice}>
              <Icon name="exclamation-triangle" size={14} color={colors.error[600]} />
              <Text style={styles.errorNoticeText}>{error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Cancel Appointment Section */}
      {!completed && (
        <View style={styles.cancelSection}>
          <Pressable
            onPress={handleCancelPress}
            disabled={loadingCancellation}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && styles.cancelButtonPressed,
              loadingCancellation && styles.cancelButtonDisabled,
            ]}
          >
            {loadingCancellation ? (
              <ActivityIndicator size="small" color={colors.error[600]} />
            ) : (
              <>
                <Icon name="times-circle" size={14} color={colors.error[600]} />
                <Text style={styles.cancelButtonText}>Cancel Appointment</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Cancellation Warning Modal */}
      <CancellationWarningModal
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
  card: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...shadows.md,
  },
  cardScheduled: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[400],
  },
  cardUpcoming: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  cardNeedsPay: {
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
    backgroundColor: colors.warning[50],
  },
  cardComplete: {
    borderLeftWidth: 4,
    borderLeftColor: colors.success[500],
    backgroundColor: colors.success[50],
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  dateTextComplete: {
    color: colors.success[700],
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  priceText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.secondary[600],
  },
  priceWarning: {
    color: colors.warning[700],
  },
  priceComplete: {
    color: colors.success[600],
  },

  // Badges
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    alignSelf: "flex-start",
  },
  badgeDefault: {
    backgroundColor: colors.neutral[100],
  },
  badgePrimary: {
    backgroundColor: colors.primary[100],
  },
  badgeSuccess: {
    backgroundColor: colors.success[100],
  },
  badgeWarning: {
    backgroundColor: colors.warning[100],
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  badgeTextDefault: {
    color: colors.text.secondary,
  },
  badgeTextPrimary: {
    color: colors.primary[700],
  },
  badgeTextSuccess: {
    color: colors.success[700],
  },
  badgeTextWarning: {
    color: colors.warning[700],
  },

  // Cleaner Info
  cleanerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.success[200],
  },
  cleanerName: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },

  // Payment Prompt
  paymentPrompt: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning[100],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  paymentPromptText: {
    flex: 1,
    color: colors.warning[700],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "center",
  },

  // Info Cards
  infoCards: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  infoCardLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  infoCardValue: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },

  // Collapsible
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  collapsibleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  collapsibleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  addonIndicator: {
    backgroundColor: colors.secondary[100],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  addonIndicatorText: {
    fontSize: typography.fontSize.xs,
    color: colors.secondary[700],
    fontWeight: typography.fontWeight.medium,
  },
  accessIndicator: {
    marginLeft: spacing.xs,
  },

  // Add-ons Section
  addonsSection: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },

  // Toggle Row
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    rowGap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 140,
  },
  toggleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.secondary[50],
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  toggleLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.medium,
  },
  togglePrice: {
    fontSize: typography.fontSize.xs,
    color: colors.secondary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  segmentedButton: {
    minWidth: 110,
    flexShrink: 0,
  },
  lockedValue: {
    backgroundColor: colors.neutral[100],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  lockedValueActive: {
    backgroundColor: colors.secondary[100],
  },
  lockedValueText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  lockedValueTextActive: {
    color: colors.secondary[700],
    fontWeight: typography.fontWeight.medium,
  },

  // Locked Notice
  lockedNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.neutral[100],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  lockedNoticeText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Access Section
  accessSection: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  accessMethodRow: {
    marginBottom: spacing.md,
  },
  accessToggle: {
    width: "100%",
  },

  // Inputs
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  codeInput: {
    backgroundColor: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    textAlign: "center",
    letterSpacing: 4,
  },
  keyInput: {
    backgroundColor: colors.neutral[0],
    minHeight: 80,
  },
  inputHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  inputHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },

  // Notices
  successNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.success[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.success[200],
    marginBottom: spacing.md,
  },
  successNoticeText: {
    flex: 1,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
  },
  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
    marginTop: spacing.sm,
  },
  errorNoticeText: {
    flex: 1,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },

  // Submit Button
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  submitButtonPressed: {
    backgroundColor: colors.primary[700],
  },
  submitButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Cancel Section
  cancelSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.error[50],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  cancelButtonPressed: {
    backgroundColor: colors.error[100],
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    color: colors.error[600],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },

  // Expandable Section
  expandableSection: {
    marginBottom: spacing.sm,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderStyle: "dashed",
  },
  expandButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Configuration Section
  configurationSection: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  configHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  configSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  hideButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  hideButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  configRow: {
    marginBottom: spacing.md,
  },
  configLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  bedSizeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  bedSizeButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.neutral[0],
  },
  bedSizeButtonActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  bedSizeButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  bedSizeButtonTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },

  // Bathroom Config Card
  bathroomConfigCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  bathroomTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  counterLabel: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  counterControls: {
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
  counterButtonAdd: {
    backgroundColor: colors.primary[500],
  },
  counterButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text.primary,
  },
  counterButtonTextAdd: {
    color: colors.neutral[0],
  },
  counterValue: {
    width: 40,
    textAlign: "center",
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Saving Indicator
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  savingText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
});

export default EachAppointment;
