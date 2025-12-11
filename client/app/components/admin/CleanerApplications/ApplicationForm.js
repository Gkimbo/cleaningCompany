import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Application from "../../../services/fetchRequests/ApplicationClass";
import ApplicationFormStyles from "../../../services/styles/ApplicationFormStyles";

const CleanerApplicationForm = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    experience: "",
    message: "",
    idPhoto: null,
    backgroundConsent: false,
  });
console.log(formData)
  const [formError, setFormError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const styles = ApplicationFormStyles;

  const handleChange = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle ID upload
  const handleIdUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(
        "Permission required",
        "We need access to your photo library to upload your ID."
      );
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!pickerResult.canceled && pickerResult.assets?.length > 0) {
      setFormData((prev) => ({
        ...prev,
        idPhoto: pickerResult.assets[0].uri,
      }));
    }
  };

  // Form validation
  const validate = () => {
    const errors = [];
    const {
      firstName,
      lastName,
      email,
      phone,
      experience,
      idPhoto,
      backgroundConsent,
    } = formData;

    if (!firstName || !lastName || !email || !phone || !experience) {
      errors.push("All required fields must be filled out.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push("Please enter a valid email address.");
    }

    if (!idPhoto) {
      errors.push("Please upload a valid photo ID.");
    }

    if (!backgroundConsent) {
      errors.push("You must consent to a background check.");
    }

    setFormError(errors);
    return errors.length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const submittedApplication = await Application.addApplicationToDb(formData);
      console.log("Form submitted:", submittedApplication);
      setSubmitted(true);
      Alert.alert(
        "Thank You",
        "Your application has been submitted successfully. We’ll review your information and get back to you soon."
      );
    } catch (error) {
      Alert.alert("Error", "Something went wrong while submitting the form.");
      console.error(error);
    }
  };

  // Thank You Screen
  if (submitted) {
    return (
      <View style={styles.thankYouContainer}>
        <Text style={styles.thankYouTitle}>Thank You for Applying!</Text>
        <Text style={styles.thankYouMessage}>
          Your application has been submitted successfully. We’ll review your
          information and get back to you shortly.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cleaner Job Application</Text>
      <Text style={styles.description}>
        Please fill out this form to apply for a cleaning position. For safety
        and trust, all applicants must verify their identity and consent to a
        background check.
      </Text>

      {/* Full Name */}
      <Text style={styles.label}>First Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your first name"
        value={formData.firstName}
        onChangeText={(text) => handleChange("firstName", text)}
      />

      <Text style={styles.label}>Last Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your last name"
        value={formData.lastName}
        onChangeText={(text) => handleChange("lastName", text)}
      />

      {/* Email */}
      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={formData.email}
        onChangeText={(text) => handleChange("email", text)}
        keyboardType="email-address"
      />

      {/* Phone */}
      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your phone number"
        value={formData.phone}
        onChangeText={(text) => handleChange("phone", text)}
        keyboardType="phone-pad"
      />

      {/* Experience */}
      <Text style={styles.label}>Experience</Text>
      <TextInput
        style={styles.input}
        placeholder="E.g., 2 years in residential cleaning"
        value={formData.experience}
        onChangeText={(text) => handleChange("experience", text)}
      />

      {/* Upload ID */}
      <Text style={styles.label}>Upload a Valid Photo ID</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={handleIdUpload}>
        <Text style={styles.uploadButtonText}>
          {formData.idPhoto ? "Change ID Photo" : "Select ID Photo"}
        </Text>
      </TouchableOpacity>

      {formData.idPhoto && (
        <Image
          source={{ uri: formData.idPhoto }}
          style={styles.idPreview}
          resizeMode="contain"
        />
      )}

      {/* Consent to background check */}
      <TouchableOpacity
        style={styles.checkboxContainer}
        onPress={() =>
          handleChange("backgroundConsent", !formData.backgroundConsent)
        }
      >
        <View
          style={[
            styles.checkbox,
            formData.backgroundConsent && styles.checkboxChecked,
          ]}
        />
        <Text style={styles.checkboxLabel}>
          I consent to a background check and identity verification.
        </Text>
      </TouchableOpacity>

      {/* Message */}
      <Text style={styles.label}>Why Do You Want to Work With Us?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Tell us a bit about yourself and why you want to join our team."
        value={formData.message}
        onChangeText={(text) => handleChange("message", text)}
        multiline
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Submit Application</Text>
      </TouchableOpacity>

      {/* Validation Errors */}
      {formError && (
        <View style={styles.errorContainer}>
          {formError.map((error, index) => (
            <Text key={index} style={styles.errorText}>
              {error}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

export default CleanerApplicationForm;
