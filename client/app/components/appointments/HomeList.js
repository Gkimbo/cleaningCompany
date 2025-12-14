import React from "react";
import { ScrollView, Text, View, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigate } from "react-router-native";
import HomeTile from "../tiles/HomeTile";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";

const HomeList = ({ state, dispatch }) => {
  const navigate = useNavigate();

  const handleAddHome = () => {
    navigate("/setup-home");
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Text style={styles.backButtonText}>{"<"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Homes</Text>
        <View style={styles.headerSpacer} />
      </View>

      {state.homes.length > 0 ? (
        <>
          <Text style={styles.subtitle}>
            Select a home to view details or book a cleaning
          </Text>

          <View style={styles.homesList}>
            {state.homes.map((home) => (
              <HomeTile
                key={home.id}
                id={home.id}
                nickName={home.nickName}
                state={home.state}
                address={home.address}
                city={home.city}
                zipcode={home.zipcode}
                numBeds={home.numBeds}
                numBaths={home.numBaths}
                sheetsProvided={home.sheetsProvided}
                towelsProvided={home.towelsProvided}
                keyPadCode={home.keyPadCode}
                keyLocation={home.keyLocation}
                recyclingLocation={home.recyclingLocation}
                compostLocation={home.compostLocation}
                trashLocation={home.trashLocation}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.addAnotherButton} onPress={handleAddHome}>
            <Text style={styles.addAnotherButtonText}>+ Add Another Home</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>🏠</Text>
          </View>
          <Text style={styles.emptyTitle}>No Homes Yet</Text>
          <Text style={styles.emptyDescription}>
            Add your first home to start booking professional cleaning services.
          </Text>
          <TouchableOpacity style={styles.addFirstButton} onPress={handleAddHome}>
            <Text style={styles.addFirstButtonText}>Add Your First Home</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing["4xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 60,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  homesList: {
    marginBottom: spacing.lg,
  },
  addAnotherButton: {
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary[500],
    borderStyle: "dashed",
  },
  addAnotherButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  emptyIconText: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
    lineHeight: 24,
  },
  addFirstButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["3xl"],
    borderRadius: radius.lg,
    ...shadows.md,
  },
  addFirstButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.neutral[0],
  },
});

export default HomeList;
