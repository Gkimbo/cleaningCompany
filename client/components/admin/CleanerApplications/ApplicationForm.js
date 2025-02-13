import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
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
    availability: "",
    message: "",
  });
  const [formError, setFormError] = useState(null)
  const [submitted, setSubmitted] = useState(false);
  const styles = ApplicationFormStyles

  const handleChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const validate = () => {
		const validationErrors = [];
		if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.experience || !formData.availability) {
			validationErrors.push("All Fields must be filled out!");
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(formData.email)) {
			validationErrors.push("Please enter a valid email address.");
		}

		setFormError(validationErrors);
		return validationErrors.length === 0;
	};

  const handleSubmit = async () => {
    if (!validate()) {
			return;
		} else {
      const submittedApplication = await Application.addApplicationToDb(formData)
      console.log("Form submitted:", submittedApplication);
      setSubmitted(true);
      Alert.alert("Thank You", "Your application has been submitted successfully.");
    }
  };

  if (submitted) {
    return (
      <View style={styles.thankYouContainer}>
        <Text style={styles.thankYouTitle}>Thank You for Applying!</Text>
        <Text style={styles.thankYouMessage}>
          Your application has been submitted successfully. We will review your
          information and get back to you shortly.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cleaner Job Application</Text>
      <Text style={styles.description}>
        Please fill out the form below to apply for a position as a cleaner with
        our company.
      </Text>

      {/* Full Name */}
      <Text style={styles.label}>First Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={formData.firstName}
        onChangeText={(text) => handleChange("firstName", text)}
      />
      <Text style={styles.label}>Last Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={formData.lastName}
        onChangeText={(text) => handleChange("lastName", text)}
      />

      {/* Email */}
      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email address"
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
        placeholder="E.g., No experience, 1-2 years"
        value={formData.experience}
        onChangeText={(text) => handleChange("experience", text)}
      />

      {/* Availability */}
      <Text style={styles.label}>Availability</Text>
      <TextInput
        style={styles.textArea}
        placeholder="E.g., Mondays, Fridays, weekends only"
        value={formData.availability}
        onChangeText={(text) => handleChange("availability", text)}
        multiline
      />

      {/* Additional Message */}
      <Text style={styles.label}>Why Do You Want to Work With Us?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Tell us why you're interested in this job"
        value={formData.message}
        onChangeText={(text) => handleChange("message", text)}
        multiline
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Submit Application</Text>
      </TouchableOpacity>
      {formError ? <View style={styles.errorContainer}>{formError.map((error, index) => (
      <Text key={index} style={styles.errorText}>{error}</Text>
    ))}</View> : null}
    </ScrollView>
  );
};

export default CleanerApplicationForm;
