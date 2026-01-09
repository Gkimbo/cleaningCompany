import React, { useState, useEffect, useContext } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  TextInput,
  StyleSheet,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";

import FetchData from "../../../services/fetchRequests/fetchData";
import { AuthContext } from "../../../services/AuthContext";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";

// Generate a strong random password
const generateStrongPassword = (length = 16) => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O to avoid confusion
  const lowercase = "abcdefghjkmnpqrstuvwxyz"; // Removed i, l, o to avoid confusion
  const numbers = "23456789"; // Removed 0, 1 to avoid confusion
  const special = "!@#$%&*?";

  // Ensure at least one of each type
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining length with random characters from all sets
  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

const AddEmployeeForm = ({ employeeList, setEmployeeList }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [redirect, setRedirect] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const type = "cleaner";

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
  };

  const validate = () => {
    const validationErrors = [];

    if (firstName.trim().length === 0) {
      validationErrors.push("First name is required.");
    }

    if (lastName.trim().length === 0) {
      validationErrors.push("Last name is required.");
    }

    if (userName.length < 4 || userName.length > 12) {
      validationErrors.push("Username must be between 4 and 12 characters.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      validationErrors.push("Please enter a valid email address.");
    }

    if (password.length < 6) {
      validationErrors.push("Password must be at least 6 characters.");
    }

    if (password !== confirmPassword) {
      validationErrors.push("Passwords do not match.");
    }

    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        firstName,
        lastName,
        userName,
        password,
        email,
        type,
      };
      const response = await FetchData.makeNewEmployee(data);
      if (
        response === "An account already has this email" ||
        response === "Username already exists"
      ) {
        setErrors([response]);
      } else {
        setEmployeeList([...employeeList, response.user]);
        setFirstName("");
        setLastName("");
        setUserName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setErrors([]);
      }
    } catch (error) {
      setErrors(["Failed to create employee. Please try again."]);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (redirect) {
      navigate("/employees");
    }
  }, [redirect]);

  return (
    <View style={styles.container}>
      {errors.length > 0 && (
        <View style={styles.errorContainer}>
          {errors.map((error, index) => (
            <Text key={index} style={styles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.nameRow}>
        <View style={styles.nameInputContainer}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor={colors.text.tertiary}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />
        </View>
        <View style={styles.nameInputContainer}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor={colors.text.tertiary}
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter username (4-12 characters)"
          placeholderTextColor={colors.text.tertiary}
          value={userName}
          onChangeText={setUserName}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <View style={styles.passwordLabelRow}>
          <Text style={styles.inputLabel}>Password</Text>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGeneratePassword}
          >
            <Icon name="refresh" size={14} color={colors.primary[600]} />
            <Text style={styles.generateButtonText}>Auto-generate</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password (min 6 characters)"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="oneTimeCode"
            autoComplete="off"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Icon
              name={showPassword ? "eye-slash" : "eye"}
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor={colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            textContentType="oneTimeCode"
            autoComplete="off"
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Icon
              name={showConfirmPassword ? "eye-slash" : "eye"}
              size={18}
              color={colors.text.tertiary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter email address"
          placeholderTextColor={colors.text.tertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? "Adding..." : "Add Employee"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  errorContainer: {
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  errorText: {
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  nameInputContainer: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.xs,
  },
  generateButtonText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  input: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.lg,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  eyeButton: {
    padding: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadows.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.primary[300],
  },
  submitButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
});

export default AddEmployeeForm;
