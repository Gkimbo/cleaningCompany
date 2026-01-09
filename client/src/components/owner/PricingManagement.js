import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";
import PricingService from "../../services/fetchRequests/PricingService";
import PricingWarningModal from "./PricingWarningModal";
import { usePricing } from "../../context/PricingContext";

const PricingManagement = ({ state }) => {
  const navigate = useNavigate();
  const { refreshPricing } = usePricing();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalValues, setOriginalValues] = useState(null);

  // Form state for all pricing fields
  const [formData, setFormData] = useState({
    basePrice: "",
    extraBedBathFee: "",
    halfBathFee: "",
    sheetFeePerBed: "",
    towelFee: "",
    faceClothFee: "",
    timeWindowAnytime: "",
    timeWindow10To3: "",
    timeWindow11To4: "",
    timeWindow12To2: "",
    cancellationFee: "",
    cancellationWindowDays: "",
    homeownerPenaltyDays: "",
    cleanerPenaltyDays: "",
    refundPercentage: "",
    platformFeePercent: "",
    businessOwnerFeePercent: "",
    largeBusinessFeePercent: "",
    largeBusinessMonthlyThreshold: "",
    largeBusinessLookbackMonths: "",
    multiCleanerPlatformFeePercent: "",
    highVolumeFee: "",
    incentiveRefundPercent: "",
    incentiveCleanerPercent: "",
    lastMinuteFee: "",
    lastMinuteThresholdHours: "",
    lastMinuteNotificationRadiusMiles: "",
    changeNote: "",
    exampleOriginalPrice: "150",
    exampleDiscountPercent: "50",
    exampleCleaningPrice: "150",
    exampleBusinessOwnerPrice: "200",
    exampleLargeBusinessPrice: "200",
    exampleMultiCleanerPrice: "300",
    // Base pricing calculator
    exampleBeds: "3",
    exampleBaths: "2.5",
    // Linen calculator
    exampleLinenBeds: "3",
    exampleTowelsPerBath: "2",
    exampleFaceClothsPerBath: "1",
    exampleLinenBaths: "2",
    // Cancellation calculator
    exampleCancellationPrice: "200",
    // Last-minute calculator
    exampleLastMinutePrice: "175",
  });

  useEffect(() => {
    fetchPricingConfig();
  }, []);

  const fetchPricingConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await PricingService.getFullConfig(state.currentUser.token);

      if (result) {
        let values;
        if (result.config) {
          // Database config exists
          values = {
            basePrice: result.config.basePrice?.toString() || "",
            extraBedBathFee: result.config.extraBedBathFee?.toString() || "",
            halfBathFee: result.config.halfBathFee?.toString() || "",
            sheetFeePerBed: result.config.sheetFeePerBed?.toString() || "",
            towelFee: result.config.towelFee?.toString() || "",
            faceClothFee: result.config.faceClothFee?.toString() || "",
            timeWindowAnytime: result.config.timeWindowAnytime?.toString() || "",
            timeWindow10To3: result.config.timeWindow10To3?.toString() || "",
            timeWindow11To4: result.config.timeWindow11To4?.toString() || "",
            timeWindow12To2: result.config.timeWindow12To2?.toString() || "",
            cancellationFee: result.config.cancellationFee?.toString() || "",
            cancellationWindowDays: result.config.cancellationWindowDays?.toString() || "",
            homeownerPenaltyDays: result.config.homeownerPenaltyDays?.toString() || "",
            cleanerPenaltyDays: result.config.cleanerPenaltyDays?.toString() || "",
            refundPercentage: (parseFloat(result.config.refundPercentage) * 100).toString() || "",
            platformFeePercent: (parseFloat(result.config.platformFeePercent) * 100).toString() || "",
            businessOwnerFeePercent: (parseFloat(result.config.businessOwnerFeePercent || result.config.platformFeePercent) * 100).toString() || "",
            largeBusinessFeePercent: (parseFloat(result.config.largeBusinessFeePercent || 0.07) * 100).toString() || "7",
            largeBusinessMonthlyThreshold: result.config.largeBusinessMonthlyThreshold?.toString() || "50",
            largeBusinessLookbackMonths: result.config.largeBusinessLookbackMonths?.toString() || "1",
            multiCleanerPlatformFeePercent: (parseFloat(result.config.multiCleanerPlatformFeePercent || 0.13) * 100).toString() || "13",
            highVolumeFee: result.config.highVolumeFee?.toString() || "",
            incentiveRefundPercent: (parseFloat(result.config.incentiveRefundPercent || 0.10) * 100).toString() || "10",
            incentiveCleanerPercent: (parseFloat(result.config.incentiveCleanerPercent || 0.40) * 100).toString() || "40",
            lastMinuteFee: result.config.lastMinuteFee?.toString() || "50",
            lastMinuteThresholdHours: result.config.lastMinuteThresholdHours?.toString() || "48",
            lastMinuteNotificationRadiusMiles: result.config.lastMinuteNotificationRadiusMiles?.toString() || "25",
            changeNote: "",
          };
        } else if (result.staticDefaults) {
          // Use static defaults
          values = {
            basePrice: result.staticDefaults.basePrice?.toString() || "",
            extraBedBathFee: result.staticDefaults.extraBedBathFee?.toString() || "",
            halfBathFee: result.staticDefaults.halfBathFee?.toString() || "",
            sheetFeePerBed: result.staticDefaults.sheetFeePerBed?.toString() || "",
            towelFee: result.staticDefaults.towelFee?.toString() || "",
            faceClothFee: result.staticDefaults.faceClothFee?.toString() || "",
            timeWindowAnytime: result.staticDefaults.timeWindowAnytime?.toString() || "",
            timeWindow10To3: result.staticDefaults.timeWindow10To3?.toString() || "",
            timeWindow11To4: result.staticDefaults.timeWindow11To4?.toString() || "",
            timeWindow12To2: result.staticDefaults.timeWindow12To2?.toString() || "",
            cancellationFee: result.staticDefaults.cancellationFee?.toString() || "",
            cancellationWindowDays: result.staticDefaults.cancellationWindowDays?.toString() || "",
            homeownerPenaltyDays: result.staticDefaults.homeownerPenaltyDays?.toString() || "",
            cleanerPenaltyDays: result.staticDefaults.cleanerPenaltyDays?.toString() || "",
            refundPercentage: (result.staticDefaults.refundPercentage * 100).toString() || "",
            platformFeePercent: (result.staticDefaults.platformFeePercent * 100).toString() || "",
            businessOwnerFeePercent: ((result.staticDefaults.businessOwnerFeePercent || result.staticDefaults.platformFeePercent) * 100).toString() || "",
            largeBusinessFeePercent: ((result.staticDefaults.largeBusinessFeePercent || 0.07) * 100).toString() || "7",
            largeBusinessMonthlyThreshold: result.staticDefaults.largeBusinessMonthlyThreshold?.toString() || "50",
            largeBusinessLookbackMonths: result.staticDefaults.largeBusinessLookbackMonths?.toString() || "1",
            multiCleanerPlatformFeePercent: ((result.staticDefaults.multiCleanerPlatformFeePercent || 0.13) * 100).toString() || "13",
            highVolumeFee: result.staticDefaults.highVolumeFee?.toString() || "",
            incentiveRefundPercent: ((result.staticDefaults.incentiveRefundPercent || 0.10) * 100).toString() || "10",
            incentiveCleanerPercent: ((result.staticDefaults.incentiveCleanerPercent || 0.40) * 100).toString() || "40",
            lastMinuteFee: result.staticDefaults.lastMinuteFee?.toString() || "50",
            lastMinuteThresholdHours: result.staticDefaults.lastMinuteThresholdHours?.toString() || "48",
            lastMinuteNotificationRadiusMiles: result.staticDefaults.lastMinuteNotificationRadiusMiles?.toString() || "25",
            changeNote: "",
          };
        }

        if (values) {
          setFormData(values);
          setOriginalValues(values);
        }
      }
    } catch (err) {
      setError("Failed to load pricing configuration");
      console.error("Error fetching pricing config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Check if values have changed from original
    // Exclude changeNote and calculator fields from change detection
    if (originalValues) {
      const excludeFromChangeDetection = ["changeNote", "exampleOriginalPrice", "exampleDiscountPercent", "exampleCleaningPrice", "exampleBusinessOwnerPrice", "exampleLargeBusinessPrice", "exampleMultiCleanerPrice"];
      const changed = Object.keys(originalValues).some(
        (key) => !excludeFromChangeDetection.includes(key) && newFormData[key] !== originalValues[key]
      );
      setHasChanges(changed);
    }
  };

  const handleSavePress = () => {
    if (!hasChanges) {
      setError("No changes to save");
      return;
    }

    // Validate inputs
    const numericFields = [
      "basePrice",
      "extraBedBathFee",
      "halfBathFee",
      "sheetFeePerBed",
      "towelFee",
      "faceClothFee",
      "timeWindowAnytime",
      "timeWindow10To3",
      "timeWindow11To4",
      "timeWindow12To2",
      "cancellationFee",
      "cancellationWindowDays",
      "homeownerPenaltyDays",
      "cleanerPenaltyDays",
      "refundPercentage",
      "platformFeePercent",
      "businessOwnerFeePercent",
      "largeBusinessFeePercent",
      "largeBusinessMonthlyThreshold",
      "largeBusinessLookbackMonths",
      "multiCleanerPlatformFeePercent",
      "highVolumeFee",
      "incentiveRefundPercent",
      "incentiveCleanerPercent",
      "lastMinuteFee",
      "lastMinuteThresholdHours",
      "lastMinuteNotificationRadiusMiles",
    ];

    for (const field of numericFields) {
      const value = parseFloat(formData[field]);
      if (isNaN(value) || value < 0) {
        setError(`Invalid value for ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        return;
      }
    }

    // Validate percentages
    const refund = parseFloat(formData.refundPercentage);
    const platform = parseFloat(formData.platformFeePercent);
    const incentiveRefund = parseFloat(formData.incentiveRefundPercent);
    const incentiveCleaner = parseFloat(formData.incentiveCleanerPercent);
    if (refund < 0 || refund > 100) {
      setError("Refund percentage must be between 0 and 100");
      return;
    }
    if (platform < 0 || platform > 100) {
      setError("Platform fee percentage must be between 0 and 100");
      return;
    }
    const businessOwnerFee = parseFloat(formData.businessOwnerFeePercent);
    if (businessOwnerFee < 0 || businessOwnerFee > 100) {
      setError("Business owner fee percentage must be between 0 and 100");
      return;
    }
    if (incentiveRefund < 0 || incentiveRefund > 100) {
      setError("Incentive refund percentage must be between 0 and 100");
      return;
    }
    if (incentiveCleaner < 0 || incentiveCleaner > 100) {
      setError("Incentive cleaner percentage must be between 0 and 100");
      return;
    }
    const largeBusiness = parseFloat(formData.largeBusinessFeePercent);
    if (largeBusiness < 0 || largeBusiness > 100) {
      setError("Large business fee percentage must be between 0 and 100");
      return;
    }
    const multiCleaner = parseFloat(formData.multiCleanerPlatformFeePercent);
    if (multiCleaner < 0 || multiCleaner > 100) {
      setError("Multi-cleaner fee percentage must be between 0 and 100");
      return;
    }

    setError(null);
    setShowWarningModal(true);
  };

  const handleConfirmSave = async () => {
    setSaving(true);
    setShowWarningModal(false);
    setError(null);
    setSuccess(null);

    try {
      const pricingData = {
        basePrice: parseInt(formData.basePrice),
        extraBedBathFee: parseInt(formData.extraBedBathFee),
        halfBathFee: parseInt(formData.halfBathFee),
        sheetFeePerBed: parseInt(formData.sheetFeePerBed),
        towelFee: parseInt(formData.towelFee),
        faceClothFee: parseInt(formData.faceClothFee),
        timeWindowAnytime: parseInt(formData.timeWindowAnytime),
        timeWindow10To3: parseInt(formData.timeWindow10To3),
        timeWindow11To4: parseInt(formData.timeWindow11To4),
        timeWindow12To2: parseInt(formData.timeWindow12To2),
        cancellationFee: parseInt(formData.cancellationFee),
        cancellationWindowDays: parseInt(formData.cancellationWindowDays),
        homeownerPenaltyDays: parseInt(formData.homeownerPenaltyDays),
        cleanerPenaltyDays: parseInt(formData.cleanerPenaltyDays),
        refundPercentage: parseFloat(formData.refundPercentage) / 100,
        platformFeePercent: parseFloat(formData.platformFeePercent) / 100,
        businessOwnerFeePercent: parseFloat(formData.businessOwnerFeePercent) / 100,
        largeBusinessFeePercent: parseFloat(formData.largeBusinessFeePercent) / 100,
        largeBusinessMonthlyThreshold: parseInt(formData.largeBusinessMonthlyThreshold),
        largeBusinessLookbackMonths: parseInt(formData.largeBusinessLookbackMonths),
        multiCleanerPlatformFeePercent: parseFloat(formData.multiCleanerPlatformFeePercent) / 100,
        highVolumeFee: parseInt(formData.highVolumeFee),
        incentiveRefundPercent: parseFloat(formData.incentiveRefundPercent) / 100,
        incentiveCleanerPercent: parseFloat(formData.incentiveCleanerPercent) / 100,
        lastMinuteFee: parseInt(formData.lastMinuteFee),
        lastMinuteThresholdHours: parseInt(formData.lastMinuteThresholdHours),
        lastMinuteNotificationRadiusMiles: parseFloat(formData.lastMinuteNotificationRadiusMiles),
        changeNote: formData.changeNote || null,
      };

      const result = await PricingService.updatePricing(
        state.currentUser.token,
        pricingData
      );

      if (result.success) {
        setSuccess("Pricing updated successfully!");
        setHasChanges(false);
        setOriginalValues({ ...formData });
        // Refresh the pricing context
        refreshPricing();
      } else {
        setError(result.error || "Failed to update pricing");
      }
    } catch (err) {
      setError("Failed to save pricing configuration");
      console.error("Error saving pricing:", err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrentValue = (field, prefix, suffix) => {
    if (!originalValues || !originalValues[field]) return null;
    const value = originalValues[field];
    return `${prefix}${value}${suffix}`;
  };

  const hasFieldChanged = (field) => {
    if (!originalValues) return false;
    return formData[field] !== originalValues[field];
  };

  const renderPriceInput = (label, field, prefix = "$", suffix = "", helpText = null) => {
    const currentValue = formatCurrentValue(field, prefix, suffix);
    const changed = hasFieldChanged(field);

    return (
      <View style={styles.inputGroup}>
        <View style={styles.labelRow}>
          <Text style={styles.inputLabel}>{label}</Text>
          {currentValue && (
            <View style={[styles.currentValueBadge, changed && styles.currentValueBadgeChanged]}>
              <Text style={styles.currentValueLabel}>Current:</Text>
              <Text style={[styles.currentValueText, changed && styles.currentValueTextChanged]}>
                {currentValue}
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.inputWrapper, changed && styles.inputWrapperChanged]}>
          {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
          <TextInput
            style={[styles.input, prefix && styles.inputWithPrefix, suffix && styles.inputWithSuffix]}
            value={formData[field]}
            onChangeText={(value) => handleInputChange(field, value)}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.text.tertiary}
          />
          {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
          {changed && (
            <View style={styles.changedIndicator}>
              <Icon name="pencil" size={12} color={colors.warning[600]} />
            </View>
          )}
        </View>
        {helpText && <Text style={styles.inputHelp}>{helpText}</Text>}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading pricing configuration...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigate(-1)} style={styles.backButton}>
          <Icon name="arrow-left" size={16} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Manage Pricing</Text>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info-circle" size={20} color={colors.primary[600]} />
        <Text style={styles.infoBannerText}>
          Changes will apply to all new bookings. Existing appointments are not affected.
        </Text>
      </View>

      {/* Base Pricing Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Base Pricing</Text>
        <Text style={styles.sectionDescription}>
          Starting prices for cleaning services
        </Text>
        {renderPriceInput("Base Price (1 bed/1 bath)", "basePrice", "$", "", "Starting price for a standard cleaning")}
        {renderPriceInput("Extra Bed/Bath Fee", "extraBedBathFee", "$", "", "Additional charge per extra bedroom or full bathroom")}
        {renderPriceInput("Half Bath Fee", "halfBathFee", "$", "", "Additional charge per half bathroom")}

        {/* Base Pricing Calculator */}
        {(() => {
          const basePrice = parseFloat(formData.basePrice) || 150;
          const extraBedBathFee = parseFloat(formData.extraBedBathFee) || 50;
          const halfBathFee = parseFloat(formData.halfBathFee) || 25;
          const beds = parseInt(formData.exampleBeds) || 3;
          const baths = parseFloat(formData.exampleBaths) || 2;
          const fullBaths = Math.floor(baths);
          const hasHalfBath = (baths % 1) >= 0.5;

          const extraBeds = Math.max(0, beds - 1);
          const extraFullBaths = Math.max(0, fullBaths - 1);
          const halfBathCount = hasHalfBath ? 1 : 0;

          const totalPrice = basePrice + (extraBeds * extraBedBathFee) + (extraFullBaths * extraBedBathFee) + (halfBathCount * halfBathFee);

          return (
            <View style={[styles.miniCalculator, styles.miniCalculatorBlue]}>
              <View style={styles.miniCalcHeader}>
                <Icon name="home" size={14} color={colors.primary[500]} />
                <Text style={styles.miniCalcTitle}>Price Calculator</Text>
              </View>

              <View style={styles.calcInputGrid}>
                <View style={styles.calcInputItem}>
                  <Text style={styles.calcInputLabel}>Bedrooms</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <TextInput
                      style={[styles.miniCalcInput, styles.calcInputCentered]}
                      value={formData.exampleBeds}
                      onChangeText={(value) => handleInputChange("exampleBeds", value)}
                      keyboardType="numeric"
                      placeholder="3"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.calcInputItem}>
                  <Text style={styles.calcInputLabel}>Bathrooms</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <TextInput
                      style={[styles.miniCalcInput, styles.calcInputCentered]}
                      value={formData.exampleBaths}
                      onChangeText={(value) => handleInputChange("exampleBaths", value)}
                      keyboardType="decimal-pad"
                      placeholder="2.5"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.miniCalcResults}>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Base (1 bed/1 bath):</Text>
                  <Text style={styles.miniCalcRowValue}>${basePrice.toFixed(2)}</Text>
                </View>
                {extraBeds > 0 && (
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Extra beds ({extraBeds} × ${extraBedBathFee}):</Text>
                    <Text style={styles.miniCalcRowValue}>+${(extraBeds * extraBedBathFee).toFixed(2)}</Text>
                  </View>
                )}
                {extraFullBaths > 0 && (
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Extra full baths ({extraFullBaths} × ${extraBedBathFee}):</Text>
                    <Text style={styles.miniCalcRowValue}>+${(extraFullBaths * extraBedBathFee).toFixed(2)}</Text>
                  </View>
                )}
                {hasHalfBath && (
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Half bath:</Text>
                    <Text style={styles.miniCalcRowValue}>+${halfBathFee.toFixed(2)}</Text>
                  </View>
                )}
                <View style={[styles.miniCalcRow, styles.miniCalcRowTotal]}>
                  <Text style={styles.miniCalcRowLabelBold}>Cleaning Price:</Text>
                  <Text style={[styles.miniCalcRowValueLarge, styles.miniCalcValueGreen]}>${totalPrice.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.calcQuickExamples}>
                <Text style={styles.calcQuickTitle}>Quick Examples:</Text>
                <View style={styles.calcQuickRow}>
                  <Text style={styles.calcQuickLabel}>1 bed / 1 bath:</Text>
                  <Text style={styles.calcQuickValue}>${basePrice.toFixed(0)}</Text>
                </View>
                <View style={styles.calcQuickRow}>
                  <Text style={styles.calcQuickLabel}>2 bed / 2 bath:</Text>
                  <Text style={styles.calcQuickValue}>${(basePrice + extraBedBathFee + extraBedBathFee).toFixed(0)}</Text>
                </View>
                <View style={styles.calcQuickRow}>
                  <Text style={styles.calcQuickLabel}>4 bed / 3.5 bath:</Text>
                  <Text style={styles.calcQuickValue}>${(basePrice + (3 * extraBedBathFee) + (2 * extraBedBathFee) + halfBathFee).toFixed(0)}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Linen Services Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linen Services</Text>
        <Text style={styles.sectionDescription}>
          Charges for providing linens
        </Text>
        {renderPriceInput("Sheet Fee (per bed)", "sheetFeePerBed", "$", "/bed")}
        {renderPriceInput("Towel Fee (per towel)", "towelFee", "$", "/towel")}
        {renderPriceInput("Face Cloth Fee (each)", "faceClothFee", "$", "/each")}

        {/* Linen Calculator */}
        {(() => {
          const sheetFeePerBed = parseFloat(formData.sheetFeePerBed) || 30;
          const towelFee = parseFloat(formData.towelFee) || 5;
          const faceClothFee = parseFloat(formData.faceClothFee) || 2;
          const beds = parseInt(formData.exampleLinenBeds) || 3;
          const baths = parseInt(formData.exampleLinenBaths) || 2;
          const towelsPerBath = parseInt(formData.exampleTowelsPerBath) || 2;
          const faceClothsPerBath = parseInt(formData.exampleFaceClothsPerBath) || 1;

          const sheetsTotal = beds * sheetFeePerBed;
          const totalTowels = baths * towelsPerBath;
          const totalFaceCloths = baths * faceClothsPerBath;
          const towelsTotal = totalTowels * towelFee;
          const faceClothsTotal = totalFaceCloths * faceClothFee;
          const linensTotal = sheetsTotal + towelsTotal + faceClothsTotal;

          return (
            <View style={[styles.miniCalculator, styles.miniCalculatorCyan]}>
              <View style={styles.miniCalcHeader}>
                <Icon name="bed" size={14} color="#0891b2" />
                <Text style={styles.miniCalcTitle}>Linen Cost Calculator</Text>
              </View>

              <View style={styles.calcInputGrid}>
                <View style={styles.calcInputItem}>
                  <Text style={styles.calcInputLabel}>Beds</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <TextInput
                      style={[styles.miniCalcInput, styles.calcInputCentered]}
                      value={formData.exampleLinenBeds}
                      onChangeText={(value) => handleInputChange("exampleLinenBeds", value)}
                      keyboardType="numeric"
                      placeholder="3"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.calcInputItem}>
                  <Text style={styles.calcInputLabel}>Baths</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <TextInput
                      style={[styles.miniCalcInput, styles.calcInputCentered]}
                      value={formData.exampleLinenBaths}
                      onChangeText={(value) => handleInputChange("exampleLinenBaths", value)}
                      keyboardType="numeric"
                      placeholder="2"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.calcInputGrid}>
                <View style={styles.calcInputItem}>
                  <Text style={styles.calcInputLabel}>Towels/bath</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <TextInput
                      style={[styles.miniCalcInput, styles.calcInputCentered]}
                      value={formData.exampleTowelsPerBath}
                      onChangeText={(value) => handleInputChange("exampleTowelsPerBath", value)}
                      keyboardType="numeric"
                      placeholder="2"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.calcInputItem}>
                  <Text style={styles.calcInputLabel}>Face cloths/bath</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <TextInput
                      style={[styles.miniCalcInput, styles.calcInputCentered]}
                      value={formData.exampleFaceClothsPerBath}
                      onChangeText={(value) => handleInputChange("exampleFaceClothsPerBath", value)}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.miniCalcResults}>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Sheets ({beds} beds × ${sheetFeePerBed}):</Text>
                  <Text style={styles.miniCalcRowValue}>${sheetsTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Towels ({totalTowels} × ${towelFee}):</Text>
                  <Text style={styles.miniCalcRowValue}>${towelsTotal.toFixed(2)}</Text>
                </View>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Face cloths ({totalFaceCloths} × ${faceClothFee}):</Text>
                  <Text style={styles.miniCalcRowValue}>${faceClothsTotal.toFixed(2)}</Text>
                </View>
                <View style={[styles.miniCalcRow, styles.miniCalcRowTotal]}>
                  <Text style={styles.miniCalcRowLabelBold}>Total Linen Add-on:</Text>
                  <Text style={[styles.miniCalcRowValueLarge, styles.miniCalcValueCyan]}>+${linensTotal.toFixed(2)}</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Time Windows Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time Window Surcharges</Text>
        <Text style={styles.sectionDescription}>
          Additional charges for specific arrival time windows
        </Text>
        {renderPriceInput("Anytime (flexible)", "timeWindowAnytime", "$", "", "Usually $0 for maximum flexibility")}
        {renderPriceInput("10am - 3pm Window", "timeWindow10To3", "$")}
        {renderPriceInput("11am - 4pm Window", "timeWindow11To4", "$")}
        {renderPriceInput("12pm - 2pm Window", "timeWindow12To2", "$", "", "Narrowest window, highest surcharge")}

        {/* Time Window Visual Comparison */}
        {(() => {
          const anytime = parseFloat(formData.timeWindowAnytime) || 0;
          const window10to3 = parseFloat(formData.timeWindow10To3) || 25;
          const window11to4 = parseFloat(formData.timeWindow11To4) || 25;
          const window12to2 = parseFloat(formData.timeWindow12To2) || 30;
          const basePrice = parseFloat(formData.basePrice) || 150;
          const maxSurcharge = Math.max(anytime, window10to3, window11to4, window12to2, 1);

          const windows = [
            { label: "Anytime", hours: "Flexible", surcharge: anytime, color: colors.success[500], width: 100 },
            { label: "10am-3pm", hours: "5 hours", surcharge: window10to3, color: colors.primary[500], width: 62 },
            { label: "11am-4pm", hours: "5 hours", surcharge: window11to4, color: colors.primary[500], width: 62 },
            { label: "12pm-2pm", hours: "2 hours", surcharge: window12to2, color: colors.warning[500], width: 25 },
          ];

          return (
            <View style={[styles.miniCalculator, styles.miniCalculatorGray]}>
              <View style={styles.miniCalcHeader}>
                <Icon name="clock-o" size={14} color={colors.text.secondary} />
                <Text style={styles.miniCalcTitle}>Time Window Comparison</Text>
              </View>

              <View style={styles.timeWindowComparison}>
                {windows.map((window, index) => (
                  <View key={index} style={styles.timeWindowItem}>
                    <View style={styles.timeWindowHeader}>
                      <Text style={styles.timeWindowLabel}>{window.label}</Text>
                      <Text style={styles.timeWindowHours}>{window.hours}</Text>
                    </View>
                    <View style={styles.timeWindowBarContainer}>
                      <View
                        style={[
                          styles.timeWindowBar,
                          {
                            width: `${window.width}%`,
                            backgroundColor: window.color,
                          },
                        ]}
                      />
                    </View>
                    <View style={styles.timeWindowPricing}>
                      <Text style={[styles.timeWindowSurcharge, { color: window.surcharge > 0 ? colors.warning[600] : colors.success[600] }]}>
                        {window.surcharge > 0 ? `+$${window.surcharge}` : "Free"}
                      </Text>
                      <Text style={styles.timeWindowTotal}>
                        Total: ${(basePrice + window.surcharge).toFixed(0)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.timeWindowNote}>
                <Icon name="info-circle" size={12} color={colors.text.tertiary} />
                <Text style={styles.timeWindowNoteText}>
                  Narrower windows = higher value to customers = higher surcharge
                </Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Cancellation Policy Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cancellation Policy</Text>
        <Text style={styles.sectionDescription}>
          Fees and timing for cancellations
        </Text>
        {renderPriceInput("Cancellation Fee", "cancellationFee", "$")}
        {renderPriceInput("Free Cancel Window", "cancellationWindowDays", "", " days", "Days before appointment for free cancellation")}
        {renderPriceInput("Homeowner Penalty Days", "homeownerPenaltyDays", "", " days", "Days before when partial refund applies")}
        {renderPriceInput("Cleaner Penalty Days", "cleanerPenaltyDays", "", " days", "Days before when cleaner gets penalty")}
        {renderPriceInput("Client Refund %", "refundPercentage", "", "%", "Client refund when cancelling prepaid appointments within penalty window (e.g., 50% means client gets half back, cleaner gets half minus platform fee)")}

        {/* Cancellation Policy Calculator */}
        {(() => {
          const cancellationFee = parseFloat(formData.cancellationFee) || 25;
          const windowDays = parseInt(formData.cancellationWindowDays) || 7;
          const homeownerPenaltyDays = parseInt(formData.homeownerPenaltyDays) || 3;
          const cleanerPenaltyDays = parseInt(formData.cleanerPenaltyDays) || 4;
          const refundPercent = parseFloat(formData.refundPercentage) / 100 || 0.5;
          const examplePrice = parseFloat(formData.exampleCancellationPrice) || 200;
          const platformFeePercent = parseFloat(formData.platformFeePercent) / 100 || 0.10;

          // Scenario calculations
          const freeCancel = examplePrice; // Full refund
          const penaltyCancel = examplePrice * refundPercent;
          const cleanerPenaltyPayout = examplePrice * (1 - refundPercent) * (1 - platformFeePercent);
          const platformPenaltyFee = examplePrice * (1 - refundPercent) * platformFeePercent;

          return (
            <View style={[styles.miniCalculator, styles.miniCalculatorOrange]}>
              <View style={styles.miniCalcHeader}>
                <Icon name="calendar-times-o" size={14} color={colors.warning[600]} />
                <Text style={styles.miniCalcTitle}>Cancellation Scenarios</Text>
              </View>

              <View style={styles.miniCalcInputRow}>
                <Text style={styles.miniCalcLabel}>Example cleaning price:</Text>
                <View style={styles.miniCalcInputWrapper}>
                  <Text style={styles.miniCalcPrefix}>$</Text>
                  <TextInput
                    style={styles.miniCalcInput}
                    value={formData.exampleCancellationPrice}
                    onChangeText={(value) => handleInputChange("exampleCancellationPrice", value)}
                    keyboardType="numeric"
                    placeholder="200"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>

              <View style={styles.cancellationTimeline}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, styles.timelineDotGreen]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>More than {windowDays} days before</Text>
                    <Text style={styles.timelineDescription}>Free cancellation</Text>
                    <Text style={[styles.timelineValue, styles.timelineValueGreen]}>
                      Full refund: ${examplePrice.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, styles.timelineDotYellow]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>{homeownerPenaltyDays}-{windowDays} days before</Text>
                    <Text style={styles.timelineDescription}>Penalty window + ${cancellationFee} fee</Text>
                    <Text style={[styles.timelineValue, styles.timelineValueOrange]}>
                      Client gets: ${penaltyCancel.toFixed(2)} ({(refundPercent * 100).toFixed(0)}%)
                    </Text>
                    <Text style={styles.timelineSubValue}>
                      Cleaner gets: ${cleanerPenaltyPayout.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, styles.timelineDotRed]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>Less than {homeownerPenaltyDays} days before</Text>
                    <Text style={styles.timelineDescription}>Late cancellation penalty</Text>
                    <Text style={[styles.timelineValue, styles.timelineValueRed]}>
                      Client gets: ${penaltyCancel.toFixed(2)} ({(refundPercent * 100).toFixed(0)}%)
                    </Text>
                    <Text style={styles.timelineSubValue}>
                      Cleaner gets: ${cleanerPenaltyPayout.toFixed(2)} (compensation)
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.miniCalcNote}>
                <Icon name="info-circle" size={12} color={colors.text.tertiary} />
                <Text style={styles.miniCalcNoteText}>
                  Cleaners who cancel within {cleanerPenaltyDays} days receive rating penalties
                </Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Platform Fees Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform Fees</Text>
        <Text style={styles.sectionDescription}>
          Service fees for the platform by cleaner type
        </Text>

        {/* Regular Cleaner Fee */}
        <View style={styles.feeTypeContainer}>
          <View style={styles.feeTypeHeader}>
            <Icon name="user" size={16} color={colors.primary[600]} />
            <Text style={styles.feeTypeTitle}>Regular Cleaners</Text>
          </View>
          {renderPriceInput("Platform Fee", "platformFeePercent", "", "%", "Percentage taken from independent cleaner payouts")}

          {/* Regular Cleaner Calculator */}
          {(() => {
            const feePercent = parseFloat(formData.platformFeePercent) / 100 || 0.10;
            const price = parseFloat(formData.exampleCleaningPrice) || 150;
            const platformFee = price * feePercent;
            const cleanerReceives = price - platformFee;
            const stripeFee = (price * 0.029) + 0.30;
            const platformNet = platformFee - stripeFee;

            return (
              <View style={styles.miniCalculator}>
                <View style={styles.miniCalcHeader}>
                  <Icon name="calculator" size={14} color={colors.primary[500]} />
                  <Text style={styles.miniCalcTitle}>Calculator</Text>
                </View>
                <View style={styles.miniCalcInputRow}>
                  <Text style={styles.miniCalcLabel}>Job price:</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <Text style={styles.miniCalcPrefix}>$</Text>
                    <TextInput
                      style={styles.miniCalcInput}
                      value={formData.exampleCleaningPrice}
                      onChangeText={(value) => handleInputChange("exampleCleaningPrice", value)}
                      keyboardType="numeric"
                      placeholder="150"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.miniCalcResults}>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Cleaner takes home:</Text>
                    <Text style={[styles.miniCalcRowValue, styles.miniCalcValueGreen]}>${cleanerReceives.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Platform fee ({(feePercent * 100).toFixed(0)}%):</Text>
                    <Text style={styles.miniCalcRowValue}>${platformFee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={[styles.miniCalcRowLabel, styles.miniCalcMuted]}>Platform net (after Stripe):</Text>
                    <Text style={[styles.miniCalcRowValue, platformNet > 0 ? styles.miniCalcValueGreen : styles.miniCalcValueRed]}>
                      ${platformNet.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Business Owner Fee */}
        <View style={styles.feeTypeContainer}>
          <View style={styles.feeTypeHeader}>
            <Icon name="briefcase" size={16} color={colors.warning[600]} />
            <Text style={styles.feeTypeTitle}>Business Owners</Text>
          </View>
          {renderPriceInput("Platform Fee", "businessOwnerFeePercent", "", "%", "Percentage taken from business owner cleaner payouts (for their personal clients)")}

          {/* Business Owner Calculator */}
          {(() => {
            const feePercent = parseFloat(formData.businessOwnerFeePercent) / 100 || 0.10;
            const price = parseFloat(formData.exampleBusinessOwnerPrice) || 200;
            const platformFee = price * feePercent;
            const cleanerReceives = price - platformFee;
            const stripeFee = (price * 0.029) + 0.30;
            const platformNet = platformFee - stripeFee;

            return (
              <View style={styles.miniCalculator}>
                <View style={styles.miniCalcHeader}>
                  <Icon name="calculator" size={14} color={colors.warning[500]} />
                  <Text style={styles.miniCalcTitle}>Calculator</Text>
                </View>
                <View style={styles.miniCalcInputRow}>
                  <Text style={styles.miniCalcLabel}>Job price:</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <Text style={styles.miniCalcPrefix}>$</Text>
                    <TextInput
                      style={styles.miniCalcInput}
                      value={formData.exampleBusinessOwnerPrice}
                      onChangeText={(value) => handleInputChange("exampleBusinessOwnerPrice", value)}
                      keyboardType="numeric"
                      placeholder="200"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.miniCalcResults}>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Business owner takes home:</Text>
                    <Text style={[styles.miniCalcRowValue, styles.miniCalcValueGreen]}>${cleanerReceives.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Platform fee ({(feePercent * 100).toFixed(0)}%):</Text>
                    <Text style={styles.miniCalcRowValue}>${platformFee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={[styles.miniCalcRowLabel, styles.miniCalcMuted]}>Platform net (after Stripe):</Text>
                    <Text style={[styles.miniCalcRowValue, platformNet > 0 ? styles.miniCalcValueGreen : styles.miniCalcValueRed]}>
                      ${platformNet.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Large Business Fee */}
        <View style={styles.feeTypeContainer}>
          <View style={styles.feeTypeHeader}>
            <Icon name="building" size={16} color={colors.success[600]} />
            <Text style={styles.feeTypeTitle}>Large Volume Businesses</Text>
          </View>
          <Text style={styles.feeTypeDescription}>
            Discounted rate for high-volume business owners
          </Text>
          {renderPriceInput("Platform Fee", "largeBusinessFeePercent", "", "%", "Reduced fee for qualifying high-volume businesses")}
          {renderPriceInput("Monthly Threshold", "largeBusinessMonthlyThreshold", "", " jobs", "Minimum completed cleanings per month to qualify")}
          {renderPriceInput("Lookback Period", "largeBusinessLookbackMonths", "", " month(s)", "Number of months to calculate volume")}

          {/* Large Business Calculator */}
          {(() => {
            const feePercent = parseFloat(formData.largeBusinessFeePercent) / 100 || 0.07;
            const threshold = parseInt(formData.largeBusinessMonthlyThreshold) || 50;
            const price = parseFloat(formData.exampleLargeBusinessPrice) || 200;
            const platformFee = price * feePercent;
            const cleanerReceives = price - platformFee;
            const stripeFee = (price * 0.029) + 0.30;
            const platformNet = platformFee - stripeFee;
            const regularFeePercent = parseFloat(formData.businessOwnerFeePercent) / 100 || 0.10;
            const regularPlatformFee = price * regularFeePercent;
            const savings = regularPlatformFee - platformFee;

            return (
              <View style={[styles.miniCalculator, styles.miniCalculatorSuccess]}>
                <View style={styles.miniCalcHeader}>
                  <Icon name="calculator" size={14} color={colors.success[500]} />
                  <Text style={styles.miniCalcTitle}>Calculator</Text>
                </View>
                <View style={styles.miniCalcInputRow}>
                  <Text style={styles.miniCalcLabel}>Job price:</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <Text style={styles.miniCalcPrefix}>$</Text>
                    <TextInput
                      style={styles.miniCalcInput}
                      value={formData.exampleLargeBusinessPrice}
                      onChangeText={(value) => handleInputChange("exampleLargeBusinessPrice", value)}
                      keyboardType="numeric"
                      placeholder="200"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.miniCalcResults}>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Business takes home:</Text>
                    <Text style={[styles.miniCalcRowValue, styles.miniCalcValueGreen]}>${cleanerReceives.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Platform fee ({(feePercent * 100).toFixed(0)}%):</Text>
                    <Text style={styles.miniCalcRowValue}>${platformFee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={[styles.miniCalcRowLabel, styles.miniCalcMuted]}>Platform net (after Stripe):</Text>
                    <Text style={[styles.miniCalcRowValue, platformNet > 0 ? styles.miniCalcValueGreen : styles.miniCalcValueRed]}>
                      ${platformNet.toFixed(2)}
                    </Text>
                  </View>
                  <View style={[styles.miniCalcRow, styles.miniCalcRowHighlight]}>
                    <Text style={styles.miniCalcRowLabel}>Savings vs regular rate:</Text>
                    <Text style={[styles.miniCalcRowValue, styles.miniCalcValueGreen]}>${savings.toFixed(2)}/job</Text>
                  </View>
                </View>
                <View style={styles.miniCalcNote}>
                  <Icon name="info-circle" size={12} color={colors.success[600]} />
                  <Text style={styles.miniCalcNoteText}>
                    Qualifies after {threshold}+ cleanings/month
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* Multi-Cleaner/Split Job Fee */}
        <View style={styles.feeTypeContainer}>
          <View style={styles.feeTypeHeader}>
            <Icon name="users" size={16} color={colors.secondary ? colors.secondary[600] : colors.primary[600]} />
            <Text style={styles.feeTypeTitle}>Multi-Cleaner Jobs (Split)</Text>
          </View>
          <Text style={styles.feeTypeDescription}>
            Fee for large homes requiring multiple cleaners
          </Text>
          {renderPriceInput("Platform Fee", "multiCleanerPlatformFeePercent", "", "%", "Higher fee for coordinating multi-cleaner jobs")}

          {/* Multi-Cleaner Calculator */}
          {(() => {
            const feePercent = parseFloat(formData.multiCleanerPlatformFeePercent) / 100 || 0.13;
            const totalPrice = parseFloat(formData.exampleMultiCleanerPrice) || 300;
            const numCleaners = 2; // Example: 2 cleaners splitting
            const pricePerCleaner = totalPrice / numCleaners;
            const platformFeePerCleaner = pricePerCleaner * feePercent;
            const cleanerReceivesEach = pricePerCleaner - platformFeePerCleaner;
            const totalPlatformFee = platformFeePerCleaner * numCleaners;
            const stripeFee = (totalPrice * 0.029) + 0.30;
            const platformNet = totalPlatformFee - stripeFee;

            return (
              <View style={[styles.miniCalculator, styles.miniCalculatorPurple]}>
                <View style={styles.miniCalcHeader}>
                  <Icon name="calculator" size={14} color={colors.secondary ? colors.secondary[500] : colors.primary[500]} />
                  <Text style={styles.miniCalcTitle}>Calculator (2 cleaners)</Text>
                </View>
                <View style={styles.miniCalcInputRow}>
                  <Text style={styles.miniCalcLabel}>Total job price:</Text>
                  <View style={styles.miniCalcInputWrapper}>
                    <Text style={styles.miniCalcPrefix}>$</Text>
                    <TextInput
                      style={styles.miniCalcInput}
                      value={formData.exampleMultiCleanerPrice}
                      onChangeText={(value) => handleInputChange("exampleMultiCleanerPrice", value)}
                      keyboardType="numeric"
                      placeholder="300"
                      placeholderTextColor={colors.text.tertiary}
                    />
                  </View>
                </View>
                <View style={styles.miniCalcResults}>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Each cleaner's share:</Text>
                    <Text style={styles.miniCalcRowValue}>${pricePerCleaner.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Each cleaner takes home:</Text>
                    <Text style={[styles.miniCalcRowValue, styles.miniCalcValueGreen]}>${cleanerReceivesEach.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={styles.miniCalcRowLabel}>Platform fee ({(feePercent * 100).toFixed(0)}% each):</Text>
                    <Text style={styles.miniCalcRowValue}>${totalPlatformFee.toFixed(2)} total</Text>
                  </View>
                  <View style={styles.miniCalcRow}>
                    <Text style={[styles.miniCalcRowLabel, styles.miniCalcMuted]}>Platform net (after Stripe):</Text>
                    <Text style={[styles.miniCalcRowValue, platformNet > 0 ? styles.miniCalcValueGreen : styles.miniCalcValueRed]}>
                      ${platformNet.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View style={styles.miniCalcNote}>
                  <Icon name="info-circle" size={12} color={colors.text.tertiary} />
                  <Text style={styles.miniCalcNoteText}>
                    Large homes (3+ beds AND 3+ baths) require multiple cleaners
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>

        {/* High Volume Day Fee */}
        <View style={styles.feeTypeContainer}>
          <View style={styles.feeTypeHeader}>
            <Icon name="calendar" size={16} color={colors.error[500]} />
            <Text style={styles.feeTypeTitle}>High Volume Days</Text>
          </View>
          {renderPriceInput("Surcharge", "highVolumeFee", "$", "", "Additional fee for holidays and busy days")}
        </View>
      </View>

      {/* Last-Minute Bookings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last-Minute Bookings</Text>
        <Text style={styles.sectionDescription}>
          Settings for appointments booked on short notice. When a homeowner books within the threshold,
          an extra fee is added and nearby cleaners receive urgent notifications.
        </Text>

        {renderPriceInput("Last-Minute Fee", "lastMinuteFee", "$", "", "Extra flat fee for last-minute bookings")}
        {renderPriceInput("Threshold", "lastMinuteThresholdHours", "", " hours", "Appointments within this many hours are considered last-minute")}
        {renderPriceInput("Notification Radius", "lastMinuteNotificationRadiusMiles", "", " miles", "Distance from property to notify cleaners")}

        {/* Last-Minute Calculator */}
        {(() => {
          const lastMinuteFee = parseFloat(formData.lastMinuteFee) || 50;
          const thresholdHours = parseInt(formData.lastMinuteThresholdHours) || 48;
          const radiusMiles = parseFloat(formData.lastMinuteNotificationRadiusMiles) || 25;
          const basePrice = parseFloat(formData.basePrice) || 150;
          const examplePrice = parseFloat(formData.exampleLastMinutePrice) || 175;
          const totalWithFee = examplePrice + lastMinuteFee;
          const platformFeePercent = parseFloat(formData.platformFeePercent) / 100 || 0.10;
          const cleanerPayout = totalWithFee * (1 - platformFeePercent);
          const bonusFromFee = lastMinuteFee * (1 - platformFeePercent);

          return (
            <View style={[styles.miniCalculator, styles.miniCalculatorRed]}>
              <View style={styles.miniCalcHeader}>
                <Icon name="bolt" size={14} color={colors.error[500]} />
                <Text style={styles.miniCalcTitle}>Last-Minute Booking Calculator</Text>
              </View>

              <View style={styles.miniCalcInputRow}>
                <Text style={styles.miniCalcLabel}>Base cleaning price:</Text>
                <View style={styles.miniCalcInputWrapper}>
                  <Text style={styles.miniCalcPrefix}>$</Text>
                  <TextInput
                    style={styles.miniCalcInput}
                    value={formData.exampleLastMinutePrice}
                    onChangeText={(value) => handleInputChange("exampleLastMinutePrice", value)}
                    keyboardType="numeric"
                    placeholder="175"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>

              <View style={styles.lastMinuteComparison}>
                <View style={styles.comparisonColumn}>
                  <Text style={styles.comparisonHeader}>Regular Booking</Text>
                  <Text style={styles.comparisonSubheader}>More than {thresholdHours}h notice</Text>
                  <View style={styles.comparisonPrice}>
                    <Text style={styles.comparisonPriceValue}>${examplePrice.toFixed(0)}</Text>
                    <Text style={styles.comparisonPriceLabel}>Customer pays</Text>
                  </View>
                  <Text style={styles.comparisonPayout}>
                    Cleaner: ${(examplePrice * (1 - platformFeePercent)).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.comparisonDivider}>
                  <Icon name="arrow-right" size={16} color={colors.text.tertiary} />
                </View>

                <View style={[styles.comparisonColumn, styles.comparisonColumnHighlight]}>
                  <Text style={styles.comparisonHeader}>Last-Minute</Text>
                  <Text style={styles.comparisonSubheader}>Within {thresholdHours}h</Text>
                  <View style={styles.comparisonPrice}>
                    <Text style={[styles.comparisonPriceValue, styles.comparisonPriceHighlight]}>
                      ${totalWithFee.toFixed(0)}
                    </Text>
                    <Text style={styles.comparisonPriceLabel}>Customer pays</Text>
                  </View>
                  <Text style={[styles.comparisonPayout, styles.comparisonPayoutHighlight]}>
                    Cleaner: ${cleanerPayout.toFixed(2)}
                  </Text>
                  <View style={styles.comparisonBadge}>
                    <Text style={styles.comparisonBadgeText}>+${lastMinuteFee} fee</Text>
                  </View>
                </View>
              </View>

              <View style={styles.miniCalcResults}>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Base cleaning price:</Text>
                  <Text style={styles.miniCalcRowValue}>${examplePrice.toFixed(2)}</Text>
                </View>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Last-minute fee:</Text>
                  <Text style={[styles.miniCalcRowValue, styles.miniCalcValueOrange]}>+${lastMinuteFee.toFixed(2)}</Text>
                </View>
                <View style={[styles.miniCalcRow, styles.miniCalcRowTotal]}>
                  <Text style={styles.miniCalcRowLabelBold}>Total customer pays:</Text>
                  <Text style={[styles.miniCalcRowValueLarge, styles.miniCalcValueRed]}>${totalWithFee.toFixed(2)}</Text>
                </View>
                <View style={styles.miniCalcRow}>
                  <Text style={styles.miniCalcRowLabel}>Cleaner bonus from fee:</Text>
                  <Text style={[styles.miniCalcRowValue, styles.miniCalcValueGreen]}>+${bonusFromFee.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.lastMinuteNotificationInfo}>
                <Icon name="bell" size={12} color={colors.error[600]} />
                <Text style={styles.lastMinuteNotificationText}>
                  Urgent notifications sent to cleaners within {radiusMiles} miles
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Last-Minute Info Banner */}
        <View style={styles.lastMinuteInfoBanner}>
          <Icon name="bolt" size={16} color={colors.warning[600]} />
          <Text style={styles.lastMinuteInfoText}>
            When a last-minute booking is made, all cleaners within {formData.lastMinuteNotificationRadiusMiles || 25} miles
            of the property receive an urgent push notification, email, and in-app alert.
            The ${formData.lastMinuteFee || 50} fee helps compensate for short-notice scheduling.
          </Text>
        </View>
      </View>

      {/* Incentive Cancellation Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Incentive Cancellation Policy</Text>
        <Text style={styles.sectionDescription}>
          Special rules when a client with an active incentive discount cancels within the penalty window
        </Text>
        {renderPriceInput("Client Refund (Incentive)", "incentiveRefundPercent", "", "%", "Refund percentage for clients who used an incentive discount (normally 50%, reduced to discourage abuse)")}
        {renderPriceInput("Cleaner Compensation", "incentiveCleanerPercent", "", "%", "Percentage of original price the cleaner receives on incentive cancellations")}

        {/* Cancellation Calculator */}
        {(() => {
          const refundPercent = parseFloat(formData.incentiveRefundPercent) / 100 || 0;
          const cleanerPercent = parseFloat(formData.incentiveCleanerPercent) / 100 || 0;
          // Stripe fee is about 2.9% + $0.30, approximate as 3% for warning
          const stripeFeePercent = 0.03;

          // Calculate with adjustable original price and discount
          const exampleOriginal = parseFloat(formData.exampleOriginalPrice) || 150;
          const exampleDiscountPercent = (parseFloat(formData.exampleDiscountPercent) || 50) / 100;
          const examplePaid = exampleOriginal * (1 - exampleDiscountPercent);
          const clientRefund = examplePaid * refundPercent;
          const cleanerPayout = exampleOriginal * cleanerPercent;
          const stripeFee = examplePaid * stripeFeePercent;
          const platformReceives = examplePaid - clientRefund - cleanerPayout - stripeFee;
          const isLoss = platformReceives < 0;
          const isLowMargin = platformReceives >= 0 && platformReceives < 5;

          return (
            <View style={[
              styles.calculatorBanner,
              isLoss && styles.calculatorBannerLoss,
              isLowMargin && styles.calculatorBannerCaution,
            ]}>
              <View style={styles.calculatorHeader}>
                <Icon
                  name={isLoss ? "exclamation-triangle" : "calculator"}
                  size={18}
                  color={isLoss ? colors.warning[700] : colors.primary[600]}
                />
                <Text style={[styles.calculatorTitle, isLoss && styles.calculatorTitleLoss]}>
                  {isLoss ? "Platform Loss Warning" : "Cancellation Calculator"}
                </Text>
              </View>

              <View style={styles.calculatorInputRow}>
                <Text style={styles.calculatorInputLabel}>Original price:</Text>
                <View style={styles.calculatorInputWrapper}>
                  <Text style={styles.calculatorInputPrefix}>$</Text>
                  <TextInput
                    style={styles.calculatorInput}
                    value={formData.exampleOriginalPrice}
                    onChangeText={(value) => handleInputChange("exampleOriginalPrice", value)}
                    keyboardType="numeric"
                    placeholder="150"
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>

              <View style={styles.calculatorInputRow}>
                <Text style={styles.calculatorInputLabel}>Incentive discount:</Text>
                <View style={styles.calculatorInputWrapper}>
                  <TextInput
                    style={styles.calculatorInput}
                    value={formData.exampleDiscountPercent}
                    onChangeText={(value) => handleInputChange("exampleDiscountPercent", value)}
                    keyboardType="numeric"
                    placeholder="50"
                    placeholderTextColor={colors.text.tertiary}
                  />
                  <Text style={styles.calculatorInputSuffix}>%</Text>
                </View>
              </View>

              <Text style={styles.calculatorScenario}>
                Scenario: ${exampleOriginal.toFixed(0)} cleaning with {(exampleDiscountPercent * 100).toFixed(0)}% discount (${examplePaid.toFixed(2)} paid)
              </Text>

              <View style={styles.calculatorBreakdown}>
                <View style={styles.calculatorRow}>
                  <Text style={styles.calculatorLabel}>Client refund ({(refundPercent * 100).toFixed(0)}% of paid):</Text>
                  <Text style={styles.calculatorValue}>${clientRefund.toFixed(2)}</Text>
                </View>
                <View style={styles.calculatorRow}>
                  <Text style={styles.calculatorLabel}>Cleaner payout ({(cleanerPercent * 100).toFixed(0)}% of original):</Text>
                  <Text style={styles.calculatorValue}>${cleanerPayout.toFixed(2)}</Text>
                </View>
                <View style={styles.calculatorRow}>
                  <Text style={styles.calculatorLabel}>Stripe fees (~3%):</Text>
                  <Text style={styles.calculatorValue}>~${stripeFee.toFixed(2)}</Text>
                </View>
                <View style={[styles.calculatorRow, styles.calculatorRowTotal]}>
                  <Text style={[styles.calculatorLabel, styles.calculatorLabelTotal]}>
                    Platform {isLoss ? "loss" : "keeps"}:
                  </Text>
                  <Text style={[
                    styles.calculatorValue,
                    styles.calculatorValueTotal,
                    isLoss && styles.calculatorValueLoss,
                    !isLoss && styles.calculatorValueProfit,
                  ]}>
                    {isLoss ? "-" : ""}${Math.abs(platformReceives).toFixed(2)}
                  </Text>
                </View>
              </View>

              {isLoss && (
                <Text style={styles.calculatorWarningText}>
                  With these settings, the platform loses money on each incentive cancellation.
                </Text>
              )}
            </View>
          );
        })()}
      </View>

      {/* Change Note Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Note (Optional)</Text>
        <Text style={styles.sectionDescription}>
          Document the reason for this pricing update
        </Text>
        <TextInput
          style={styles.noteInput}
          value={formData.changeNote}
          onChangeText={(value) => handleInputChange("changeNote", value)}
          placeholder="e.g., Adjusted for inflation, holiday pricing update..."
          placeholderTextColor={colors.text.tertiary}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Error/Success Messages */}
      {error && (
        <View style={styles.messageError}>
          <Icon name="exclamation-circle" size={16} color={colors.error[700]} />
          <Text style={styles.messageErrorText}>{error}</Text>
        </View>
      )}

      {success && (
        <View style={styles.messageSuccess}>
          <Icon name="check-circle" size={16} color={colors.success[700]} />
          <Text style={styles.messageSuccessText}>{success}</Text>
        </View>
      )}

      {/* Save Button */}
      <Pressable
        style={[
          styles.saveButton,
          (!hasChanges || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSavePress}
        disabled={!hasChanges || saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.neutral[0]} />
        ) : (
          <>
            <Icon name="save" size={18} color={colors.neutral[0]} />
            <Text style={styles.saveButtonText}>
              {hasChanges ? "Save Changes" : "No Changes"}
            </Text>
          </>
        )}
      </Pressable>

      <View style={{ height: 40 }} />

      {/* Warning Modal */}
      <PricingWarningModal
        visible={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleConfirmSave}
        loading={saving}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.tertiary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  backButtonText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.primary[800],
    lineHeight: 20,
  },
  section: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  currentValueBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  currentValueBadgeChanged: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  currentValueLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  currentValueText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  currentValueTextChanged: {
    color: colors.warning[700],
    textDecorationLine: "line-through",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: "hidden",
  },
  inputWrapperChanged: {
    borderColor: colors.warning[400],
    backgroundColor: colors.warning[50],
  },
  changedIndicator: {
    paddingRight: spacing.md,
  },
  inputPrefix: {
    paddingLeft: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  inputSuffix: {
    paddingRight: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  input: {
    flex: 1,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputWithPrefix: {
    paddingLeft: spacing.sm,
  },
  inputWithSuffix: {
    paddingRight: spacing.sm,
  },
  inputHelp: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  noteInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
    minHeight: 80,
    textAlignVertical: "top",
  },
  messageError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error[200],
    gap: spacing.sm,
  },
  messageErrorText: {
    flex: 1,
    color: colors.error[700],
    fontSize: typography.fontSize.sm,
  },
  messageSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success[200],
    gap: spacing.sm,
  },
  messageSuccessText: {
    flex: 1,
    color: colors.success[700],
    fontSize: typography.fontSize.sm,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.lg,
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral[300],
  },
  saveButtonText: {
    color: colors.neutral[0],
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  // Revenue Calculator Styles
  revenueCalculator: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  revenueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  revenueTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  revenueInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  revenueInputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  revenueInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    paddingHorizontal: spacing.md,
    minWidth: 100,
  },
  revenueInputPrefix: {
    fontSize: typography.fontSize.lg,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  revenueInput: {
    flex: 1,
    padding: spacing.sm,
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    fontWeight: typography.fontWeight.semibold,
    textAlign: "right",
    minWidth: 60,
  },
  revenueVisual: {
    marginBottom: spacing.lg,
  },
  revenueBar: {
    flexDirection: "row",
    height: 32,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  revenueBarSegment: {
    justifyContent: "center",
    alignItems: "center",
  },
  revenueBarCleaner: {
    backgroundColor: colors.success[400],
  },
  revenueBarPlatform: {
    backgroundColor: colors.primary[500],
  },
  revenueBarLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  revenueBarLabelSmall: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  revenueBarLegend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  revenueBarLegendText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },
  revenueBreakdown: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  revenueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  revenueRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  revenueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  revenueDotCleaner: {
    backgroundColor: colors.success[400],
  },
  revenueDotPlatform: {
    backgroundColor: colors.primary[500],
  },
  revenueLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  revenueLabelMuted: {
    color: colors.text.tertiary,
  },
  revenueLabelTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  revenueValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  revenueValueMuted: {
    color: colors.text.tertiary,
  },
  revenueValueContainer: {
    alignItems: "flex-end",
  },
  revenueValueTotal: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  revenueValueProfit: {
    color: colors.success[600],
  },
  revenueValueLoss: {
    color: colors.error[600],
  },
  revenueMargin: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  revenueMarginProfit: {
    color: colors.success[500],
  },
  revenueMarginLoss: {
    color: colors.error[500],
  },
  revenueDivider: {
    height: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  revenueRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
  },
  revenueLossWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.error[50],
    borderRadius: radius.md,
  },
  revenueLossText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    fontWeight: typography.fontWeight.medium,
  },
  // Incentive Cancellation Calculator Styles
  calculatorBanner: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  calculatorBannerLoss: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[300],
  },
  calculatorBannerCaution: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  calculatorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  calculatorTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[700],
  },
  calculatorTitleLoss: {
    color: colors.warning[800],
  },
  calculatorInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  calculatorInputLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  calculatorInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.sm,
  },
  calculatorInputPrefix: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  calculatorInputSuffix: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  calculatorInput: {
    width: 60,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    textAlign: "right",
  },
  calculatorScenario: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
    marginBottom: spacing.md,
  },
  calculatorBreakdown: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  calculatorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  calculatorRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  calculatorLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  calculatorLabelTotal: {
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  calculatorValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  calculatorValueTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  calculatorValueLoss: {
    color: colors.error[600],
  },
  calculatorValueProfit: {
    color: colors.success[600],
  },
  calculatorWarningText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
    marginTop: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // Fee Type Container Styles
  feeTypeContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  feeTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  feeTypeTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  feeTypeDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  // Mini Calculator Styles
  miniCalculator: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  miniCalculatorSuccess: {
    backgroundColor: colors.success[50],
    borderColor: colors.success[100],
  },
  miniCalculatorPurple: {
    backgroundColor: "#F3E8FF",
    borderColor: "#DDD6FE",
  },
  miniCalcHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  miniCalcTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  miniCalcInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  miniCalcLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  miniCalcInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacing.sm,
  },
  miniCalcPrefix: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  miniCalcInput: {
    width: 60,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    textAlign: "right",
  },
  miniCalcResults: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  miniCalcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  miniCalcRowHighlight: {
    backgroundColor: colors.success[50],
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
  },
  miniCalcRowLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  miniCalcRowValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  miniCalcValueGreen: {
    color: colors.success[600],
  },
  miniCalcValueRed: {
    color: colors.error[600],
  },
  miniCalcMuted: {
    color: colors.text.tertiary,
  },
  miniCalcNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  miniCalcNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
  },
  // Additional Mini Calculator Variants
  miniCalculatorBlue: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[100],
  },
  miniCalculatorCyan: {
    backgroundColor: "#ecfeff",
    borderColor: "#a5f3fc",
  },
  miniCalculatorGray: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
  },
  miniCalculatorOrange: {
    backgroundColor: colors.warning[50],
    borderColor: colors.warning[200],
  },
  miniCalculatorRed: {
    backgroundColor: colors.error[50],
    borderColor: colors.error[200],
  },
  miniCalcRowTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
  },
  miniCalcRowLabelBold: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  miniCalcRowValueLarge: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  miniCalcValueCyan: {
    color: "#0891b2",
  },
  miniCalcValueOrange: {
    color: colors.warning[600],
  },
  // Calculator Input Grid Styles
  calcInputGrid: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  calcInputItem: {
    flex: 1,
  },
  calcInputLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  calcInputCentered: {
    textAlign: "center",
  },
  // Quick Examples Styles
  calcQuickExamples: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  calcQuickTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  calcQuickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  calcQuickLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  calcQuickValue: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  // Time Window Comparison Styles
  timeWindowComparison: {
    gap: spacing.sm,
  },
  timeWindowItem: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  timeWindowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  timeWindowLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.primary,
  },
  timeWindowHours: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  timeWindowBarContainer: {
    height: 8,
    backgroundColor: colors.neutral[200],
    borderRadius: radius.sm,
    overflow: "hidden",
    marginBottom: spacing.xs,
  },
  timeWindowBar: {
    height: "100%",
    borderRadius: radius.sm,
  },
  timeWindowPricing: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeWindowSurcharge: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  timeWindowTotal: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  timeWindowNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  timeWindowNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
  },
  // Cancellation Timeline Styles
  cancellationTimeline: {
    marginTop: spacing.sm,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
    marginTop: 4,
  },
  timelineDotGreen: {
    backgroundColor: colors.success[500],
  },
  timelineDotYellow: {
    backgroundColor: colors.warning[500],
  },
  timelineDotRed: {
    backgroundColor: colors.error[500],
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  timelineDescription: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  timelineValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  timelineValueGreen: {
    color: colors.success[600],
  },
  timelineValueOrange: {
    color: colors.warning[600],
  },
  timelineValueRed: {
    color: colors.error[600],
  },
  timelineSubValue: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  // Last-Minute Comparison Styles
  lastMinuteComparison: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: spacing.md,
  },
  comparisonColumn: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
  },
  comparisonColumnHighlight: {
    backgroundColor: colors.error[50],
    borderWidth: 1,
    borderColor: colors.error[200],
  },
  comparisonHeader: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  comparisonSubheader: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  comparisonPrice: {
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  comparisonPriceValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  comparisonPriceHighlight: {
    color: colors.error[600],
  },
  comparisonPriceLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
  comparisonPayout: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  comparisonPayoutHighlight: {
    color: colors.success[600],
    fontWeight: typography.fontWeight.semibold,
  },
  comparisonDivider: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  comparisonBadge: {
    backgroundColor: colors.error[500],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  comparisonBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
  lastMinuteNotificationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  lastMinuteNotificationText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[700],
    flex: 1,
  },
  // Last-Minute Booking Styles
  lastMinuteInfoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
    gap: spacing.sm,
  },
  lastMinuteInfoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.warning[800],
    lineHeight: 20,
  },
});

export default PricingManagement;
