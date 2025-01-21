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

const CleanerApplicationForm = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    experience: "",
    availability: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (name, value) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = () => {
    // You can send the form data to your backend here
    console.log("Form submitted:", formData);
    setSubmitted(true);
    Alert.alert("Thank You", "Your application has been submitted successfully.");
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
      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={formData.fullName}
        onChangeText={(text) => handleChange("fullName", text)}
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#555",
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 15,
    borderRadius: 4,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  thankYouContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  thankYouMessage: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
  },
});

export default CleanerApplicationForm;
