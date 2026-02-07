import React, { useState } from "react";
import {
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Supply Card Component with optional image
const SupplyCard = ({ icon, name, description, tip, imageUrl, essential }) => (
  <View style={[styles.supplyCard, essential && styles.essentialCard]}>
    {essential && (
      <View style={styles.essentialBadge}>
        <Icon name="star" size={10} color={colors.warning[600]} />
        <Text style={styles.essentialText}>Essential</Text>
      </View>
    )}
    <View style={styles.supplyContent}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.supplyImage} />
      ) : (
        <View style={styles.supplyIconContainer}>
          <Text style={styles.supplyIcon}>{icon}</Text>
        </View>
      )}
      <View style={styles.supplyInfo}>
        <Text style={styles.supplyName}>{name}</Text>
        <Text style={styles.supplyDescription}>{description}</Text>
        {tip && (
          <View style={styles.tipBadge}>
            <Icon name="lightbulb-o" size={12} color={colors.primary[600]} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        )}
      </View>
    </View>
  </View>
);

// Category Section Component
const CategorySection = ({ title, icon, iconColor, supplies, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.categorySection}>
      <Pressable style={styles.categoryHeader} onPress={toggleExpanded}>
        <View style={[styles.categoryIconContainer, { backgroundColor: iconColor + "20" }]}>
          <Icon name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.categoryTitle}>{title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryCount}>{supplies.length}</Text>
        </View>
        <Icon
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.text.tertiary}
        />
      </Pressable>
      {isExpanded && (
        <View style={styles.categoryContent}>
          {supplies.map((supply, index) => (
            <SupplyCard
              key={index}
              icon={supply.icon}
              name={supply.name}
              description={supply.description}
              tip={supply.tip}
              imageUrl={supply.imageUrl}
              essential={supply.essential}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// Pro Tip Card Component
const ProTipCard = ({ title, content }) => (
  <View style={styles.proTipCard}>
    <View style={styles.proTipHeader}>
      <Icon name="lightbulb-o" size={20} color={colors.warning[600]} />
      <Text style={styles.proTipTitle}>{title}</Text>
    </View>
    <Text style={styles.proTipContent}>{content}</Text>
  </View>
);

const RecommendedSupplies = () => {
  // Equipment - Major cleaning tools
  const equipment = [
    {
      icon: "🔌",
      name: "Lightweight Corded Vacuum",
      description: "A corded vacuum provides consistent, powerful suction all day. Look for one with attachments for upholstery and crevices.",
      tip: "Corded vacuums are more reliable than battery-powered for professional cleaning",
      essential: true,
    },
    {
      icon: "🧹",
      name: "Swiffer Wet Jet",
      description: "Quick and efficient for hard floors. The spray mop design eliminates the need for buckets. Great for maintenance cleaning.",
      essential: true,
    },
    {
      icon: "🪣",
      name: "Spin Mop & Bucket",
      description: "For deeper floor cleaning. The spin feature wrings out the mop perfectly every time. Essential for heavily soiled floors.",
    },
    {
      icon: "🪶",
      name: "Extendable Duster",
      description: "Telescoping handle reaches ceiling fans, high shelves, and corners. Microfiber heads trap dust instead of spreading it.",
      essential: true,
    },
    {
      icon: "🧴",
      name: "Spray Bottles (3-4)",
      description: "Have dedicated bottles for different solutions: glass cleaner, all-purpose, bathroom, and kitchen degreaser.",
    },
  ];

  // Cleaning Solutions
  const cleaningSolutions = [
    {
      icon: "✨",
      name: "All-Purpose Cleaner",
      description: "Versatile cleaner for counters, appliances, and most surfaces. Look for streak-free formulas.",
      tip: "Dilute concentrated versions to save money",
      essential: true,
    },
    {
      icon: "🪟",
      name: "Glass & Mirror Cleaner",
      description: "Ammonia-based cleaners work best for streak-free shine on windows and mirrors.",
      essential: true,
    },
    {
      icon: "🚽",
      name: "Toilet Bowl Cleaner",
      description: "Bleach-based cleaners disinfect thoroughly. Angled bottles reach under the rim easily.",
      tip: "Let sit for 5-10 minutes before scrubbing for best results",
      essential: true,
    },
    {
      icon: "🍳",
      name: "Kitchen Degreaser",
      description: "Cuts through grease on stovetops, range hoods, and backsplashes. Essential for kitchen deep cleaning.",
      tip: "Spray and let sit briefly before wiping for tough grease",
      essential: true,
    },
    {
      icon: "🛁",
      name: "Bathroom Cleaner / Soap Scum Remover",
      description: "Formulated to tackle hard water stains, soap scum, and mildew in showers and tubs.",
    },
    {
      icon: "🦠",
      name: "Disinfectant Spray",
      description: "For high-touch surfaces like door handles, light switches, and remotes. Quick-drying formula preferred.",
    },
    {
      icon: "🪵",
      name: "Wood Polish / Furniture Spray",
      description: "Protects and shines wood furniture. Avoid on floors - can make them slippery.",
    },
    {
      icon: "🥏",
      name: "Stainless Steel Cleaner",
      description: "Removes fingerprints and smudges from stainless appliances. Leaves a protective shine.",
    },
  ];

  // Tools & Accessories
  const toolsAccessories = [
    {
      icon: "🧽",
      name: "Microfiber Cloths (10+)",
      description: "The workhorse of cleaning. Use different colors for different areas (bathrooms vs kitchen) to prevent cross-contamination.",
      tip: "Wash without fabric softener to maintain absorbency",
      essential: true,
    },
    {
      icon: "🪥",
      name: "Scrub Brushes (Variety Pack)",
      description: "Different sizes for different jobs: grout brush, toilet brush, general scrubbing brush, and detail brush for corners.",
      essential: true,
    },
    {
      icon: "🧤",
      name: "Rubber Cleaning Gloves",
      description: "Protect your hands from chemicals and dirty water. Get a few pairs - replace when they tear.",
      essential: true,
    },
    {
      icon: "🧼",
      name: "Magic Erasers",
      description: "Amazing for scuff marks, crayon, and stubborn stains on walls. Use lightly - they can remove paint if scrubbed too hard.",
    },
    {
      icon: "🔪",
      name: "Plastic Scraper / Razor Blade Tool",
      description: "Safely removes stuck-on gunk from glass cooktops, windows, and mirrors without scratching.",
    },
    {
      icon: "🪣",
      name: "Cleaning Caddy",
      description: "Keep your supplies organized and portable. Move room to room efficiently without multiple trips.",
      essential: true,
    },
    {
      icon: "🗑️",
      name: "Trash Bags (Various Sizes)",
      description: "Always have small, medium, and large bags. Replace liners as you clean each room.",
    },
    {
      icon: "📦",
      name: "Step Stool",
      description: "Safely reach high cabinets, ceiling fans, and top shelves. Foldable versions are easy to transport.",
    },
  ];

  // Linens (for jobs requiring sheets/towels)
  const linens = [
    {
      icon: "🛏️",
      name: "Sheet Sets (Queen, King, Twin)",
      description: "For jobs requiring fresh linens. Keep a set of each common size. White or neutral colors are professional.",
      tip: "Check job details in advance to know what sizes to bring",
      essential: true,
    },
    {
      icon: "🛁",
      name: "Bath Towels",
      description: "Standard bath towels for bathroom jobs. White is traditional and can be bleached for cleanliness.",
      essential: true,
    },
    {
      icon: "🧴",
      name: "Washcloths / Face Cloths",
      description: "Smaller cloths for bathrooms. Usually provided with towel sets.",
    },
    {
      icon: "🏖️",
      name: "Hand Towels",
      description: "For bathrooms and kitchens. Match with bath towels for a coordinated look.",
    },
  ];

  const proTips = [
    {
      title: "Streak-Free Glass Every Time",
      content: "1. Wet a paper towel and wipe the entire surface\n2. Immediately follow with a dry paper towel\n3. Use circular motions while drying\n\nThis two-step method with circular motion gives you perfectly clear mirrors and windows!",
    },
    {
      title: "Work Top to Bottom",
      content: "Always clean from the highest point down. Dust and debris fall - so clean ceiling fans and high shelves first, then counters, then floors last. This prevents re-cleaning surfaces.",
    },
    {
      title: "The Two-Bucket Method",
      content: "When mopping, use two buckets: one with clean solution, one for wringing dirty water. This keeps your mop water cleaner longer and gives better results.",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Icon name="shopping-basket" size={24} color={colors.primary[600]} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Recommended Supplies</Text>
          <Text style={styles.headerSubtitle}>
            Quality tools make cleaning faster and easier
          </Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <Icon name="star" size={12} color={colors.warning[600]} />
          <Text style={styles.legendText}>Essential items for getting started</Text>
        </View>
      </View>

      {/* Categories */}
      <CategorySection
        title="Equipment"
        icon="plug"
        iconColor={colors.primary[600]}
        supplies={equipment}
      />

      <CategorySection
        title="Cleaning Solutions"
        icon="flask"
        iconColor={colors.success[600]}
        supplies={cleaningSolutions}
      />

      <CategorySection
        title="Tools & Accessories"
        icon="wrench"
        iconColor={colors.warning[600]}
        supplies={toolsAccessories}
      />

      <CategorySection
        title="Linens"
        icon="bed"
        iconColor={colors.primary[400]}
        supplies={linens}
        defaultExpanded={false}
      />

      {/* Pro Tips Section */}
      <View style={styles.proTipsSection}>
        <View style={styles.proTipsSectionHeader}>
          <Icon name="lightbulb-o" size={20} color={colors.warning[600]} />
          <Text style={styles.proTipsSectionTitle}>Pro Tips</Text>
        </View>
        {proTips.map((tip, index) => (
          <ProTipCard key={index} title={tip.title} content={tip.content} />
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
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[50],
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: typography.fontSize["xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },

  // Legend
  legend: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    marginHorizontal: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.warning[700],
  },

  // Category Section
  categorySection: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    overflow: "hidden",
    ...shadows.sm,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.neutral[0],
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  categoryBadge: {
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  categoryCount: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
  },
  categoryContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  // Supply Card
  supplyCard: {
    backgroundColor: colors.neutral[50],
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  essentialCard: {
    borderWidth: 1,
    borderColor: colors.warning[200],
    backgroundColor: colors.warning[50] + "40",
  },
  essentialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: colors.warning[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  essentialText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  supplyContent: {
    flexDirection: "row",
    gap: spacing.md,
  },
  supplyImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[200],
  },
  supplyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.neutral[0],
    justifyContent: "center",
    alignItems: "center",
    ...shadows.sm,
  },
  supplyIcon: {
    fontSize: 24,
  },
  supplyInfo: {
    flex: 1,
  },
  supplyName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 4,
  },
  supplyDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  tipBadge: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  tipText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.primary[700],
    lineHeight: 16,
  },

  // Pro Tips Section
  proTipsSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  proTipsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  proTipsSectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  proTipCard: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  proTipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  proTipTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.warning[800],
    flex: 1,
  },
  proTipContent: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 22,
  },

  bottomPadding: {
    height: spacing["4xl"],
  },
});

export default RecommendedSupplies;
