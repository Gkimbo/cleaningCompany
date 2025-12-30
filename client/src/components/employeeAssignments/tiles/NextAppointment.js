import React, { useEffect, useState } from "react";
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import FetchData from "../../../services/fetchRequests/fetchData";
import { usePricing } from "../../../context/PricingContext";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";

const NextAppointment = ({ appointment }) => {
  const { pricing } = usePricing();
  const [expandWindow, setExpandWindow] = useState(false);
  const [home, setHome] = useState({
    address: "",
    city: "",
    compostLocation: "",
    contact: "",
    keyLocation: "",
    keyPadCode: "",
    numBaths: "",
    numBeds: "",
    recyclingLocation: "",
    sheetsProvided: "",
    specialNotes: "",
    state: "",
    towelsProvided: "",
    trashLocation: "",
    zipcode: "",
    cleanersNeeded: "",
    timeToBeCompleted: "",
  });

  const formatDate = (dateString) => {
    const options = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    return new Date(dateString + "T00:00:00").toLocaleDateString(undefined, options);
  };

  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const totalPrice = Number(appointment.price);
  const correctedAmount = totalPrice * cleanerSharePercent;

  const expandDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(true);
  };

  const contractDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandWindow(false);
  };

  useEffect(() => {
    FetchData.getHome(appointment.homeId).then((response) => {
      setHome(response.home);
    });
  }, [appointment.homeId]);

  return (
    <View style={styles.tileContainer}>
      <Pressable onPress={expandWindow ? contractDetails : expandDetails}>
        <Text style={styles.date}>{formatDate(appointment.date)}</Text>
        <Text style={styles.location}>
          {home.city}, {home.state}, {home.zipcode}
        </Text>
        <Text style={styles.amount}>Payout: ${correctedAmount}</Text>

        {expandWindow && (
          <View style={styles.expandedContent}>
            <View style={styles.detailsRow}>
              <View style={styles.detailItem}>
                <Icon name="bed" size={14} color={colors.text.secondary} />
                <Text style={styles.detailText}>{home.numBeds} Beds</Text>
              </View>
              <View style={styles.detailItem}>
                <Icon name="bath" size={14} color={colors.text.secondary} />
                <Text style={styles.detailText}>{home.numBaths} Baths</Text>
              </View>
            </View>

            {/* Linens Section */}
            <View style={styles.linensContainer}>
              <View style={styles.linensHeader}>
                <Icon name="th-large" size={14} color={colors.primary[600]} />
                <Text style={styles.linensTitle}>Linens</Text>
              </View>
              {appointment.bringSheets === "yes" || appointment.bringTowels === "yes" ? (
                <View style={styles.linensContent}>
                  <View style={styles.bringLinensAlert}>
                    <Icon name="exclamation-circle" size={14} color={colors.warning[600]} />
                    <Text style={styles.bringLinensText}>You need to bring:</Text>
                  </View>

                  {/* Sheet Details */}
                  {appointment.bringSheets === "yes" && (
                    <View style={styles.linensSection}>
                      <Text style={styles.linensSectionTitle}>Sheets</Text>
                      {appointment.sheetConfigurations && appointment.sheetConfigurations.length > 0 ? (
                        <View style={styles.linensItemsRow}>
                          {appointment.sheetConfigurations.filter(bed => bed.needsSheets !== false).map((bed, index) => (
                            <View key={index} style={styles.linensDetailItem}>
                              <Icon name="check" size={10} color={colors.warning[600]} />
                              <Text style={styles.linensDetailText}>
                                Bed {bed.bedNumber}: {bed.size ? bed.size.charAt(0).toUpperCase() + bed.size.slice(1) : "Standard"} sheets
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.linensItemsRow}>
                          <View style={styles.linensDetailItem}>
                            <Icon name="check" size={10} color={colors.warning[600]} />
                            <Text style={styles.linensDetailText}>
                              {home.numBeds || "All"} set{home.numBeds !== "1" ? "s" : ""} of sheets
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Towel Details */}
                  {appointment.bringTowels === "yes" && (
                    <View style={styles.linensSection}>
                      <Text style={styles.linensSectionTitle}>Towels</Text>
                      {appointment.towelConfigurations && appointment.towelConfigurations.length > 0 ? (
                        <View style={styles.linensItemsRow}>
                          {appointment.towelConfigurations.map((bath, index) => (
                            <View key={index} style={styles.linensDetailItem}>
                              <Icon name="check" size={10} color={colors.warning[600]} />
                              <Text style={styles.linensDetailText}>
                                Bathroom {bath.bathroomNumber}: {bath.towels || 0} towel{(bath.towels || 0) !== 1 ? "s" : ""}, {bath.faceCloths || 0} washcloth{(bath.faceCloths || 0) !== 1 ? "s" : ""}
                              </Text>
                            </View>
                          ))}
                          <View style={styles.linensTotalRow}>
                            <Text style={styles.linensTotalText}>
                              Total: {appointment.towelConfigurations.reduce((sum, b) => sum + (b.towels || 0), 0)} towels, {appointment.towelConfigurations.reduce((sum, b) => sum + (b.faceCloths || 0), 0)} washcloths
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.linensItemsRow}>
                          <View style={styles.linensDetailItem}>
                            <Icon name="check" size={10} color={colors.warning[600]} />
                            <Text style={styles.linensDetailText}>
                              Towels for {home.numBaths || "all"} bathroom{home.numBaths !== "1" ? "s" : ""}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.linensProvidedContent}>
                  <Icon name="check-circle" size={14} color={colors.success[600]} />
                  <Text style={styles.linensProvidedText}>
                    Sheets and towels will be provided
                  </Text>
                </View>
              )}
            </View>

            {home.cleanersNeeded > 1 && (
              <View style={styles.warningBanner}>
                <Icon name="exclamation-triangle" size={14} color={colors.warning[700]} />
                <View style={styles.warningTextContainer}>
                  <Text style={styles.warningTitle}>Large Home</Text>
                  <Text style={styles.warningSubtext}>May need additional cleaners</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  tileContainer: {
    backgroundColor: colors.neutral[0],
    padding: spacing.lg,
    marginVertical: spacing.md,
    borderRadius: radius.xl,
    ...shadows.md,
    alignItems: "center",
  },
  date: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  location: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  amount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  expandedContent: {
    width: "100%",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  linensContainer: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    width: "100%",
  },
  linensHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  linensTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  linensContent: {
    gap: spacing.sm,
  },
  bringLinensAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  bringLinensText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  linensSection: {
    marginTop: spacing.sm,
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  linensSectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
    marginBottom: spacing.xs,
  },
  linensItemsRow: {
    gap: spacing.xs,
  },
  linensDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  linensDetailText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  linensTotalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
  },
  linensTotalText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  linensProvidedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensProvidedText: {
    fontSize: typography.fontSize.sm,
    color: colors.success[700],
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warning[50],
    padding: spacing.md,
    borderRadius: radius.md,
    width: "100%",
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  warningSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[600],
  },
});

export default NextAppointment;
