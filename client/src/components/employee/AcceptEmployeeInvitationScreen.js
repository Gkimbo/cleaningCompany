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
import BusinessEmployeeService from "../../services/fetchRequests/BusinessEmployeeService";
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

const AcceptEmployeeInvitationScreen = ({ inviteToken: propToken }) => {
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Terms acceptance
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsId, setTermsId] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyId, setPrivacyId] = useState(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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
      const result = await BusinessEmployeeService.validateInvite(inviteToken);

      if (result.valid) {
        setInvitation(result.invitation);
        // Pre-populate fields from invitation if available
        if (result.invitation?.firstName) {
          setFirstName(result.invitation.firstName);
        }
        if (result.invitation?.lastName) {
          setLastName(result.invitation.lastName);
        }
        if (result.invitation?.phone) {
          setPhone(formatPhoneNumber(result.invitation.phone));
        }
        setState(STATES.DETAILS);
      } else if (result.isAlreadyAccepted) {
        setInvitationEmail(result.email || result.invitation?.email || "");
        setState(STATES.ALREADY_ACCEPTED);
      } else if (result.isExpired) {
        setError("This invitation has expired. Please contact your employer to request a new invitation.");
        setState(STATES.ERROR);
      } else if (result.isTerminated) {
        setError("This invitation is no longer valid. Please contact your employer.");
        setState(STATES.ERROR);
      } else {
        setError(result.error || "Invalid invitation link. Please contact your employer.");
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

    if (!firstName.trim()) {
      errors.push("First name is required.");
    }

    if (!lastName.trim()) {
      errors.push("Last name is required.");
    }

    if (!username.trim()) {
      errors.push("Username is required.");
    } else if (username.length < 4 || username.length > 12) {
      errors.push("Username must be between 4 and 12 characters.");
    }

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
      const result = await BusinessEmployeeService.acceptInviteWithSignup(inviteToken, {
        firstName,
        lastName,
        username,
        password,
        phone: phone.replace(/\D/g, ""),
        termsId,
        privacyPolicyId: privacyId,
      });

      if (result.success) {
        // Auto-login with the returned token
        if (result.token) {
          await login(result.token);
        }
        setState(STATES.SUCCESS);

        // Navigate to employee dashboard
        setTimeout(() => {
          navigate("/employee/dashboard");
        }, 1500);
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
      "Are you sure you want to decline this job invitation? You can always ask for a new one later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            try {
              await BusinessEmployeeService.declineInvite(inviteToken);
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
        invitationType="employee"
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
          <Text style={styles.successTitle}>Welcome to the Team!</Text>
          <Text style={styles.successMessage}>
            Your account has been created successfully.
          </Text>
          <Text style={styles.successSubtext}>Redirecting to your dashboard...</Text>
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
        <Text style={styles.headerTitle}>Join Team</Text>
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
              {invitation.businessLogo ? (
                <Image
                  source={{ uri: invitation.businessLogo }}
                  style={styles.inviterLogo}
                />
              ) : (
                <View style={styles.inviterAvatar}>
                  <Feather name="briefcase" size={24} color={colors.primary[600]} />
                </View>
              )}
              <View style={styles.inviterInfo}>
                <Text style={styles.inviterLabel}>Employer</Text>
                <Text style={styles.inviterName}>
                  {invitation.businessName || invitation.ownerName || "Your Employer"}
                </Text>
              </View>
            </View>

            {invitation.position && (
              <View style={styles.positionSection}>
                <Feather name="user-check" size={18} color={colors.text.secondary} />
                <Text style={styles.positionText}>Position: {invitation.position}</Text>
              </View>
            )}

            {invitation.email && (
              <View style={styles.emailSection}>
                <Text style={styles.emailLabel}>Invitation sent to</Text>
                <Text style={styles.emailValue}>{invitation.email}</Text>
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

        {/* Name Section */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Your Information</Text>

          <View style={styles.nameRow}>
            <TextInput
              mode="outlined"
              label="First Name *"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              style={[styles.input, styles.nameInput]}
              autoCapitalize="words"
            />
            <TextInput
              mode="outlined"
              label="Last Name *"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              style={[styles.input, styles.nameInput]}
              autoCapitalize="words"
            />
          </View>

          <TextInput
            mode="outlined"
            label="Username *"
            value={username}
            onChangeText={setUsername}
            placeholder="Choose a username (4-12 characters)"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <Text style={styles.inputHint}>4-12 characters, used to sign in</Text>
        </View>

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
            Your employer may use this to contact you about work.
          </Text>
        </View>

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
              <Text style={styles.acceptButtonText}>Join Team</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Terms Modal */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={handleTermsAccepted}
        type="employee"
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
  positionSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  positionText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  emailSection: {
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  emailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginBottom: 2,
  },
  emailValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
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
  nameRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  nameInput: {
    flex: 1,
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

export default AcceptEmployeeInvitationScreen;
