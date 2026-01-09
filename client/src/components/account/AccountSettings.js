import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import FetchData from "../../services/fetchRequests/fetchData";
import OwnerDashboardService from "../../services/fetchRequests/OwnerDashboardService";
import { colors, spacing, radius, typography, shadows } from "../../services/styles/theme";

const AccountSettings = ({ state, dispatch }) => {
  const [username, setUsername] = useState(state.currentUser.user?.username || "");
  const [email, setEmail] = useState(state.currentUser.user?.email || "");
  const [phone, setPhone] = useState(state.currentUser.user?.phone || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  // Owner notification email settings
  const [ownerSettings, setOwnerSettings] = useState(null);
  const [notificationEmailInput, setNotificationEmailInput] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaveResult, setEmailSaveResult] = useState(null);
  const [loadingOwnerSettings, setLoadingOwnerSettings] = useState(false);

  // Cleaner service area settings
  const [serviceArea, setServiceArea] = useState(null);
  const [serviceAreaAddress, setServiceAreaAddress] = useState("");
  const [serviceAreaRadius, setServiceAreaRadius] = useState("30");
  const [loadingServiceArea, setLoadingServiceArea] = useState(false);
  const [savingServiceArea, setSavingServiceArea] = useState(false);
  const [serviceAreaResult, setServiceAreaResult] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const isOwner = state.account === "owner";
  const isCleaner = state.account === "cleaner";

  useEffect(() => {
    if (isOwner && state.currentUser.token) {
      fetchOwnerSettings();
    }
  }, [isOwner, state.currentUser.token]);

  useEffect(() => {
    if (isCleaner && state.currentUser.token) {
      fetchServiceArea();
    }
  }, [isCleaner, state.currentUser.token]);

  const fetchOwnerSettings = async () => {
    setLoadingOwnerSettings(true);
    try {
      const settings = await OwnerDashboardService.getSettings(state.currentUser.token);
      setOwnerSettings(settings);
      setNotificationEmailInput(settings.notificationEmail || "");
    } catch (err) {
      console.error("Failed to fetch owner settings:", err);
    } finally {
      setLoadingOwnerSettings(false);
    }
  };

  const fetchServiceArea = async () => {
    setLoadingServiceArea(true);
    try {
      const result = await FetchData.getServiceArea(state.currentUser.token);
      if (result.serviceArea) {
        setServiceArea(result.serviceArea);
        setServiceAreaAddress(result.serviceArea.address || "");
        setServiceAreaRadius(String(result.serviceArea.radiusMiles || 30));
      }
    } catch (err) {
      console.error("Failed to fetch service area:", err);
    } finally {
      setLoadingServiceArea(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setGettingLocation(true);
    setServiceAreaResult(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setServiceAreaResult({ success: false, error: "Location permission denied" });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      let addressString = "";
      if (address) {
        const parts = [address.city, address.region, address.postalCode].filter(Boolean);
        addressString = parts.join(", ");
      }

      // Save to server
      const result = await FetchData.updateServiceArea(state.currentUser.token, {
        address: addressString,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radiusMiles: parseFloat(serviceAreaRadius) || 30,
      });

      if (result.error) {
        setServiceAreaResult({ success: false, error: result.error });
      } else {
        setServiceArea(result.serviceArea);
        setServiceAreaAddress(addressString);
        setServiceAreaResult({ success: true, message: "Service area updated with your current location" });
      }
    } catch (err) {
      console.error("Error getting location:", err);
      setServiceAreaResult({ success: false, error: "Failed to get current location" });
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSaveServiceArea = async () => {
    if (!serviceAreaAddress.trim()) {
      setServiceAreaResult({ success: false, error: "Please enter an address or use current location" });
      return;
    }

    setSavingServiceArea(true);
    setServiceAreaResult(null);
    try {
      // Geocode the address to get coordinates
      const geocoded = await Location.geocodeAsync(serviceAreaAddress);

      if (!geocoded || geocoded.length === 0) {
        setServiceAreaResult({ success: false, error: "Could not find location. Please try a different address." });
        return;
      }

      const { latitude, longitude } = geocoded[0];

      const result = await FetchData.updateServiceArea(state.currentUser.token, {
        address: serviceAreaAddress.trim(),
        latitude,
        longitude,
        radiusMiles: parseFloat(serviceAreaRadius) || 30,
      });

      if (result.error) {
        setServiceAreaResult({ success: false, error: result.error });
      } else {
        setServiceArea(result.serviceArea);
        setServiceAreaResult({ success: true, message: "Service area saved successfully" });
      }
    } catch (err) {
      console.error("Error saving service area:", err);
      setServiceAreaResult({ success: false, error: "Failed to save service area" });
    } finally {
      setSavingServiceArea(false);
    }
  };

  const handleUpdateRadius = async () => {
    if (!serviceArea?.hasLocation) {
      setServiceAreaResult({ success: false, error: "Please set your location first" });
      return;
    }

    setSavingServiceArea(true);
    setServiceAreaResult(null);
    try {
      const result = await FetchData.updateServiceArea(state.currentUser.token, {
        address: serviceAreaAddress,
        latitude: null, // Server will keep existing
        longitude: null,
        radiusMiles: parseFloat(serviceAreaRadius) || 30,
      });

      if (result.error) {
        setServiceAreaResult({ success: false, error: result.error });
      } else {
        setServiceArea(result.serviceArea);
        setServiceAreaResult({ success: true, message: "Service radius updated" });
      }
    } catch (err) {
      console.error("Error updating radius:", err);
      setServiceAreaResult({ success: false, error: "Failed to update radius" });
    } finally {
      setSavingServiceArea(false);
    }
  };

  const handleSaveNotificationEmail = async () => {
    setSavingEmail(true);
    setEmailSaveResult(null);
    try {
      const result = await OwnerDashboardService.updateNotificationEmail(
        state.currentUser.token,
        notificationEmailInput.trim() || null
      );
      if (result.success) {
        setEmailSaveResult({ success: true, message: result.message });
        setOwnerSettings((prev) => ({
          ...prev,
          notificationEmail: result.notificationEmail,
          effectiveNotificationEmail: result.effectiveNotificationEmail,
        }));
      } else {
        setEmailSaveResult({ success: false, error: result.error });
      }
    } catch (err) {
      setEmailSaveResult({ success: false, error: "Failed to save notification email" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleClearNotificationEmail = async () => {
    setNotificationEmailInput("");
    setSavingEmail(true);
    setEmailSaveResult(null);
    try {
      const result = await OwnerDashboardService.updateNotificationEmail(
        state.currentUser.token,
        null
      );
      if (result.success) {
        setEmailSaveResult({ success: true, message: result.message });
        setOwnerSettings((prev) => ({
          ...prev,
          notificationEmail: null,
          effectiveNotificationEmail: result.effectiveNotificationEmail,
        }));
      } else {
        setEmailSaveResult({ success: false, error: result.error });
      }
    } catch (err) {
      setEmailSaveResult({ success: false, error: "Failed to clear notification email" });
    } finally {
      setSavingEmail(false);
    }
  };

  const validateUsername = () => {
    const validationErrors = [];
    if (username.length < 4) {
      validationErrors.push("Username must be at least 4 characters.");
    }
    if (username.length > 20) {
      validationErrors.push("Username must be 20 characters or less.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      validationErrors.push("Username can only contain letters, numbers, and underscores.");
    }
    if (username.toLowerCase().includes("owner")) {
      validationErrors.push("Username cannot contain the word 'owner'.");
    }
    return validationErrors;
  };

  const validatePassword = () => {
    const validationErrors = [];
    if (!currentPassword) {
      validationErrors.push("Current password is required.");
    }
    if (newPassword.length < 6) {
      validationErrors.push("New password must be at least 6 characters.");
    }
    if (newPassword !== confirmPassword) {
      validationErrors.push("New passwords do not match.");
    }
    return validationErrors;
  };

  const validateEmail = () => {
    const validationErrors = [];
    if (!email) {
      validationErrors.push("Email is required.");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      validationErrors.push("Please enter a valid email address.");
    }
    return validationErrors;
  };

  const validatePhone = () => {
    const validationErrors = [];
    // Phone is optional, only validate if provided
    if (phone && phone.length > 0) {
      const digitsOnly = phone.replace(/\D/g, "");
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        validationErrors.push("Please enter a valid phone number (10-15 digits).");
      }
    }
    return validationErrors;
  };

  const handleUpdateUsername = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validateUsername();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updateUsername(
        state.currentUser.token,
        username
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Username updated successfully!");
        // Update local state
        dispatch({
          type: "UPDATE_USER",
          payload: { ...state.currentUser.user, username },
        });
      }
    } catch (error) {
      setErrors(["Failed to update username. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validatePassword();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updatePassword(
        state.currentUser.token,
        currentPassword,
        newPassword
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setErrors(["Failed to update password. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmail = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validateEmail();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updateEmail(
        state.currentUser.token,
        email
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Email updated successfully!");
        // Update local state
        dispatch({
          type: "UPDATE_USER",
          payload: { ...state.currentUser.user, email },
        });
      }
    } catch (error) {
      setErrors(["Failed to update email. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePhone = async () => {
    setErrors([]);
    setSuccessMessage("");

    const validationErrors = validatePhone();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await FetchData.updatePhone(
        state.currentUser.token,
        phone
      );

      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage("Phone number updated successfully!");
        // Update local state
        dispatch({
          type: "UPDATE_USER",
          payload: { ...state.currentUser.user, phone: response.phone },
        });
      }
    } catch (error) {
      setErrors(["Failed to update phone number. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Account Settings</Text>
      <Text style={styles.subtitle}>Update your login credentials</Text>

      {/* Success Message */}
      {successMessage !== "" && (
        <View style={styles.successContainer}>
          <Feather name="check-circle" size={20} color={colors.success[600]} />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <View style={styles.errorContainer}>
          {errors.map((error, index) => (
            <View key={index} style={styles.errorRow}>
              <Feather name="alert-circle" size={16} color={colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Username Section - hidden for owners */}
      {state.account !== "owner" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Username</Text>
          <Text style={styles.sectionDescription}>
            Your username is used to log into your account.
          </Text>

          <Text style={styles.label}>New Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter new username"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleUpdateUsername}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Updating..." : "Update Username"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Email Section - hidden for owners */}
      {state.account !== "owner" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Email</Text>
          <Text style={styles.sectionDescription}>
            Update the email address associated with your account.
          </Text>

          <Text style={styles.label}>New Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter new email address"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Pressable
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleUpdateEmail}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? "Updating..." : "Update Email"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Phone Section - available for all users */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Phone Number</Text>
        <Text style={styles.sectionDescription}>
          Update your phone number for account contact purposes.
        </Text>

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number (optional)"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="phone-pad"
          autoCorrect={false}
        />

        <Pressable
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleUpdatePhone}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Updating..." : "Update Phone"}
          </Text>
        </Pressable>
      </View>

      {/* Cleaner Service Area Section - Only visible to cleaners */}
      {isCleaner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Area</Text>
          <Text style={styles.sectionDescription}>
            Set your service area to receive notifications for last-minute bookings near you.
            You'll be notified when homeowners book cleaning appointments within your radius.
          </Text>

          {loadingServiceArea ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <>
              {/* Current Status */}
              {serviceArea?.hasLocation && (
                <View style={styles.currentEmailBox}>
                  <Text style={styles.currentEmailLabel}>Current service area:</Text>
                  <Text style={styles.currentEmailValue}>
                    {serviceArea.address || "Location set"}
                  </Text>
                  <Text style={[styles.currentEmailLabel, { marginTop: 4 }]}>
                    Radius: {serviceArea.radiusMiles || 30} miles
                  </Text>
                </View>
              )}

              {/* Use Current Location Button */}
              <Pressable
                style={[
                  styles.button,
                  styles.locationButton,
                  gettingLocation && styles.buttonDisabled,
                ]}
                onPress={handleUseCurrentLocation}
                disabled={gettingLocation || savingServiceArea}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={colors.neutral[0]} />
                ) : (
                  <>
                    <Feather name="navigation" size={16} color={colors.neutral[0]} style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Use Current Location</Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.orDivider}>— or enter address —</Text>

              {/* Address Input */}
              <Text style={styles.label}>City, State or Address</Text>
              <TextInput
                style={styles.input}
                value={serviceAreaAddress}
                onChangeText={setServiceAreaAddress}
                placeholder="e.g., Austin, TX or 123 Main St"
                placeholderTextColor={colors.text.tertiary}
                autoCapitalize="words"
                autoCorrect={false}
              />

              {/* Radius Input */}
              <Text style={styles.label}>Service Radius (miles)</Text>
              <View style={styles.radiusInputRow}>
                <TextInput
                  style={[styles.input, styles.radiusInput]}
                  value={serviceAreaRadius}
                  onChangeText={setServiceAreaRadius}
                  placeholder="30"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="numeric"
                />
                <Text style={styles.radiusLabel}>miles</Text>
              </View>

              {/* Save Button */}
              <Pressable
                style={[
                  styles.button,
                  styles.primaryButton,
                  savingServiceArea && styles.buttonDisabled,
                ]}
                onPress={handleSaveServiceArea}
                disabled={savingServiceArea || gettingLocation}
              >
                <Text style={styles.primaryButtonText}>
                  {savingServiceArea ? "Saving..." : "Save Service Area"}
                </Text>
              </Pressable>

              {/* Result Message */}
              {serviceAreaResult && (
                <View
                  style={[
                    styles.emailResultBox,
                    serviceAreaResult.success ? styles.emailResultSuccess : styles.emailResultError,
                  ]}
                >
                  <Text
                    style={
                      serviceAreaResult.success
                        ? styles.emailResultSuccessText
                        : styles.emailResultErrorText
                    }
                  >
                    {serviceAreaResult.success ? serviceAreaResult.message : serviceAreaResult.error}
                  </Text>
                </View>
              )}

              {/* Info Note */}
              <View style={styles.serviceAreaNote}>
                <Feather name="info" size={14} color={colors.primary[500]} />
                <Text style={styles.serviceAreaNoteText}>
                  When a homeowner books a last-minute cleaning near you, you'll receive a push notification,
                  email, and in-app alert so you can respond quickly.
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Password Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <Text style={styles.sectionDescription}>
          For security, you must enter your current password to set a new one.
        </Text>

        <Text style={styles.label}>Current Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
          >
            <Feather
              name={showCurrentPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
          >
            <Feather
              name={showNewPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Feather
              name={showConfirmPassword ? "eye-off" : "eye"}
              size={20}
              color={colors.text.secondary}
            />
          </Pressable>
        </View>

        <Pressable
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleUpdatePassword}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? "Updating..." : "Update Password"}
          </Text>
        </Pressable>
      </View>

      {/* Owner Notification Email Settings - Only visible to owners */}
      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Email</Text>
          <Text style={styles.sectionDescription}>
            Set a separate email address to receive owner notifications (new applications, home size disputes, etc.).
            Leave blank to use your main account email.
          </Text>

          {loadingOwnerSettings ? (
            <ActivityIndicator size="small" color={colors.primary[600]} />
          ) : (
            <>
              <View style={styles.currentEmailBox}>
                <Text style={styles.currentEmailLabel}>Currently sending to:</Text>
                <Text style={styles.currentEmailValue}>
                  {ownerSettings?.effectiveNotificationEmail || ownerSettings?.email || "Not set"}
                </Text>
              </View>

              <View style={styles.emailInputRow}>
                <TextInput
                  style={styles.notificationEmailInput}
                  placeholder="notification@example.com"
                  placeholderTextColor={colors.text.tertiary}
                  value={notificationEmailInput}
                  onChangeText={setNotificationEmailInput}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {notificationEmailInput !== (ownerSettings?.notificationEmail || "") && (
                  <Pressable
                    style={[styles.saveEmailBtn, savingEmail && styles.buttonDisabled]}
                    onPress={handleSaveNotificationEmail}
                    disabled={savingEmail}
                  >
                    {savingEmail ? (
                      <ActivityIndicator size="small" color={colors.neutral[0]} />
                    ) : (
                      <Text style={styles.saveEmailBtnText}>Save</Text>
                    )}
                  </Pressable>
                )}
              </View>

              {ownerSettings?.notificationEmail && (
                <Pressable
                  style={styles.clearEmailLink}
                  onPress={handleClearNotificationEmail}
                  disabled={savingEmail}
                >
                  <Text style={styles.clearEmailLinkText}>
                    Clear and use main email ({ownerSettings?.email})
                  </Text>
                </Pressable>
              )}

              {emailSaveResult && (
                <View style={[
                  styles.emailResultBox,
                  emailSaveResult.success ? styles.emailResultSuccess : styles.emailResultError,
                ]}>
                  <Text style={emailSaveResult.success ? styles.emailResultSuccessText : styles.emailResultErrorText}>
                    {emailSaveResult.success ? emailSaveResult.message : emailSaveResult.error}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      {/* Security Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Security Tips</Text>
        <View style={styles.tipRow}>
          <Feather name="shield" size={16} color={colors.primary[500]} />
          <Text style={styles.tipText}>Use a unique password you don't use elsewhere</Text>
        </View>
        <View style={styles.tipRow}>
          <Feather name="lock" size={16} color={colors.primary[500]} />
          <Text style={styles.tipText}>Include numbers and special characters</Text>
        </View>
        <View style={styles.tipRow}>
          <Feather name="key" size={16} color={colors.primary[500]} />
          <Text style={styles.tipText}>Make it at least 8 characters long</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.xl,
    paddingBottom: spacing["4xl"],
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },

  // Success/Error Messages
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  successText: {
    color: colors.success[700],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },

  // Section
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },

  // Form Elements
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  passwordInput: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: spacing.md,
  },

  // Buttons
  button: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
  },
  primaryButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Tips Section
  tipsSection: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  tipsTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
    marginBottom: spacing.md,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
  },

  // Notification Email Styles (for owners)
  currentEmailBox: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  currentEmailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  currentEmailValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  emailInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  notificationEmailInput: {
    flex: 1,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  saveEmailBtn: {
    backgroundColor: colors.primary[600],
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 70,
  },
  saveEmailBtnText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  clearEmailLink: {
    paddingVertical: spacing.sm,
  },
  clearEmailLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textDecorationLine: "underline",
  },
  emailResultBox: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  emailResultSuccess: {
    backgroundColor: colors.success[50],
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  emailResultError: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  emailResultSuccessText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  emailResultErrorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[700],
  },

  // Service Area Styles (for cleaners)
  locationButton: {
    backgroundColor: colors.success[600],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  orDivider: {
    textAlign: "center",
    color: colors.text.tertiary,
    fontSize: typography.fontSize.sm,
    marginVertical: spacing.md,
  },
  radiusInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  radiusInput: {
    flex: 1,
    maxWidth: 100,
  },
  radiusLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  serviceAreaNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  serviceAreaNoteText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
});

export default AccountSettings;
