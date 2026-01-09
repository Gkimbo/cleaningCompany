import * as ImagePicker from "expo-image-picker";
import React, { useState, useEffect } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Application from "../../../services/fetchRequests/ApplicationClass";
import ApplicationFormStyles from "../../../services/styles/ApplicationFormStyles";
import { TermsModal } from "../../terms";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  responsive,
} from "../../../services/styles/theme";
import { usePricing, defaultPricing } from "../../../context/PricingContext";
import ReferralCodeInput from "../../referrals/ReferralCodeInput";
import IncentiveBanner from "../../incentives/IncentiveBanner";
import IncentivesService from "../../../services/fetchRequests/IncentivesService";

const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

const { width } = Dimensions.get("window");

const CleanerApplicationForm = () => {
  const { pricing: fetchedPricing, loading } = usePricing();

  // Use fetched pricing if available, otherwise fall back to defaults
  const pricing = fetchedPricing?.basePrice ? fetchedPricing : defaultPricing;

  // Calculate cleaner earnings (base price minus platform fee)
  const platformFeePercent =
    pricing.platform?.feePercent ?? defaultPricing.platform.feePercent;
  const minCleanerPay = Math.round(
    (pricing.basePrice ?? defaultPricing.basePrice) * (1 - platformFeePercent)
  );
  // Max pay assumes a 2bed/1bath (1 extra bed = 1 extra)
  const maxCleanerPay = Math.round(
    ((pricing.basePrice ?? defaultPricing.basePrice) +
      (pricing.extraBedBathFee ?? defaultPricing.extraBedBathFee)) *
      (1 - platformFeePercent)
  );

  // Calculate weekly/monthly/yearly earnings for different tiers
  const calculateEarnings = (housesPerDay, daysPerWeek = 5) => {
    const avgPayPerHouse = Math.round((minCleanerPay + maxCleanerPay) / 2);
    const weekly = housesPerDay * daysPerWeek * avgPayPerHouse;
    const monthly = weekly * 4;
    const yearly = weekly * 52;
    return { weekly, monthly, yearly };
  };

  const partTimeEarnings = calculateEarnings(1.5); // 1-2 houses/day average
  const fullTimeEarnings = calculateEarnings(3);
  const hustleModeEarnings = calculateEarnings(4);

  const [showForm, setShowForm] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValidation, setReferralValidation] = useState(null);
  const [incentiveConfig, setIncentiveConfig] = useState(null);

  // Fetch incentive configuration on mount
  useEffect(() => {
    IncentivesService.getCurrentIncentives().then(setIncentiveConfig);
  }, []);

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

    // Experience (optional)
    experience: "",

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

    // Personal Statement
    message: "",

    // Consents
    backgroundConsent: false,
    referenceCheckConsent: false,
    termsAccepted: false,
    termsId: null,
    privacyPolicyAccepted: false,
    privacyPolicyId: null,
  });

  const [formError, setFormError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
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
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(
        6,
        10
      )}`;
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
      return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(
        4,
        8
      )}`;
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
    const phoneFields = ["phone", "emergencyContactPhone"];

    // Auto-format date fields
    const dateFields = ["dateOfBirth"];

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

  // Handle ID upload
  const handleIdUpload = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
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
      let photoUri = pickerResult.assets[0].uri;

      // On web, blob URLs need to be converted to base64 data URLs
      // because blob URLs are session-only and can't be displayed later
      if (Platform.OS === "web" && photoUri.startsWith("blob:")) {
        try {
          const response = await fetch(photoUri);
          const blob = await response.blob();
          const reader = new FileReader();
          photoUri = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error("Error converting blob to data URL:", error);
          Alert.alert("Error", "Failed to process the selected image.");
          return;
        }
      }

      setFormData((prev) => ({
        ...prev,
        idPhoto: photoUri,
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
          errors.push(
            "Please enter a valid date of birth (MM/DD/YYYY with 4-digit year)."
          );
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
        if (!formData.streetAddress.trim())
          errors.push("Street address is required.");
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
        // Experience is optional - no validation needed
        break;

      case 4: // References
        const validRefs = formData.references.filter(
          (ref) =>
            ref.name.trim() && ref.phone.trim() && ref.relationship.trim()
        );
        if (validRefs.length < 1) {
          errors.push(
            "Please provide at least 1 professional reference with name, phone, and relationship."
          );
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
        if (
          formData.hasCriminalHistory &&
          !formData.criminalHistoryExplanation.trim()
        ) {
          errors.push("Please explain your criminal history.");
        }
        break;

      case 6: // Consents
        if (!formData.backgroundConsent) {
          errors.push("You must consent to a background check.");
        }
        if (!formData.referenceCheckConsent) {
          errors.push("You must consent to reference checks.");
        }
        if (!formData.termsAccepted) {
          errors.push("You must accept the Terms and Conditions.");
        }
        if (!formData.privacyPolicyAccepted) {
          errors.push("You must accept the Privacy Policy.");
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

  // Handle terms acceptance
  const handleTermsAccepted = (acceptedTermsId) => {
    setFormData((prev) => ({
      ...prev,
      termsAccepted: true,
      termsId: acceptedTermsId,
    }));
    setShowTermsModal(false);
  };

  // Handle privacy policy acceptance
  const handlePrivacyAccepted = (acceptedPrivacyId) => {
    setFormData((prev) => ({
      ...prev,
      privacyPolicyAccepted: true,
      privacyPolicyId: acceptedPrivacyId,
    }));
    setShowPrivacyModal(false);
  };

  // Submit form
  const handleSubmit = async () => {
    const errors = validateStep(currentStep);
    if (errors.length > 0) {
      setFormError(errors);
      return;
    }

    try {
      // Include referral code if valid
      const submissionData = {
        ...formData,
        referralCode: referralValidation?.valid ? referralCode : null,
      };
      const submittedApplication = await Application.addApplicationToDb(
        submissionData
      );
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
        <View
          style={[
            styles.progressFill,
            { width: `${(currentStep / totalSteps) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        Step {currentStep} of {totalSteps}
      </Text>
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
          Thank you for applying to join our cleaning team. Your application is
          now under review.
          {"\n\n"}
          We will conduct a thorough background check and verify your
          references. This process typically takes 5-7 business days.
          {"\n\n"}
          You will receive an email at {formData.email} once your application
          has been processed.
        </Text>
      </View>
    );
  }

  // Keep percentage calculation
  const keepPercent = Math.round((1 - platformFeePercent) * 100);

  // Benefits data
  const benefits = [
    {
      icon: "👑",
      title: "Be Your Own Boss",
      description:
        "You decide when and where you work. No micromanaging, no office politics. 100% control over your schedule.",
      stat: "100%",
      statLabel: "Freedom",
    },
    {
      icon: "⚡",
      title: "Get Paid in 24 Hours",
      description:
        "No more waiting weeks for paychecks. Finish a job, get paid within 24 hours directly to your bank account.",
      stat: "24hr",
      statLabel: "Payouts",
    },
    {
      icon: "📈",
      title: "Unlimited Earning Potential",
      description: `No caps, no limits. Work more, earn more. Full-time cleaners average $${fullTimeEarnings.yearly.toLocaleString()}/year. Your success = your effort.`,
      stat: `$${Math.round(fullTimeEarnings.yearly / 1000)}k+`,
      statLabel: "Per Year",
    },
  ];

  const perks = [
    {
      icon: "✓",
      text: `Get paid within 48 hours of each cleaning`,
      highlight: true,
    },
    { icon: "✓", text: "Flexible scheduling - accept only jobs you want" },
    { icon: "✓", text: "No experience necessary" },
    { icon: "✓", text: "Work independently, no boss hovering over you" },
    { icon: "✓", text: "Build recurring clients for steady income" },
    { icon: "✓", text: "Guaranteed payments - never chase money again" },
  ];

  const testimonials = [
    {
      quote:
        "I left my retail job 6 months ago. Now I make $4,200/month cleaning 3 houses a day, and I actually have time for my kids.",
      name: "Maria G.",
      earnings: "$4,200/mo",
      time: "6 months on platform",
    },
    {
      quote:
        "Started part-time while finishing school. Best side hustle ever - I made $1,800 last month working just weekends.",
      name: "James T.",
      earnings: "$1,800/mo",
      time: "Part-time cleaner",
    },
    {
      quote:
        "The 24-hour payouts changed everything. I can actually plan my finances now instead of waiting 2 weeks for a paycheck.",
      name: "Lisa M.",
      earnings: "$3,500/mo",
      time: "1 year on platform",
    },
  ];

  const comparisonData = [
    { feature: "Set your own schedule", us: true, traditional: false },
    { feature: "Get paid within 24 hours", us: true, traditional: false },
    { feature: "Choose which jobs to take", us: true, traditional: false },
    { feature: "No boss or supervisor", us: true, traditional: false },
    {
      feature: `Keep ${keepPercent}% of earnings`,
      us: true,
      traditional: false,
    },
    { feature: "Work from anywhere", us: true, traditional: false },
  ];

  // Hero Landing Page
  if (!showForm) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.neutral[0] }}
        contentContainerStyle={{ paddingBottom: spacing["4xl"] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View
          style={{
            backgroundColor: colors.secondary[500],
            paddingTop: Platform.OS === "ios" ? 60 : 40,
            paddingBottom: spacing["4xl"],
            paddingHorizontal: spacing.xl,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          {/* <View
            style={{
              backgroundColor: "rgba(255,255,255,0.15)",
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderRadius: radius.full,
              alignSelf: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.neutral[0],
                fontWeight: typography.fontWeight.semibold,
              }}
            >
              🔥 500+ Cleaners Already Earning
            </Text>
          </View> */}
          <Text
            style={{
              fontSize: responsive(28, 36, 44),
              fontWeight: "800",
              color: colors.neutral[0],
              textAlign: "center",
              marginBottom: spacing.md,
              lineHeight: responsive(34, 44, 52),
            }}
          >
            Earn
            <Text style={{ color: "#fde68a" }}>
              {` $${minCleanerPay} - $${maxCleanerPay} `}
            </Text>
            {"\n"}
            Per House Cleaned
          </Text>
          <Text
            style={{
              fontSize: responsive(16, 18, 20),
              color: colors.secondary[100],
              textAlign: "center",
              marginBottom: spacing.lg,
              lineHeight: 26,
            }}
          >
            Thats about ${Math.round(minCleanerPay * 0.7)} - $
            {Math.round(maxCleanerPay * 0.7)} / Hour
            {"\n"}
            No boss. No limits. Start this week.
          </Text>

          {/* Quick Stats */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              marginBottom: spacing.xl,
              paddingHorizontal: spacing.sm,
            }}
          >
            {[
              // { value: `${keepPercent}%`, label: "You Keep" },
              { value: "24hr", label: "Payouts" },
              { value: "4.9", label: "Rating" },
              { value: "$0", label: "To Start" },
            ].map((stat, index) => (
              <View key={index} style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.neutral[0],
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.secondary[200],
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              backgroundColor: colors.neutral[0],
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing["2xl"],
              borderRadius: radius.xl,
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              ...shadows.lg,
            }}
          >
            <Text
              style={{
                color: colors.secondary[600],
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                textAlign: "center",
              }}
            >
              Apply Now - Takes 5 Minutes
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.secondary[200],
              textAlign: "center",
              marginTop: spacing.md,
            }}
          >
            Free to apply. No experience needed.
          </Text>
        </View>

        {/* Income Highlight */}
        <View
          style={{
            marginTop: -spacing["2xl"],
            marginHorizontal: spacing.lg,
            backgroundColor: colors.neutral[0],
            borderRadius: radius["2xl"],
            padding: spacing.xl,
            ...shadows.lg,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.text.tertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: spacing.xs,
            }}
          >
            Average Weekly Earnings
          </Text>
          <Text
            style={{
              fontSize: responsive(40, 48, 56),
              fontWeight: typography.fontWeight.bold,
              color: colors.success[600],
            }}
          >
            ${fullTimeEarnings.weekly.toLocaleString()}+
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.text.secondary,
              textAlign: "center",
            }}
          >
            Based on 3 houses/day, 5 days/week at ${minCleanerPay}-$
            {maxCleanerPay}/house
          </Text>
        </View>

        {/* Incentive Banner */}
        {incentiveConfig?.cleaner?.enabled &&
          (() => {
            const feeReduction = incentiveConfig.cleaner.feeReductionPercent;
            const maxCleanings = incentiveConfig.cleaner.maxCleanings;

            // Extra percentage = platform fee * fee reduction (e.g., 10% * 100% = 10% extra)
            const extraPercent = Math.round(
              platformFeePercent * feeReduction * 100
            );

            // Calculate estimated total extra earnings
            const avgPayPerHouse = Math.round(
              (minCleanerPay + maxCleanerPay) / 2
            );
            const extraPerCleaning = Math.round(
              avgPayPerHouse * platformFeePercent * feeReduction
            );
            const totalExtra = extraPerCleaning * maxCleanings;

            return (
              <IncentiveBanner
                type="cleaner"
                message={`New cleaners earn an extra ${extraPercent}% on each of your first ${maxCleanings} cleanings - that's up to $${totalExtra} extra!`}
                icon="trending-up"
              />
            );
          })()}

        {/* Benefits Grid */}
        <View
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing["3xl"] }}
        >
          <Text
            style={{
              fontSize: responsive(22, 26, 30),
              fontWeight: typography.fontWeight.bold,
              color: colors.text.primary,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Why Join Kleanr?
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.secondary,
              textAlign: "center",
              marginBottom: spacing["2xl"],
            }}
          >
            Take control of your career and your life
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            {benefits.map((benefit, index) => (
              <View
                key={index}
                style={{
                  width: width > 600 ? "48%" : "100%",
                  backgroundColor: colors.primary[50],
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  marginBottom: spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.primary[100],
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: spacing.md,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{benefit.icon}</Text>
                  {benefit.stat && (
                    <View
                      style={{
                        backgroundColor: colors.primary[600],
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                        borderRadius: radius.lg,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: typography.fontSize.lg,
                          fontWeight: "800",
                          color: colors.neutral[0],
                        }}
                      >
                        {benefit.stat}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.primary[200],
                        }}
                      >
                        {benefit.statLabel}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={{
                    fontSize: typography.fontSize.lg,
                    fontWeight: typography.fontWeight.bold,
                    color: colors.primary[800],
                    marginBottom: spacing.sm,
                  }}
                >
                  {benefit.title}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.text.secondary,
                    lineHeight: 22,
                  }}
                >
                  {benefit.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* How Much Can You Earn */}
        <View
          style={{
            backgroundColor: colors.neutral[900],
            marginTop: spacing["2xl"],
            paddingVertical: spacing["3xl"],
            paddingHorizontal: spacing.lg,
          }}
        >
          <Text
            style={{
              fontSize: responsive(22, 26, 30),
              fontWeight: typography.fontWeight.bold,
              color: colors.neutral[0],
              textAlign: "center",
              marginBottom: spacing["2xl"],
            }}
          >
            How Much Can You Earn?
          </Text>

          <View
            style={{
              flexDirection: width > 500 ? "row" : "column",
              justifyContent: "space-around",
            }}
          >
            {[
              {
                hours: "1-2 houses/day",
                week: `$${partTimeEarnings.weekly.toLocaleString()}+`,
                month: `$${partTimeEarnings.monthly.toLocaleString()}+`,
                year: `$${partTimeEarnings.yearly.toLocaleString()}+`,
                label: "Part-Time",
              },
              {
                hours: "3 houses/day",
                week: `$${fullTimeEarnings.weekly.toLocaleString()}+`,
                month: `$${fullTimeEarnings.monthly.toLocaleString()}+`,
                year: `$${fullTimeEarnings.yearly.toLocaleString()}+`,
                label: "Full-Time",
              },
              {
                hours: "4+ houses/day",
                week: `$${hustleModeEarnings.weekly.toLocaleString()}+`,
                month: `$${hustleModeEarnings.monthly.toLocaleString()}+`,
                year: `$${hustleModeEarnings.yearly.toLocaleString()}+`,
                label: "Hustle Mode",
              },
            ].map((tier, index) => (
              <View
                key={index}
                style={{
                  alignItems: "center",
                  marginBottom: width > 500 ? 0 : spacing.xl,
                  flex: width > 500 ? 1 : undefined,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[400],
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: spacing.sm,
                  }}
                >
                  {tier.label}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.neutral[500],
                    marginBottom: spacing.xs,
                  }}
                >
                  {tier.hours}
                </Text>
                <View
                  style={{
                    backgroundColor: colors.neutral[800],
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    width: "100%",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.neutral[500],
                    }}
                  >
                    Weekly
                  </Text>
                  <Text
                    style={{
                      fontSize: responsive(24, 28, 32),
                      fontWeight: typography.fontWeight.bold,
                      color: colors.secondary[400],
                    }}
                  >
                    {tier.week}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    marginTop: spacing.sm,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.neutral[500],
                      }}
                    >
                      Monthly
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.neutral[300],
                      }}
                    >
                      {tier.month}
                    </Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: typography.fontSize.xs,
                        color: colors.neutral[500],
                      }}
                    >
                      Yearly
                    </Text>
                    <Text
                      style={{
                        fontSize: typography.fontSize.base,
                        fontWeight: typography.fontWeight.bold,
                        color: colors.success[400],
                      }}
                    >
                      {tier.year}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Text
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.neutral[500],
              textAlign: "center",
              marginTop: spacing.xl,
            }}
          >
            *Earnings based on ${minCleanerPay}-${maxCleanerPay} per house. $
            {minCleanerPay} per house is the absolute mininimum you'll earn
            cleaning a 1 bed 1 bath home. It only goes up from there!
          </Text>
        </View>

        {/* Perks List */}
        <View
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing["3xl"] }}
        >
          <Text
            style={{
              fontSize: responsive(22, 26, 30),
              fontWeight: typography.fontWeight.bold,
              color: colors.text.primary,
              textAlign: "center",
              marginBottom: spacing["2xl"],
            }}
          >
            What You Get
          </Text>

          <View
            style={{
              backgroundColor: colors.success[50],
              borderRadius: radius["2xl"],
              padding: spacing.xl,
              borderWidth: 1,
              borderColor: colors.success[200],
            }}
          >
            {perks.map((perk, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: index < perks.length - 1 ? spacing.lg : 0,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.success[500],
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: spacing.md,
                  }}
                >
                  <Text
                    style={{
                      color: colors.neutral[0],
                      fontWeight: "bold",
                      fontSize: 14,
                    }}
                  >
                    {perk.icon}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: typography.fontSize.base,
                    color: colors.text.primary,
                    flex: 1,
                  }}
                >
                  {perk.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Testimonials
        <View
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing["3xl"] }}
        >
          <Text
            style={{
              fontSize: typography.fontSize.xs,
              fontWeight: typography.fontWeight.bold,
              color: colors.secondary[600],
              letterSpacing: 1.5,
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            SUCCESS STORIES
          </Text>
          <Text
            style={{
              fontSize: responsive(22, 26, 30),
              fontWeight: typography.fontWeight.bold,
              color: colors.text.primary,
              textAlign: "center",
              marginBottom: spacing["2xl"],
            }}
          >
            Real Cleaners, Real Results
          </Text>

          {testimonials.map((testimonial, index) => (
            <View
              key={index}
              style={{
                backgroundColor: colors.neutral[50],
                borderRadius: radius["2xl"],
                padding: spacing.xl,
                marginBottom: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: spacing.md,
                }}
              >
                <Text style={{ fontSize: 24 }}>💬</Text>
                <View
                  style={{
                    backgroundColor: colors.success[500],
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.full,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.neutral[0],
                    }}
                  >
                    {testimonial.earnings}
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  color: colors.text.primary,
                  lineHeight: 26,
                  fontStyle: "italic",
                  marginBottom: spacing.lg,
                }}
              >
                "{testimonial.quote}"
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.secondary[100],
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: spacing.md,
                  }}
                >
                  <Text
                    style={{
                      fontSize: typography.fontSize.lg,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.secondary[600],
                    }}
                  >
                    {testimonial.name[0]}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: typography.fontSize.sm,
                      fontWeight: typography.fontWeight.bold,
                      color: colors.text.primary,
                    }}
                  >
                    {testimonial.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: typography.fontSize.xs,
                      color: colors.text.tertiary,
                    }}
                  >
                    {testimonial.time}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View> */}

        {/* Requirements */}
        <View
          style={{ paddingHorizontal: spacing.lg, marginTop: spacing["3xl"] }}
        >
          <Text
            style={{
              fontSize: responsive(20, 22, 24),
              fontWeight: typography.fontWeight.bold,
              color: colors.text.primary,
              textAlign: "center",
              marginBottom: spacing.xl,
            }}
          >
            What You Need to Apply
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: spacing.md,
            }}
          >
            {[
              { icon: "🚗", text: "Reliable transportation" },
              { icon: "📱", text: "Smartphone" },
              { icon: "✅", text: "Background check" },
              { icon: "💪", text: "Positive attitude" },
            ].map((req, index) => (
              <View
                key={index}
                style={{
                  backgroundColor: colors.neutral[100],
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.xl,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 18, marginRight: spacing.sm }}>
                  {req.icon}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.text.primary,
                    fontWeight: typography.fontWeight.medium,
                  }}
                >
                  {req.text}
                </Text>
              </View>
            ))}
          </View>

          <Text
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.text.tertiary,
              textAlign: "center",
              marginTop: spacing.lg,
            }}
          >
            No cleaning experience required.
          </Text>
        </View>

        {/* Final CTA */}
        <View
          style={{
            marginTop: spacing["3xl"],
            marginHorizontal: spacing.lg,
            backgroundColor: colors.primary[600],
            borderRadius: radius["2xl"],
            padding: spacing["2xl"],
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: responsive(22, 26, 30),
              fontWeight: typography.fontWeight.bold,
              color: colors.neutral[0],
              textAlign: "center",
              marginBottom: spacing.sm,
            }}
          >
            Ready to Take Control?
          </Text>
          <Text
            style={{
              fontSize: typography.fontSize.base,
              color: colors.primary[100],
              textAlign: "center",
              marginBottom: spacing.xl,
            }}
          >
            Join hundreds of cleaners earning great money on their own terms
          </Text>
          <TouchableOpacity
            onPress={() => setShowForm(true)}
            style={{
              backgroundColor: colors.secondary[500],
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing["3xl"],
              borderRadius: radius.xl,
              ...shadows.lg,
            }}
          >
            <Text
              style={{
                color: colors.neutral[0],
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
              }}
            >
              Start Your Application
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              fontSize: typography.fontSize.xs,
              color: colors.primary[200],
              textAlign: "center",
              marginTop: spacing.lg,
            }}
          >
            Takes only 5 minutes • No fees • Start earning this week
          </Text>
        </View>

        {/* FAQ Preview */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            marginTop: spacing["3xl"],
            marginBottom: spacing.xl,
          }}
        >
          <Text
            style={{
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
              color: colors.text.primary,
              textAlign: "center",
              marginBottom: spacing.lg,
            }}
          >
            Common Questions
          </Text>

          {[
            {
              q: "How quickly can I start working?",
              a: "After your background check clears (3-5 days), you can start accepting jobs immediately.",
            },
            {
              q: "Do I need my own supplies?",
              a: "Yes! Some homes will have a few supplies but its always best to bring the cleaning suppies you like to use.",
            },
            {
              q: "How do I get paid?",
              a: "Instantly! As soon as you finish a cleaning, payment is sent directly to your bank.",
            },
          ].map((faq, index) => (
            <View
              key={index}
              style={{
                marginBottom: spacing.lg,
                paddingBottom: spacing.lg,
                borderBottomWidth: index < 2 ? 1 : 0,
                borderBottomColor: colors.border.light,
              }}
            >
              <Text
                style={{
                  fontSize: typography.fontSize.base,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text.primary,
                  marginBottom: spacing.xs,
                }}
              >
                {faq.q}
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                  lineHeight: 22,
                }}
              >
                {faq.a}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // Step 1: Basic Information
  const renderStep1 = () => (
    <>
      <Text style={styles.sectionTitle}>Personal Information</Text>

      <Text style={styles.label}>
        First Name <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your first name"
        value={formData.firstName}
        onChangeText={(text) => handleChange("firstName", text)}
      />

      <Text style={styles.label}>
        Last Name <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your last name"
        value={formData.lastName}
        onChangeText={(text) => handleChange("lastName", text)}
      />

      <Text style={styles.label}>
        Email Address <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        value={formData.email}
        onChangeText={(text) => handleChange("email", text)}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>
        Phone Number <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="(555) 555-5555"
        value={formData.phone}
        onChangeText={(text) => handleChange("phone", text)}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>
        Date of Birth <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="MM/DD/YYYY"
        value={formData.dateOfBirth}
        onChangeText={(text) => handleChange("dateOfBirth", text)}
        keyboardType="number-pad"
        maxLength={10}
      />
      <Text style={styles.helperText}>
        You must be at least 18 years old to apply.
      </Text>
      {/* Referral Code - placed prominently after email */}
      <View style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
        <ReferralCodeInput
          value={referralCode}
          onChangeText={setReferralCode}
          onValidation={setReferralValidation}
          userType="cleaner"
          placeholder="Enter referral code (optional)"
        />
      </View>
    </>
  );

  // Step 2: Address & Identity
  const renderStep2 = () => (
    <>
      <Text style={styles.sectionTitle}>Address & Identity Verification</Text>
      <Text style={styles.description}>
        This information is required to conduct a background check and verify
        your identity.
      </Text>

      <Text style={styles.label}>
        Street Address <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="123 Main Street, Apt 4"
        value={formData.streetAddress}
        onChangeText={(text) => handleChange("streetAddress", text)}
      />

      <View style={styles.rowContainer}>
        <View style={styles.flexHalf}>
          <Text style={styles.label}>
            City <Text style={styles.requiredLabel}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="City"
            value={formData.city}
            onChangeText={(text) => handleChange("city", text)}
          />
        </View>
        <View style={styles.flexQuarter}>
          <Text style={styles.label}>
            State <Text style={styles.requiredLabel}>*</Text>
          </Text>
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
          <Text style={styles.label}>
            ZIP <Text style={styles.requiredLabel}>*</Text>
          </Text>
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

      <Text style={styles.label}>
        Last 4 Digits of SSN <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="XXXX"
        value={formData.ssnLast4}
        onChangeText={(text) =>
          handleChange("ssnLast4", text.replace(/\D/g, ""))
        }
        keyboardType="number-pad"
        maxLength={4}
        secureTextEntry
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        textContentType="oneTimeCode"
        autoComplete="off"
      />
      <Text style={styles.helperText}>
        Required for background check verification. Your data is encrypted and
        secure.
      </Text>

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
            onChangeText={(text) =>
              handleChange("driversLicenseState", text.toUpperCase())
            }
            maxLength={2}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <Text style={styles.label}>
        Upload Government-Issued Photo ID{" "}
        <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TouchableOpacity style={styles.uploadButton} onPress={handleIdUpload}>
        <Text style={styles.uploadButtonText}>
          {formData.idPhoto ? "Change ID Photo" : "Select ID Photo"}
        </Text>
      </TouchableOpacity>
      <Text style={styles.helperText}>
        Accepted: Driver's license, State ID, or Passport
      </Text>

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
        onPress={() =>
          handleChange("isAuthorizedToWork", !formData.isAuthorizedToWork)
        }
        label="I am legally authorized to work in the United States *"
      />

      <Checkbox
        checked={formData.hasValidDriversLicense}
        onPress={() =>
          handleChange(
            "hasValidDriversLicense",
            !formData.hasValidDriversLicense
          )
        }
        label="I have a valid driver's license"
      />

      <Checkbox
        checked={formData.hasReliableTransportation}
        onPress={() =>
          handleChange(
            "hasReliableTransportation",
            !formData.hasReliableTransportation
          )
        }
        label="I have reliable transportation to get to job sites *"
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.label}>Cleaning Experience (Optional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Describe your cleaning experience (years, types of cleaning, skills)"
        value={formData.experience}
        onChangeText={(text) => handleChange("experience", text)}
        multiline
        numberOfLines={4}
      />
      <Text style={styles.helperText}>No experience is fine.</Text>
    </>
  );

  // Step 4: Professional References
  const renderStep4 = () => (
    <>
      <Text style={styles.sectionTitle}>Professional Reference</Text>
      <Text style={styles.description}>
        Please provide 1 professional reference who can speak to your work
        ethic, reliability, and trustworthiness. Reference should NOT be a
        family member.
      </Text>

      {formData.references.map((ref, index) => (
        <View key={index} style={styles.referenceCard}>
          <Text style={styles.referenceHeader}>
            Reference {index + 1} <Text style={styles.requiredLabel}>*</Text>
          </Text>

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
            onChangeText={(text) =>
              handleReferenceChange(index, "relationship", text)
            }
          />

          <Text style={styles.label}>Company/Organization</Text>
          <TextInput
            style={styles.input}
            placeholder="Where you worked together"
            value={ref.company}
            onChangeText={(text) =>
              handleReferenceChange(index, "company", text)
            }
          />

          <Text style={styles.label}>How Long Have You Known This Person?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 3 years"
            value={ref.yearsKnown}
            onChangeText={(text) =>
              handleReferenceChange(index, "yearsKnown", text)
            }
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

      <Text style={styles.label}>
        Contact Name <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={formData.emergencyContactName}
        onChangeText={(text) => handleChange("emergencyContactName", text)}
      />

      <Text style={styles.label}>
        Contact Phone <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="(555) 555-5555"
        value={formData.emergencyContactPhone}
        onChangeText={(text) => handleChange("emergencyContactPhone", text)}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>
        Relationship <Text style={styles.requiredLabel}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Spouse, Parent, Sibling"
        value={formData.emergencyContactRelation}
        onChangeText={(text) => handleChange("emergencyContactRelation", text)}
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Criminal History Disclosure</Text>
      <Text style={styles.description}>
        A criminal record does not automatically disqualify you. We review each
        application individually and consider the nature of offenses, time
        elapsed, and rehabilitation.
      </Text>

      <Checkbox
        checked={formData.hasCriminalHistory}
        onPress={() =>
          handleChange("hasCriminalHistory", !formData.hasCriminalHistory)
        }
        label="I have been convicted of a felony or misdemeanor"
      />

      {formData.hasCriminalHistory && (
        <>
          <Text style={styles.label}>
            Please Explain <Text style={styles.requiredLabel}>*</Text>
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe the nature of the offense(s), when they occurred, and any steps you've taken toward rehabilitation."
            value={formData.criminalHistoryExplanation}
            onChangeText={(text) =>
              handleChange("criminalHistoryExplanation", text)
            }
            multiline
            numberOfLines={5}
          />
        </>
      )}
    </>
  );

  // Step 6: Consents
  const renderStep6 = () => (
    <>
      <Text style={styles.label}>
        Why Do You Want to Work With Us?{" "}
        <Text style={styles.requiredLabel}>*</Text>
      </Text>
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
        By checking the boxes below, you authorize us to conduct the following
        screenings:
      </Text>

      <Checkbox
        checked={formData.backgroundConsent}
        onPress={() =>
          handleChange("backgroundConsent", !formData.backgroundConsent)
        }
        label="I consent to a comprehensive background check, including criminal history, identity verification, and employment history. *"
      />

      <Checkbox
        checked={formData.referenceCheckConsent}
        onPress={() =>
          handleChange("referenceCheckConsent", !formData.referenceCheckConsent)
        }
        label="I consent to having my professional references contacted. *"
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.sectionTitle}>Terms and Conditions</Text>
      <View style={localStyles.termsContainer}>
        <View style={localStyles.termsRow}>
          <TouchableOpacity
            style={[
              localStyles.termsCheckbox,
              formData.termsAccepted && localStyles.termsCheckboxChecked,
            ]}
            onPress={() => {
              if (!formData.termsAccepted) {
                setShowTermsModal(true);
              } else {
                handleChange("termsAccepted", false);
                handleChange("termsId", null);
              }
            }}
          >
            {formData.termsAccepted && (
              <Text style={localStyles.termsCheckmark}>✓</Text>
            )}
          </TouchableOpacity>
          <View style={localStyles.termsTextContainer}>
            <Text style={localStyles.termsLabel}>
              I agree to the{" "}
              <Text
                style={localStyles.termsLink}
                onPress={() => setShowTermsModal(true)}
              >
                Terms and Conditions
              </Text>
              {" *"}
            </Text>
          </View>
        </View>
        {formData.termsAccepted && (
          <Text style={localStyles.termsAcceptedText}>Terms accepted</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Privacy Policy</Text>
      <View style={localStyles.termsContainer}>
        <View style={localStyles.termsRow}>
          <TouchableOpacity
            style={[
              localStyles.termsCheckbox,
              formData.privacyPolicyAccepted &&
                localStyles.termsCheckboxChecked,
            ]}
            onPress={() => {
              if (!formData.privacyPolicyAccepted) {
                setShowPrivacyModal(true);
              } else {
                handleChange("privacyPolicyAccepted", false);
                handleChange("privacyPolicyId", null);
              }
            }}
          >
            {formData.privacyPolicyAccepted && (
              <Text style={localStyles.termsCheckmark}>✓</Text>
            )}
          </TouchableOpacity>
          <View style={localStyles.termsTextContainer}>
            <Text style={localStyles.termsLabel}>
              I agree to the{" "}
              <Text
                style={localStyles.termsLink}
                onPress={() => setShowPrivacyModal(true)}
              >
                Privacy Policy
              </Text>
              {" *"}
            </Text>
          </View>
        </View>
        {formData.privacyPolicyAccepted && (
          <Text style={localStyles.termsAcceptedText}>
            Privacy policy accepted
          </Text>
        )}
      </View>

      <Text style={styles.legalText}>
        By submitting this application, I certify that all information provided
        is true and complete to the best of my knowledge. I understand that any
        false statements or omissions may result in disqualification from
        consideration or termination of employment.
      </Text>

      {/* Terms Modal */}
      <TermsModal
        visible={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        onAccept={handleTermsAccepted}
        type="cleaner"
      />

      {/* Privacy Policy Modal */}
      <TermsModal
        visible={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        onAccept={handlePrivacyAccepted}
        type="privacy_policy"
        title="Privacy Policy"
      />
    </>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return renderStep1();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Back to landing button */}
      <TouchableOpacity
        onPress={() => setShowForm(false)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: spacing.lg,
          alignSelf: "flex-start",
        }}
      >
        <Text
          style={{
            color: colors.primary[600],
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.medium,
          }}
        >
          ← Back
        </Text>
      </TouchableOpacity>

      <Text style={styles.title}>Join the Kleanr Team</Text>
      <Text style={styles.description}>
        You're just a few steps away from becoming your own boss and earning
        great money on your own schedule. This application takes about 5
        minutes.
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

const localStyles = StyleSheet.create({
  termsContainer: {
    marginVertical: 12,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  termsCheckbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.primary[600],
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  termsCheckboxChecked: {
    backgroundColor: colors.primary[600],
  },
  termsCheckmark: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  termsTextContainer: {
    flex: 1,
  },
  termsLabel: {
    fontSize: 14,
    color: "#374151",
  },
  termsLink: {
    color: colors.primary[600],
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  termsAcceptedText: {
    fontSize: 12,
    color: colors.success ? colors.success[600] : "#16a34a",
    marginLeft: 36,
    marginTop: 4,
  },
});

export default CleanerApplicationForm;
