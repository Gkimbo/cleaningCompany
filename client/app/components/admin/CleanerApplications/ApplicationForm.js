import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Application from "../../../services/fetchRequests/ApplicationClass";
import ApplicationFormStyles from "../../../services/styles/ApplicationFormStyles";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

const CleanerApplicationForm = () => {
  const [formData, setFormData] = useState({
    // Basic Information
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",

    // Address
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",

    // Identity Verification
    ssnLast4: "",
    driversLicenseNumber: "",
    driversLicenseState: "",
    idPhoto: null,

    // Work Eligibility
    isAuthorizedToWork: false,
    hasValidDriversLicense: false,
    hasReliableTransportation: false,

    // Experience
    experience: "",

    // Previous Employment
    previousEmployer: "",
    previousEmployerPhone: "",
    previousEmploymentDuration: "",
    reasonForLeaving: "",

    // Professional Reference (1 required)
    references: [
      { name: "", phone: "", relationship: "", company: "", yearsKnown: "" },
    ],

    // Criminal History
    hasCriminalHistory: false,
    criminalHistoryExplanation: "",

    // Emergency Contact
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",

    // Availability
    availableStartDate: "",
    availableDays: [],

    // Personal Statement
    message: "",

    // Consents
    backgroundConsent: false,
    referenceCheckConsent: false,
  });

  const [formError, setFormError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const styles = ApplicationFormStyles;

  const formatPhoneNumber = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");

    // Format as 555-555-5555
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const formatDate = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, "");

    // Format as MM/DD/YYYY
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 4) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
  };

  const isValidDate = (dateString) => {
    // Check format MM/DD/YYYY with 4-digit year
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(dateString)) return false;

    const [month, day, year] = dateString.split("/").map(Number);

    // Validate year is 4 digits and reasonable (1900-2100)
    if (year < 1900 || year > 2100) return false;

    // Validate month
    if (month < 1 || month > 12) return false;

    // Validate day for the given month
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return false;

    return true;
  };

  const handleChange = (name, value) => {
    // Auto-format phone number fields
    const phoneFields = [
      "phone",
      "previousEmployerPhone",
      "emergencyContactPhone",
    ];

    // Auto-format date fields
    const dateFields = ["dateOfBirth", "availableStartDate"];

    let formattedValue = value;
    if (phoneFields.includes(name)) {
      formattedValue = formatPhoneNumber(value);
    } else if (dateFields.includes(name)) {
      formattedValue = formatDate(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const handleReferenceChange = (index, field, value) => {
    // Auto-format phone number for reference phone fields
    const formattedValue = field === "phone" ? formatPhoneNumber(value) : value;

    setFormData((prev) => {
      const updatedRefs = [...prev.references];
      updatedRefs[index] = { ...updatedRefs[index], [field]: formattedValue };
      return { ...prev, references: updatedRefs };
    });
  };

  const toggleDay = (day) => {
    setFormData((prev) => {
      const days = prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day];
      return { ...prev, availableDays: days };
    });
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

  // Form validation by step
  const validateStep = (step) => {
    const errors = [];

    switch (step) {
      case 1: // Basic Information
        if (!formData.firstName.trim()) errors.push("First name is required.");
        if (!formData.lastName.trim()) errors.push("Last name is required.");
        if (!formData.email.trim()) errors.push("Email is required.");
        if (!formData.phone.trim()) errors.push("Phone number is required.");
        if (!formData.dateOfBirth) {
          errors.push("Date of birth is required.");
        } else if (!isValidDate(formData.dateOfBirth)) {
          errors.push("Please enter a valid date of birth (MM/DD/YYYY with 4-digit year).");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && !emailRegex.test(formData.email)) {
          errors.push("Please enter a valid email address.");
        }

        // Phone is auto-formatted as 555-555-5555, so just check length
        const phoneDigits = formData.phone.replace(/\D/g, "");
        if (formData.phone && phoneDigits.length !== 10) {
          errors.push("Please enter a valid 10-digit phone number.");
        }
        break;

      case 2: // Address & Identity
        if (!formData.streetAddress.trim()) errors.push("Street address is required.");
        if (!formData.city.trim()) errors.push("City is required.");
        if (!formData.state.trim()) errors.push("State is required.");
        if (!formData.zipCode.trim()) errors.push("ZIP code is required.");
        if (!formData.ssnLast4 || formData.ssnLast4.length !== 4) {
          errors.push("Please enter the last 4 digits of your SSN.");
        }
        if (!formData.idPhoto) errors.push("Please upload a valid photo ID.");
        break;

      case 3: // Work Eligibility & Experience
        if (!formData.isAuthorizedToWork) {
          errors.push("You must be authorized to work in the United States.");
        }
        if (!formData.hasReliableTransportation) {
          errors.push("Reliable transportation is required for this position.");
        }
        if (!formData.experience.trim()) {
          errors.push("Please describe your cleaning experience.");
        }
        break;

      case 4: // References
        const validRefs = formData.references.filter(
          (ref) => ref.name.trim() && ref.phone.trim() && ref.relationship.trim()
        );
        if (validRefs.length < 1) {
          errors.push("Please provide at least 1 professional reference with name, phone, and relationship.");
        }
        break;

      case 5: // Emergency Contact & Criminal History
        if (!formData.emergencyContactName.trim()) {
          errors.push("Emergency contact name is required.");
        }
        if (!formData.emergencyContactPhone.trim()) {
          errors.push("Emergency contact phone is required.");
        }
        if (!formData.emergencyContactRelation.trim()) {
          errors.push("Emergency contact relationship is required.");
        }
        if (formData.hasCriminalHistory && !formData.criminalHistoryExplanation.trim()) {
          errors.push("Please explain your criminal history.");
        }
        break;

      case 6: // Consents & Availability
        if (!formData.backgroundConsent) {
          errors.push("You must consent to a background check.");
        }
        if (!formData.referenceCheckConsent) {
          errors.push("You must consent to reference checks.");
        }
        if (formData.availableDays.length === 0) {
          errors.push("Please select at least one day you are available to work.");
        }
        if (!formData.message.trim()) {
          errors.push("Please tell us why you want to work with us.");
        }
        break;
    }

    return errors;
  };

  const nextStep = () => {
    const errors = validateStep(currentStep);
    if (errors.length > 0) {
      setFormError(errors);
      return;
    }
    setFormError(null);
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const prevStep = () => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Submit form
  const handleSubmit = async () => {
    const errors = validateStep(currentStep);
    if (errors.length > 0) {
      setFormError(errors);
      return;
    }

    try {
      const submittedApplication = await Application.addApplicationToDb(formData);
      console.log("Form submitted:", submittedApplication);
      setSubmitted(true);
      Alert.alert(
        "Thank You",
        "Your application has been submitted successfully. We'll review your information and conduct a background check. You'll hear from us within 5-7 business days."
      );
    } catch (error) {
      Alert.alert("Error", "Something went wrong while submitting the form.");
      console.error(error);
    }
  };

  // Progress indicator
  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>Step {currentStep} of {totalSteps}</Text>
    </View>
  );

  // Checkbox component
  const Checkbox = ({ checked, onPress, label }) => (
    <TouchableOpacity style={styles.checkboxContainer} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );

  // Thank You Screen
  if (submitted) {
    return (
      <View style={styles.thankYouContainer}>
        <View style={styles.thankYouIcon}>
          <Text style={{ fontSize: 60 }}>✓</Text>
        </View>
        <Text style={styles.thankYouTitle}>Application Submitted!</Text>
        <Text style={styles.thankYouMessage}>
          Thank you for applying to join our cleaning team. Your application is now under review.
          {"\n\n"}
          We will conduct a thorough background check and verify your references.
          This process typically takes 5-7 business days.
          {"\n\n"}
          You will receive an email at {formData.email} once your application has been processed.
        </Text>
      </View>
    );
  }

  // Step 1: Basic Information
  const renderStep1 = () => (
    <>
      <Text style={styles.sectionTitle}>Personal Information</Text>

      <Text style={styles.label}>First Name <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your first name"
        value={formData.firstName}
        onChangeText={(text) => handleChange("firstName", text)}
      />

      <Text style={styles.label}>Last Name <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your last name"
        value={formData.lastName}
        onChangeText={(text) => handleChange("lastName", text)}
      />

      <Text style={styles.label}>Email Address <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={formData.email}
        onChangeText={(text) => handleChange("email", text)}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Phone Number <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="(555) 555-5555"
        value={formData.phone}
        onChangeText={(text) => handleChange("phone", text)}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Date of Birth <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="MM/DD/YYYY"
        value={formData.dateOfBirth}
        onChangeText={(text) => handleChange("dateOfBirth", text)}
        keyboardType="number-pad"
        maxLength={10}
      />
      <Text style={styles.helperText}>You must be at least 18 years old to apply.</Text>
    </>
  );

  // Step 2: Address & Identity
  const renderStep2 = () => (
    <>
      <Text style={styles.sectionTitle}>Address & Identity Verification</Text>
      <Text style={styles.description}>
        This information is required to conduct a background check and verify your identity.
      </Text>

      <Text style={styles.label}>Street Address <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="123 Main Street, Apt 4"
        value={formData.streetAddress}
        onChangeText={(text) => handleChange("streetAddress", text)}
      />

      <View style={styles.rowContainer}>
        <View style={styles.flexHalf}>
          <Text style={styles.label}>City <Text style={styles.requiredLabel}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            value={formData.city}
            onChangeText={(text) => handleChange("city", text)}
          />
        </View>
        <View style={styles.flexQuarter}>
          <Text style={styles.label}>State <Text style={styles.requiredLabel}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="ST"
            value={formData.state}
            onChangeText={(text) => handleChange("state", text.toUpperCase())}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
        <View style={styles.flexQuarter}>
          <Text style={styles.label}>ZIP <Text style={styles.requiredLabel}>*</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="12345"
            value={formData.zipCode}
            onChangeText={(text) => handleChange("zipCode", text)}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
      </View>

      <View style={styles.sectionDivider} />

      <Text style={styles.label}>Last 4 Digits of SSN <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="XXXX"
        value={formData.ssnLast4}
        onChangeText={(text) => handleChange("ssnLast4", text.replace(/\D/g, ''))}
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
      />
      <Text style={styles.helperText}>Required for background check verification. Your data is encrypted and secure.</Text>

      <View style={styles.rowContainer}>
        <View style={styles.flexThreeQuarter}>
          <Text style={styles.label}>Driver's License Number</Text>
          <TextInput
            style={styles.input}
            placeholder="License number"
            value={formData.driversLicenseNumber}
            onChangeText={(text) => handleChange("driversLicenseNumber", text)}
          />
        </View>
        <View style={styles.flexQuarter}>
          <Text style={styles.label}>State</Text>
          <TextInput
            style={styles.input}
            placeholder="ST"
            value={formData.driversLicenseState}
            onChangeText={(text) => handleChange("driversLicenseState", text.toUpperCase())}
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <Text style={styles.label}>Upload Government-Issued Photo ID <Text style={styles.requiredLabel}>*</Text></Text>
      <TouchableOpacity style={styles.uploadButton} onPress={handleIdUpload}>
        <Text style={styles.uploadButtonText}>
          {formData.idPhoto ? "Change ID Photo" : "Select ID Photo"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.helperText}>Accepted: Driver's license, State ID, or Passport</Text>

      {formData.idPhoto && (
        <Image
          source={{ uri: formData.idPhoto }}
          style={styles.idPreview}
          resizeMode="contain"
        />
      )}
    </>
  );

  // Step 3: Work Eligibility & Experience
  const renderStep3 = () => (
    <>
      <Text style={styles.sectionTitle}>Work Eligibility & Experience</Text>

      <Checkbox
        checked={formData.isAuthorizedToWork}
        onPress={() => handleChange("isAuthorizedToWork", !formData.isAuthorizedToWork)}
        label="I am legally authorized to work in the United States *"
      />

      <Checkbox
        checked={formData.hasValidDriversLicense}
        onPress={() => handleChange("hasValidDriversLicense", !formData.hasValidDriversLicense)}
        label="I have a valid driver's license"
      />

      <Checkbox
        checked={formData.hasReliableTransportation}
        onPress={() => handleChange("hasReliableTransportation", !formData.hasReliableTransportation)}
        label="I have reliable transportation to get to job sites *"
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.label}>Cleaning Experience <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.textArea}
        placeholder="Describe your cleaning experience (years, types of cleaning, skills)"
        value={formData.experience}
        onChangeText={(text) => handleChange("experience", text)}
        multiline
        numberOfLines={4}
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Previous Employment</Text>
      <Text style={styles.helperText}>Most recent employer in the cleaning industry (if applicable)</Text>

      <Text style={styles.label}>Previous Employer Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Company name"
        value={formData.previousEmployer}
        onChangeText={(text) => handleChange("previousEmployer", text)}
      />

      <Text style={styles.label}>Employer Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="(555) 555-5555"
        value={formData.previousEmployerPhone}
        onChangeText={(text) => handleChange("previousEmployerPhone", text)}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>How Long Did You Work There?</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., 2 years, 6 months"
        value={formData.previousEmploymentDuration}
        onChangeText={(text) => handleChange("previousEmploymentDuration", text)}
      />

      <Text style={styles.label}>Reason for Leaving</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Why did you leave this position?"
        value={formData.reasonForLeaving}
        onChangeText={(text) => handleChange("reasonForLeaving", text)}
        multiline
        numberOfLines={3}
      />
    </>
  );

  // Step 4: Professional References
  const renderStep4 = () => (
    <>
      <Text style={styles.sectionTitle}>Professional Reference</Text>
      <Text style={styles.description}>
        Please provide 1 professional reference who can speak to your work ethic,
        reliability, and trustworthiness. Reference should NOT be a family member.
      </Text>

      {formData.references.map((ref, index) => (
        <View key={index} style={styles.referenceCard}>
          <Text style={styles.referenceHeader}>Reference {index + 1} <Text style={styles.requiredLabel}>*</Text></Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Reference's full name"
            value={ref.name}
            onChangeText={(text) => handleReferenceChange(index, "name", text)}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 555-5555"
            value={ref.phone}
            onChangeText={(text) => handleReferenceChange(index, "phone", text)}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Relationship</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Former Supervisor, Coworker, Client"
            value={ref.relationship}
            onChangeText={(text) => handleReferenceChange(index, "relationship", text)}
          />

          <Text style={styles.label}>Company/Organization</Text>
          <TextInput
            style={styles.input}
            placeholder="Where you worked together"
            value={ref.company}
            onChangeText={(text) => handleReferenceChange(index, "company", text)}
          />

          <Text style={styles.label}>How Long Have You Known This Person?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 3 years"
            value={ref.yearsKnown}
            onChangeText={(text) => handleReferenceChange(index, "yearsKnown", text)}
          />
        </View>
      ))}
    </>
  );

  // Step 5: Emergency Contact & Criminal History
  const renderStep5 = () => (
    <>
      <Text style={styles.sectionTitle}>Emergency Contact</Text>
      <Text style={styles.description}>
        Please provide someone we can contact in case of an emergency.
      </Text>

      <Text style={styles.label}>Contact Name <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={formData.emergencyContactName}
        onChangeText={(text) => handleChange("emergencyContactName", text)}
      />

      <Text style={styles.label}>Contact Phone <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="(555) 555-5555"
        value={formData.emergencyContactPhone}
        onChangeText={(text) => handleChange("emergencyContactPhone", text)}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>Relationship <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Spouse, Parent, Sibling"
        value={formData.emergencyContactRelation}
        onChangeText={(text) => handleChange("emergencyContactRelation", text)}
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Criminal History Disclosure</Text>
      <Text style={styles.description}>
        A criminal record does not automatically disqualify you. We review each application
        individually and consider the nature of offenses, time elapsed, and rehabilitation.
      </Text>

      <Checkbox
        checked={formData.hasCriminalHistory}
        onPress={() => handleChange("hasCriminalHistory", !formData.hasCriminalHistory)}
        label="I have been convicted of a felony or misdemeanor"
      />

      {formData.hasCriminalHistory && (
        <>
          <Text style={styles.label}>Please Explain <Text style={styles.requiredLabel}>*</Text></Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the nature of the offense(s), when they occurred, and any steps you've taken toward rehabilitation."
            value={formData.criminalHistoryExplanation}
            onChangeText={(text) => handleChange("criminalHistoryExplanation", text)}
            multiline
            numberOfLines={5}
          />
        </>
      )}
    </>
  );

  // Step 6: Availability & Consents
  const renderStep6 = () => (
    <>
      <Text style={styles.sectionTitle}>Availability</Text>

      <Text style={styles.label}>Earliest Start Date</Text>
      <TextInput
        style={styles.input}
        placeholder="MM/DD/YYYY"
        value={formData.availableStartDate}
        onChangeText={(text) => handleChange("availableStartDate", text)}
        keyboardType="number-pad"
        maxLength={10}
      />

      <Text style={styles.label}>Days Available to Work <Text style={styles.requiredLabel}>*</Text></Text>
      <View style={styles.daysContainer}>
        {DAYS_OF_WEEK.map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayChip,
              formData.availableDays.includes(day) && styles.dayChipSelected,
            ]}
            onPress={() => toggleDay(day)}
          >
            <Text
              style={[
                styles.dayChipText,
                formData.availableDays.includes(day) && styles.dayChipTextSelected,
              ]}
            >
              {day.substring(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.sectionDivider} />

      <Text style={styles.label}>Why Do You Want to Work With Us? <Text style={styles.requiredLabel}>*</Text></Text>
      <TextInput
        style={styles.textArea}
        placeholder="Tell us about yourself, your work ethic, and why you'd be a great fit for our team."
        value={formData.message}
        onChangeText={(text) => handleChange("message", text)}
        multiline
        numberOfLines={5}
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Required Consents</Text>
      <Text style={styles.description}>
        By checking the boxes below, you authorize us to conduct the following screenings:
      </Text>

      <Checkbox
        checked={formData.backgroundConsent}
        onPress={() => handleChange("backgroundConsent", !formData.backgroundConsent)}
        label="I consent to a comprehensive background check, including criminal history, identity verification, and employment history. *"
      />

      <Checkbox
        checked={formData.referenceCheckConsent}
        onPress={() => handleChange("referenceCheckConsent", !formData.referenceCheckConsent)}
        label="I consent to having my professional references contacted. *"
      />

      <Text style={styles.legalText}>
        By submitting this application, I certify that all information provided is true and
        complete to the best of my knowledge. I understand that any false statements or
        omissions may result in disqualification from consideration or termination of employment.
      </Text>
    </>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      default: return renderStep1();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Cleaner Job Application</Text>
      <Text style={styles.description}>
        Join our trusted cleaning team. All applicants undergo thorough background checks
        and reference verification to ensure the safety of our clients.
      </Text>

      {renderProgressBar()}

      {renderCurrentStep()}

      {/* Validation Errors */}
      {formError && formError.length > 0 && (
        <View style={styles.errorContainer}>
          {formError.map((error, index) => (
            <Text key={index} style={styles.errorText}>
              • {error}
            </Text>
          ))}
        </View>
      )}

      {/* Navigation Buttons */}
      <View style={styles.buttonRow}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.secondaryButton} onPress={prevStep}>
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </TouchableOpacity>
        )}

        {currentStep < totalSteps ? (
          <TouchableOpacity style={styles.button} onPress={nextStep}>
            <Text style={styles.buttonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Submit Application</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

export default CleanerApplicationForm;
