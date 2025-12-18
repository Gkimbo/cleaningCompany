import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { TextInput } from "react-native-paper";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";

import FetchData from "../../services/fetchRequests/fetchData";
import LandingPageStyles from "../../services/styles/LandingPageStyle";
import formStyles from "../../services/styles/FormStyle";

const ForgotCredentials = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState(null); // null, 'username', or 'password'
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successMessage, setSuccessMessage] = useState("");

  const validateEmail = () => {
    const validationErrors = [];
    if (!email) {
      validationErrors.push("Please enter your email address");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      validationErrors.push("Please enter a valid email address");
    }
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleForgotUsername = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    setErrors([]);
    setSuccessMessage("");

    try {
      const response = await FetchData.forgotUsername(email);
      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage(response.message);
        setEmail("");
      }
    } catch (error) {
      setErrors(["Something went wrong. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    setErrors([]);
    setSuccessMessage("");

    try {
      const response = await FetchData.forgotPassword(email);
      if (response.error) {
        setErrors([response.error]);
      } else {
        setSuccessMessage(response.message);
        setEmail("");
      }
    } catch (error) {
      setErrors(["Something went wrong. Please try again."]);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (mode) {
      setMode(null);
      setErrors([]);
      setSuccessMessage("");
      setEmail("");
    } else {
      navigate("/sign-in");
    }
  };

  const renderModeSelection = () => (
    <View>
      <Text style={formStyles.subtitle}>What do you need help with?</Text>

      <Pressable
        style={formStyles.button}
        onPress={() => setMode("username")}
      >
        <Text style={formStyles.buttonText}>I forgot my username</Text>
      </Pressable>

      <Pressable
        style={[formStyles.button, { marginTop: 12 }]}
        onPress={() => setMode("password")}
      >
        <Text style={formStyles.buttonText}>I forgot my password</Text>
      </Pressable>
    </View>
  );

  const renderUsernameRecovery = () => (
    <View>
      <Text style={formStyles.subtitle}>
        Enter your email address and we'll send you your username.
      </Text>

      {successMessage !== "" && (
        <Text style={formStyles.success}>{successMessage}</Text>
      )}

      {errors.length > 0 && (
        <View style={formStyles.errorContainer}>
          {errors.map((error, index) => (
            <Text key={index} style={formStyles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}

      <TextInput
        mode="outlined"
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={formStyles.input}
      />

      <Pressable
        style={[formStyles.button, loading && formStyles.buttonDisabled]}
        onPress={handleForgotUsername}
        disabled={loading}
      >
        <Text style={formStyles.buttonText}>
          {loading ? "Sending..." : "Send Username"}
        </Text>
      </Pressable>
    </View>
  );

  const renderPasswordRecovery = () => (
    <View>
      <Text style={formStyles.subtitle}>
        Enter your email address and we'll send you a temporary password.
      </Text>

      {successMessage !== "" && (
        <Text style={formStyles.success}>{successMessage}</Text>
      )}

      {errors.length > 0 && (
        <View style={formStyles.errorContainer}>
          {errors.map((error, index) => (
            <Text key={index} style={formStyles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}

      <TextInput
        mode="outlined"
        label="Email Address"
        value={email}
        onChangeText={setEmail}
        placeholder="Enter your email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        style={formStyles.input}
      />

      <Pressable
        style={[formStyles.button, loading && formStyles.buttonDisabled]}
        onPress={handleForgotPassword}
        disabled={loading}
      >
        <Text style={formStyles.buttonText}>
          {loading ? "Sending..." : "Reset Password"}
        </Text>
      </Pressable>
    </View>
  );

  const getTitle = () => {
    if (mode === "username") return "Recover Username";
    if (mode === "password") return "Reset Password";
    return "Account Recovery";
  };

  return (
    <KeyboardAvoidingView
      style={LandingPageStyles.authContainer}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={LandingPageStyles.authScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animatable.View
          style={LandingPageStyles.authCard}
          animation="fadeInUp"
          duration={600}
        >
          <Text style={LandingPageStyles.authTitle}>{getTitle()}</Text>

          {mode === null && renderModeSelection()}
          {mode === "username" && renderUsernameRecovery()}
          {mode === "password" && renderPasswordRecovery()}

          <View style={LandingPageStyles.authFooter}>
            <Pressable onPress={handleBack}>
              <View style={LandingPageStyles.authLinkButton}>
                <Icon
                  name="arrow-left"
                  size={14}
                  color="#0d9488"
                  style={{ marginRight: 6 }}
                />
                <Text style={LandingPageStyles.authLinkText}>
                  {mode ? "Back" : "Back to Sign In"}
                </Text>
              </View>
            </Pressable>
          </View>
        </Animatable.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default ForgotCredentials;
