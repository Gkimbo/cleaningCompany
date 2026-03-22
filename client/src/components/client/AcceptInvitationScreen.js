import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from "react-native";
import { TextInput, Checkbox } from "react-native-paper";
import { useNavigate, useParams } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { AuthContext } from "../../services/AuthContext";
import CleanerClientService from "../../services/fetchRequests/CleanerClientService";
import { TermsModal } from "../terms";
import AlreadyAcceptedCard from "../shared/AlreadyAcceptedCard";
import {
  colors,
  spacing,
  radius,
  typography,
} from "../../services/styles/theme";

const STATES = {
  LOADING: "loading",
  DETAILS: "details",
  SUBMITTING: "submitting",
  SUCCESS: "success",
  ERROR: "error",
  ALREADY_ACCEPTED: "already_accepted",
};

const AcceptInvitationScreen = ({ inviteToken: propToken }) => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  // Support both Expo Router (prop) and react-router-native (useParams)
  const params = useParams();
  const inviteToken = propToken || params?.token;

  const [state, setState] = useState(STATES.LOADING);
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState(null);
  const [invitationEmail, setInvitationEmail] = useState("");

  // Form fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAddressCorrection, setShowAddressCorrection] = useState(false);
  const [addressCorrections, setAddressCorrections] = useState("");

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsId, setTermsId] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyId, setPrivacyId] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [paymentTermsAccepted, setPaymentTermsAccepted] = useState(false);
  const [paymentTermsId, setPaymentTermsId] = useState(null);
  const [showPaymentTermsModal, setShowPaymentTermsModal] = useState(false);
  const [damageProtectionAccepted, setDamageProtectionAccepted] = useState(false);
  const [damageProtectionId, setDamageProtectionId] = useState(null);
  const [showDamageProtectionModal, setShowDamageProtectionModal] = useState(false);

  const [formErrors, setFormErrors] = useState([]);

  // Validate token on mount
  useEffect(() => {
    validateToken();
  }, [inviteToken]);

  const validateToken = async () => {
    if (!inviteToken) {
      setError("No invitation token provided");
      setState(STATES.ERROR);
      return;
    }

    try {
      const result = await CleanerClientService.validateInvitation(inviteToken);

      if (result.valid) {
        setInvitation(result);
        // Pre-populate phone if provided
        if (result.client?.phone) {
          setPhone(formatPhoneNumber(result.client.phone));
        }
        setState(STATES.DETAILS);
      } else if (result.alreadyAccepted) {
        setInvitationEmail(result.email || result.client?.email || "");
        setState(STATES.ALREADY_ACCEPTED);
      } else if (result.expired) {
        setError("This invitation has expired. Please contact your cleaning service to request a new invitation.");
        setState(STATES.ERROR);
      } else {
        setError(result.error || "Invalid invitation link. Please contact your cleaning service.");
        setState(STATES.ERROR);
      }
    } catch (err) {
      console.error("Error validating invitation:", err);
      setError("Failed to validate invitation. Please check your connection and try again.");
      setState(STATES.ERROR);
    }
  };

  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const validateForm = () => {
    const errors = [];

    // Password validation
    const uppercaseCount = (password.match(/[A-Z]/g) || []).length;
    const lowercaseCount = (password.match(/[a-z]/g) || []).length;
    const specialCharCount = (
      password.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []
    ).length;

    if (
      password.length < 8 ||
      uppercaseCount < 2 ||
      lowercaseCount < 2 ||
      specialCharCount < 2
    ) {
      errors.push(
        "Password must be at least 8 characters with 2 uppercase, 2 lowercase, and 2 special characters."
      );
    }

    if (password !== confirmPassword) {
      errors.push("Passwords do not match.");
    }

    // Phone validation (optional but if provided should be valid)
    const phoneDigits = phone.replace(/\D/g, "");
    if (phone && phoneDigits.length < 10) {
      errors.push("Please enter a valid phone number.");
    }

    if (!termsAccepted) {
      errors.push("You must accept the Terms and Conditions.");
    }

    if (!privacyAccepted) {
      errors.push("You must accept the Privacy Policy.");
    }

    if (!paymentTermsAccepted) {
      errors.push("You must accept the Payment Terms.");
    }

    if (!damageProtectionAccepted) {
      errors.push("You must accept the Damage Protection Policy.");
    }

    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleAccept = async () => {
    if (!validateForm()) {
      return;
    }

    setState(STATES.SUBMITTING);
    setFormErrors([]);

    try {
      const result = await CleanerClientService.acceptInvitation(inviteToken, {
        password,
        phone: phone.replace(/\D/g, ""),
        addressCorrections: showAddressCorrection ? addressCorrections : null,
        termsId,
        privacyPolicyId: privacyId,
        paymentTermsId,
        damageProtectionId,
      });

      if (result.success) {
        // Auto-login with the returned token
        if (result.token) {
          await login(result.token);
        }
        setState(STATES.SUCCESS);

        // Navigate to home setup if a home ID is returned
        if (result.homeId) {
          setTimeout(() => {
            navigate(`/complete-home-setup/${result.homeId}`);
          }, 1500);
        } else {
          setTimeout(() => {
            navigate("/");
          }, 1500);
        }
      } else {
        setFormErrors([result.error || "Failed to accept invitation. Please try again."]);
        setState(STATES.DETAILS);
      }
    } catch (err) {
      console.error("Error accepting invitation:", err);
      setFormErrors(["An error occurred. Please try again."]);
      setState(STATES.DETAILS);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      "Decline Invitation",
      "Are you sure you want to decline this invitation? You can always ask for a new one later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            try {
              await CleanerClientService.declineInvitation(inviteToken);
              Alert.alert(
                "Invitation Declined",
                "The invitation has been declined.",
                [{ text: "OK", onPress: () => navigate("/") }]
              );
            } catch (err) {
              Alert.alert("Error", "Failed to decline invitation.");
            }
          },
        },
      ]
    );
  };

  const handleTermsAccepted = (acceptedTermsId) => {
    setTermsId(acceptedTermsId);
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const handlePrivacyAccepted = (acceptedPrivacyId) => {
    setPrivacyId(acceptedPrivacyId);
    setPrivacyAccepted(true);
    setShowPrivacyModal(false);
  };

  const handlePaymentTermsAccepted = (acceptedPaymentTermsId) => {
    setPaymentTermsId(acceptedPaymentTermsId);
    setPaymentTermsAccepted(true);
    setShowPaymentTermsModal(false);
  };

  const handleDamageProtectionAccepted = (acceptedDamageProtectionId) => {
    setDamageProtectionId(acceptedDamageProtectionId);
    setDamageProtectionAccepted(true);
    setShowDamageProtectionModal(false);
  };

  // Loading state
  if (state === STATES.LOADING) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Validating invitation...</Text>
      </View>
    );
  }

  // Error state
  if (state === STATES.ERROR) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorCard}>
          <Feather name="alert-circle" size={48} color={colors.error[600]} />
          <Text style={styles.errorTitle}>Invalid Invitation</Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={validateToken}
          >
            <Feather name="refresh-cw" size={18} color={colors.primary[600]} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigate("/sign-in")}
          >
            <Text style={styles.loginLinkText}>Already have an account? Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Already accepted state - show recovery options
  if (state === STATES.ALREADY_ACCEPTED) {
    return (
      <AlreadyAcceptedCard
        email={invitationEmail}
        onSignIn={() => navigate("/sign-in")}
        onClose={() => navigate("/")}
        invitationType="client"
      />
    );
  }

  // Success state
  if (state === STATES.SUCCESS) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Feather name="check" size={48} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Welcome!</Text>
          <Text style={styles.successMessage}>
            Your account has been created successfully.
          </Text>
          <Text style={styles.successSubtext}>Redirecting you to set up your home...</Text>
        </View>
      </View>
    );
  }

  // Details / Form state
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigate("/")} style={styles.backButton}>
          <Feather name="x" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accept Invitation</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Invitation Info Card */}
        {invitation && (
          <View style={styles.invitationCard}>
            <View style={styles.inviterSection}>
              {invitation.cleaner?.businessLogo ? (
                <Image
                  source={{ uri: invitation.cleaner.businessLogo }}
                  style={styles.inviterLogo}
                />
              ) : (
                <View style={styles.inviterAvatar}>
                  <Feather name="user" size={24} color={colors.primary[600]} />
                </View>
              )}
              <View style={styles.inviterInfo}>
                <Text style={styles.inviterLabel}>Invited by</Text>
                <Text style={styles.inviterName}>
                  {invitation.cleaner?.businessName || invitation.cleanerName || "Your Cleaning Service"}
                </Text>
              </View>
            </View>

            {invitation.home && (
              <View style={styles.homeSection}>
                <Feather name="home" size={18} color={colors.text.secondary} />
                <View style={styles.homeInfo}>
                  <Text style={styles.homeAddress}>{invitation.home.address}</Text>
                  <Text style={styles.homeDetails}>
                    {invitation.home.city}, {invitation.home.state} {invitation.home.zipcode}
                  </Text>
                  {(invitation.home.numBeds || invitation.home.numBaths) && (
                    <Text style={styles.homeDetails}>
                      {invitation.home.numBeds} bed, {invitation.home.numBaths} bath
                    </Text>
                  )}
                </View>
              </View>
            )}

            {invitation.client && (
              <View style={styles.clientSection}>
                <Text style={styles.clientName}>
                  {invitation.client.firstName} {invitation.client.lastName}
                </Text>
                <Text style={styles.clientEmail}>{invitation.client.email}</Text>
              </View>
            )}
          </View>
        )}

        {/* Form Errors */}
        {formErrors.length > 0 && (
          <View style={styles.errorContainer}>
            {formErrors.map((err, index) => (
              <Text key={index} style={styles.formErrorText}>{err}</Text>
            ))}
          </View>
        )}

        {/* Password Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Create Your Password</Text>

          <TextInput
            mode="outlined"
            label="Password *"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            autoComplete="new-password"
            textContentType="oneTimeCode"
            autoCorrect={false}
            spellCheck={false}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={styles.input}
          />

          <TextInput
            mode="outlined"
            label="Confirm Password *"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm your password"
            autoComplete="new-password"
            textContentType="oneTimeCode"
            autoCorrect={false}
            spellCheck={false}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? "eye-off" : "eye"}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            }
            style={styles.input}
          />

          <Text style={styles.passwordHint}>
            Password must be at least 8 characters with 2 uppercase, 2 lowercase, and 2 special characters.
          </Text>
        </View>

        {/* Phone Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <TextInput
            mode="outlined"
            label="Phone Number"
            value={phone}
            onChangeText={(text) => setPhone(formatPhoneNumber(text))}
            placeholder="555-123-4567"
            keyboardType="phone-pad"
            maxLength={12}
            style={styles.input}
          />
          <Text style={styles.inputHint}>
            We'll use this to contact you about your cleanings.
          </Text>
        </View>

        {/* Address Correction Toggle */}
        {invitation?.home && (
          <View style={styles.formSection}>
            <TouchableOpacity
              style={[styles.toggleCard, showAddressCorrection && styles.toggleCardActive]}
              onPress={() => setShowAddressCorrection(!showAddressCorrection)}
            >
              <View style={styles.toggleContent}>
                <Text style={styles.toggleTitle}>Address Needs Correction?</Text>
                <Text style={styles.toggleDescription}>
                  Let us know if any address details are incorrect.
                </Text>
              </View>
              <View style={[styles.toggleSwitch, showAddressCorrection && styles.toggleSwitchActive]}>
                <View style={[styles.toggleKnob, showAddressCorrection && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>

            {showAddressCorrection && (
              <TextInput
                mode="outlined"
                label="Address Corrections"
                value={addressCorrections}
                onChangeText={setAddressCorrections}
                placeholder="Please describe any corrections needed..."
                multiline
                numberOfLines={3}
                style={[styles.input, { marginTop: spacing.sm }]}
              />
            )}
          </View>
        )}

        {/* Terms and Privacy */}
        <View style={styles.formSection}>
          <View style={styles.termsRow}>
            <Checkbox
              status={termsAccepted ? "checked" : "unchecked"}
              onPress={() => {
                if (!termsAccepted) {
                  setShowTermsModal(true);
                } else {
                  setTermsAccepted(false);
                  setTermsId(null);
                }
              }}
              color={colors.primary[600]}
            />
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => setShowTermsModal(true)}
                >
                  Terms and Conditions
                </Text>
                {" *"}
              </Text>
            </View>
          </View>
          {termsAccepted && (
            <Text style={styles.acceptedText}>Terms accepted</Text>
          )}

          <View style={[styles.termsRow, { marginTop: spacing.sm }]}>
            <Checkbox
              status={privacyAccepted ? "checked" : "unchecked"}
              onPress={() => {
                if (!privacyAccepted) {
                  setShowPrivacyModal(true);
                } else {
                  setPrivacyAccepted(false);
                  setPrivacyId(null);
                }
              }}
              color={colors.primary[600]}
            />
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => setShowPrivacyModal(true)}
                >
                  Privacy Policy
                </Text>
                {" *"}
              </Text>
            </View>
          </View>
          {privacyAccepted && (
            <Text style={styles.acceptedText}>Privacy Policy accepted</Text>
          )}

          <View style={[styles.termsRow, { marginTop: spacing.sm }]}>
            <Checkbox
              status={paymentTermsAccepted ? "checked" : "unchecked"}
              onPress={() => {
                if (!paymentTermsAccepted) {
                  setShowPaymentTermsModal(true);
                } else {
                  setPaymentTermsAccepted(false);
                  setPaymentTermsId(null);
                }
              }}
              color={colors.primary[600]}
            />
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => setShowPaymentTermsModal(true)}
                >
                  Payment Terms
                </Text>
                {" *"}
              </Text>
            </View>
          </View>
          {paymentTermsAccepted && (
            <Text style={styles.acceptedText}>Payment Terms accepted</Text>
          )}

          <View style={[styles.termsRow, { marginTop: spacing.sm }]}>
            <Checkbox
              status={damageProtectionAccepted ? "checked" : "unchecked"}
              onPress={() => {
                if (!damageProtectionAccepted) {
                  setShowDamageProtectionModal(true);
                } else {
                  setDamageProtectionAccepted(false);
                  setDamageProtectionId(null);
                }
              }}
              color={colors.primary[600]}
            />
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                I agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => setShowDamageProtectionModal(true)}
                >
                  Damage Protection Policy
                </Text>
                {" *"}
              </Text>
            </View>
          </View>
          {damageProtectionAccepted && (
            <Text style={styles.acceptedText}>Damage Protection Policy accepted</Text>
          )}
        </View>

        {/* Decline Link */}
        <TouchableOpacity
          style={styles.declineLink}
          onPress={handleDecline}
        >
          <Text style={styles.declineLinkText}>Decline Invitation</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer with Accept Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptButton, state === STATES.SUBMITTING && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={state === STATES.SUBMITTING}
        >
          {state === STATES.SUBMITTING ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.acceptButtonText}>Accept Invitation</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Terms Modal */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={handleTermsAccepted}
        type="homeowner"
        required={true}
        title="Terms and Conditions"
      />

      {/* Privacy Policy Modal */}
      <TermsModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={handlePrivacyAccepted}
        type="privacy_policy"
        required={true}
        title="Privacy Policy"
      />

      {/* Payment Terms Modal */}
      <TermsModal
        visible={showPaymentTermsModal}
        onClose={() => setShowPaymentTermsModal(false)}
        onAccept={handlePaymentTermsAccepted}
        type="payment_terms"
        required={true}
        title="Payment Terms"
      />

      {/* Damage Protection Policy Modal */}
      <TermsModal
        visible={showDamageProtectionModal}
        onClose={() => setShowDamageProtectionModal(false)}
        onAccept={handleDamageProtectionAccepted}
        type="damage_protection"
        required={true}
        title="Damage Protection Policy"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl + 20,
    paddingBottom: spacing.md,
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  // Error card
  errorCard: {
    backgroundColor: colors.neutral[0],
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  errorTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[600],
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  loginLink: {
    marginTop: spacing.lg,
  },
  loginLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    textDecorationLine: "underline",
  },
  // Success card
  successCard: {
    backgroundColor: colors.neutral[0],
    padding: spacing.xl,
    borderRadius: radius.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success?.[600] || "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.lg,
  },
  successMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  successSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  // Invitation card
  invitationCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inviterSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  inviterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
  },
  inviterLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  inviterInfo: {
    marginLeft: spacing.md,
  },
  inviterLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inviterName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  homeSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  homeInfo: {
    flex: 1,
  },
  homeAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  homeDetails: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  clientSection: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  clientEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginTop: 2,
  },
  // Form sections
  formSection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.neutral[0],
    marginBottom: spacing.sm,
  },
  passwordHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  inputHint: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  // Toggle card
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  toggleCardActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  toggleDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.neutral[300],
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: colors.primary[600],
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.neutral[0],
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  // Terms
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  termsTextContainer: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  termsText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  termsLink: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
    textDecorationLine: "underline",
  },
  acceptedText: {
    fontSize: typography.fontSize.xs,
    color: colors.success?.[600] || "#16a34a",
    marginLeft: 36,
    marginTop: spacing.xs,
  },
  // Errors
  errorContainer: {
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  formErrorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
    marginBottom: spacing.xs,
  },
  // Decline link
  declineLink: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  declineLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textDecorationLine: "underline",
  },
  // Footer
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  acceptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
});

export default AcceptInvitationScreen;
