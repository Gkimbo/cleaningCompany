import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Supply Card Component
const SupplyCard = ({ icon, name, description, tip }) => (
  <View style={styles.supplyCard}>
    <View style={styles.supplyHeader}>
      <Text style={styles.supplyIcon}>{icon}</Text>
      <Text style={styles.supplyName}>{name}</Text>
    </View>
    <Text style={styles.supplyDescription}>{description}</Text>
    {tip && (
      <View style={styles.tipBadge}>
        <Text style={styles.tipText}>{tip}</Text>
      </View>
    )}
  </View>
);

// Pro Tip Card Component
const ProTipCard = ({ title, content }) => (
  <View style={styles.proTipCard}>
    <View style={styles.proTipHeader}>
      <Text style={styles.proTipIcon}>💡</Text>
      <Text style={styles.proTipTitle}>{title}</Text>
    </View>
    <Text style={styles.proTipContent}>{content}</Text>
  </View>
);

// Section Header Component
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const RecommendedSupplies = () => {
  const supplies = [
    {
      icon: "🧹",
      name: "Swiffer Wet Jet",
      description: "Best for mopping hard floors quickly and efficiently. The spray mop design makes it easy to clean without a bucket.",
    },
    {
      icon: "🪶",
      name: "Swiffer Duster",
      description: "Perfect for dusting furniture, blinds, ceiling fans, and hard-to-reach areas. The fluffy fibers trap dust instead of spreading it.",
    },
    {
      icon: "🔌",
      name: "Lightweight Bagless Plug-in Vacuum",
      description: "A corded vacuum provides consistent suction power. Bagless design saves money on bags. Look for one with good carpet performance.",
      tip: "Plug-in vacuums are more reliable than battery-powered for all-day cleaning",
    },
    {
      icon: "🚽",
      name: "Toilet Bowl Cleaner",
      description: "Use a bleach-based or vinegar-based cleaning spray for toilets. Bleach disinfects thoroughly, while vinegar is a natural alternative.",
      tip: "Let the cleaner sit for 5-10 minutes before scrubbing for best results",
    },
    {
      icon: "🍳",
      name: "Kitchen Degreaser",
      description: "Essential for cutting through grease on stovetops, range hoods, and counters. Spray and let it sit briefly before wiping.",
      tip: "Works great on oven exteriors and backsplashes too",
    },
  ];

  const proTips = [
    {
      title: "Streak-Free Mirror Cleaning",
      content: "For 100% streak-free mirrors and glass:\n\n1. Wet a paper towel and wipe the entire surface\n2. Immediately follow with a dry paper towel\n3. Use circular motions while drying\n\nThis two-step method with circular motion gives you perfectly clear mirrors every time!",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recommended Supplies</Text>
        <Text style={styles.headerSubtitle}>
          Quality tools make cleaning faster and easier
        </Text>
      </View>

      {/* Equipment Section */}
      <View style={styles.section}>
        <SectionHeader title="Equipment" />
        {supplies.map((supply, index) => (
          <SupplyCard
            key={index}
            icon={supply.icon}
            name={supply.name}
            description={supply.description}
            tip={supply.tip}
          />
        ))}
      </View>

      {/* Pro Tips Section */}
      <View style={styles.section}>
        <SectionHeader title="Pro Tips" />
        {proTips.map((tip, index) => (
          <ProTipCard
            key={index}
            title={tip.title}
            content={tip.content}
          />
        ))}
      </View>

      {/* Bottom padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
  contentContainer: {
    paddingTop: spacing["3xl"],
    paddingHorizontal: spacing.lg,
  },

  // Header
  header: {
    marginBottom: spacing.xl,
  },
  headerTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },

  // Supply Card
  supplyCard: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  supplyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  supplyIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  supplyName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  supplyDescription: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  tipBadge: {
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  tipText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontStyle: "italic",
  },

  // Pro Tip Card
  proTipCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  proTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  proTipIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  proTipTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    flex: 1,
  },
  proTipContent: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 24,
  },

  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default RecommendedSupplies;
