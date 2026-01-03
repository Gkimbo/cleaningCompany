import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radius, shadows, typography } from "../../services/styles/theme";
import { usePricing } from "../../context/PricingContext";

const { width } = Dimensions.get("window");

const ImportBusinessLanding = () => {
  const navigate = useNavigate();
  const { pricing } = usePricing();

  // Calculate dynamic percentages from pricing config
  const businessOwnerFee = pricing?.platform?.businessOwnerFeePercent || 0.10;
  const keepPercent = Math.round((1 - businessOwnerFee) * 100);
  const feePercent = Math.round(businessOwnerFee * 100);

  const stats = [
    { value: `${keepPercent}%`, label: "You Keep" },
    { value: "$0", label: "Monthly Fee" },
    { value: "24hr", label: "Fast Payouts" },
  ];

  const painPoints = [
    { icon: "x-circle", text: "Chasing payments via Venmo/cash", color: colors.error[500] },
    { icon: "x-circle", text: "Manually tracking your schedule", color: colors.error[500] },
    { icon: "x-circle", text: "Creating invoices by hand", color: colors.error[500] },
    { icon: "x-circle", text: "Forgetting client appointments", color: colors.error[500] },
  ];

  const solutions = [
    { icon: "check-circle", text: "Auto-charge after every cleaning", color: colors.success[500] },
    { icon: "check-circle", text: "Smart recurring schedules", color: colors.success[500] },
    { icon: "check-circle", text: "Professional invoices sent automatically", color: colors.success[500] },
    { icon: "check-circle", text: "Reminders for you AND your clients", color: colors.success[500] },
  ];

  const features = [
    {
      icon: "user-plus",
      title: "One-Click Client Invites",
      description: "Import your existing clients in seconds. They get a personalized invite and join with pre-filled info.",
      gradient: ["#14b8a6", "#0d9488"],
    },
    {
      icon: "repeat",
      title: "Set It & Forget It Scheduling",
      description: "Weekly, bi-weekly, monthly - set up once and appointments auto-generate forever.",
      gradient: ["#8b5cf6", "#7c3aed"],
    },
    {
      icon: "dollar-sign",
      title: "Get Paid Instantly",
      description: "Cards are charged the moment you mark a job complete. Money hits your bank in 24 hours.",
      gradient: ["#f59e0b", "#d97706"],
    },
    {
      icon: "message-circle",
      title: "Built-In Messaging",
      description: "Chat with clients directly in the app. No more scattered texts and missed messages.",
      gradient: ["#ec4899", "#db2777"],
    },
  ];

  const testimonials = [
    {
      quote: "I used to spend hours every week on invoicing. Now I just clean and get paid automatically.",
      name: "Maria S.",
      role: "5 years in business",
    },
    {
      quote: "My clients love the reminders. No more 'I forgot you were coming today' moments.",
      name: "James T.",
      role: "Independent Cleaner",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={["#0f172a", "#1e293b", "#334155"]}
          style={styles.heroSection}
        >
          <View style={styles.heroBadge}>
            <Feather name="zap" size={14} color={colors.warning[400]} />
            <Text style={styles.heroBadgeText}>For Independent Cleaners</Text>
          </View>

          <Text style={styles.heroTitle}>
            Run Your Cleaning Business{"\n"}
            <Text style={styles.heroTitleAccent}>Like a Pro</Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            Stop chasing payments. Stop manual scheduling.{"\n"}
            Let Kleanr handle the boring stuff while you focus on what you do best.
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.heroCta}
            onPress={() => navigate("/business-signup-check")}
          >
            <Text style={styles.heroCtaText}>Start Free Today</Text>
            <Feather name="arrow-right" size={20} color="#0f172a" />
          </TouchableOpacity>

          <Text style={styles.heroNote}>No credit card required</Text>
        </LinearGradient>

        {/* Problem/Solution Section */}
        <View style={styles.problemSolutionSection}>
          <Text style={styles.sectionLabel}>THE PROBLEM</Text>
          <Text style={styles.problemTitle}>Sound Familiar?</Text>

          <View style={styles.comparisonContainer}>
            {/* Problems */}
            <View style={styles.problemBox}>
              <Text style={styles.boxTitle}>Before Kleanr</Text>
              {painPoints.map((point, index) => (
                <View key={index} style={styles.pointRow}>
                  <Feather name={point.icon} size={18} color={point.color} />
                  <Text style={styles.pointText}>{point.text}</Text>
                </View>
              ))}
            </View>

            {/* Arrow */}
            <View style={styles.arrowContainer}>
              <View style={styles.arrowCircle}>
                <Feather name="arrow-right" size={24} color={colors.primary[600]} />
              </View>
            </View>

            {/* Solutions */}
            <View style={styles.solutionBox}>
              <Text style={styles.boxTitle}>With Kleanr</Text>
              {solutions.map((point, index) => (
                <View key={index} style={styles.pointRow}>
                  <Feather name={point.icon} size={18} color={point.color} />
                  <Text style={styles.pointText}>{point.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionLabel}>FEATURES</Text>
          <Text style={styles.sectionTitle}>Everything You Need</Text>
          <Text style={styles.sectionSubtitle}>
            Powerful tools designed specifically for cleaning professionals
          </Text>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <LinearGradient
                  colors={feature.gradient}
                  style={styles.featureIconGradient}
                >
                  <Feather name={feature.icon} size={24} color="#fff" />
                </LinearGradient>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <LinearGradient
          colors={[colors.primary[600], colors.primary[700]]}
          style={styles.howItWorksSection}
        >
          <Text style={styles.howItWorksLabel}>HOW IT WORKS</Text>
          <Text style={styles.howItWorksTitle}>Up & Running in Minutes</Text>

          <View style={styles.stepsContainer}>
            <View style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>1</Text>
              </View>
              <View style={styles.stepLine} />
              <Text style={styles.stepTitle}>Create Account</Text>
              <Text style={styles.stepDesc}>Sign up free in 2 minutes</Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>2</Text>
              </View>
              <View style={styles.stepLine} />
              <Text style={styles.stepTitle}>Add Your Clients</Text>
              <Text style={styles.stepDesc}>Invite them via email</Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>3</Text>
              </View>
              <View style={styles.stepLine} />
              <Text style={styles.stepTitle}>Set Schedules</Text>
              <Text style={styles.stepDesc}>Configure recurring jobs</Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>4</Text>
              </View>
              <Text style={styles.stepTitle}>Get Paid!</Text>
              <Text style={styles.stepDesc}>Auto-payments after each job</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Testimonials */}
        <View style={styles.testimonialsSection}>
          <Text style={styles.sectionLabel}>TESTIMONIALS</Text>
          <Text style={styles.sectionTitle}>Loved by Cleaners</Text>

          {testimonials.map((testimonial, index) => (
            <View key={index} style={styles.testimonialCard}>
              <View style={styles.quoteIcon}>
                <Feather name="message-circle" size={20} color={colors.primary[400]} />
              </View>
              <Text style={styles.testimonialQuote}>"{testimonial.quote}"</Text>
              <View style={styles.testimonialAuthor}>
                <View style={styles.authorAvatar}>
                  <Text style={styles.authorInitial}>{testimonial.name[0]}</Text>
                </View>
                <View>
                  <Text style={styles.authorName}>{testimonial.name}</Text>
                  <Text style={styles.authorRole}>{testimonial.role}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing Highlight */}
        <View style={styles.pricingSection}>
          <LinearGradient
            colors={["#fef3c7", "#fde68a"]}
            style={styles.pricingCard}
          >
            <View style={styles.pricingBadge}>
              <Text style={styles.pricingBadgeText}>SIMPLE PRICING</Text>
            </View>

            <Text style={styles.pricingTitle}>Keep {keepPercent}% of Everything</Text>
            <Text style={styles.pricingSubtitle}>
              We only take a small {feePercent}% fee when you get paid.{"\n"}
              No monthly fees. No setup costs. No hidden charges.
            </Text>

            <View style={styles.pricingFeatures}>
              <View style={styles.pricingFeatureRow}>
                <Feather name="check" size={20} color={colors.success[600]} />
                <Text style={styles.pricingFeatureText}>Unlimited clients</Text>
              </View>
              <View style={styles.pricingFeatureRow}>
                <Feather name="check" size={20} color={colors.success[600]} />
                <Text style={styles.pricingFeatureText}>Unlimited appointments</Text>
              </View>
              <View style={styles.pricingFeatureRow}>
                <Feather name="check" size={20} color={colors.success[600]} />
                <Text style={styles.pricingFeatureText}>All features included</Text>
              </View>
              <View style={styles.pricingFeatureRow}>
                <Feather name="check" size={20} color={colors.success[600]} />
                <Text style={styles.pricingFeatureText}>Cancel anytime</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Final CTA */}
        <View style={styles.finalCtaSection}>
          <Text style={styles.finalCtaTitle}>Ready to Simplify Your Business?</Text>
          <Text style={styles.finalCtaSubtitle}>
            Join hundreds of cleaning professionals who've already made the switch.
          </Text>

          <TouchableOpacity
            style={styles.finalCtaButton}
            onPress={() => navigate("/business-signup-check")}
          >
            <Feather name="zap" size={20} color="#fff" />
            <Text style={styles.finalCtaButtonText}>Get Started Free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => navigate("/sign-in")}
          >
            <Text style={styles.signInLinkText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing["4xl"],
  },

  // Hero Section
  heroSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["3xl"],
    paddingBottom: spacing["4xl"],
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  heroBadgeText: {
    color: colors.warning[400],
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.xs,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    lineHeight: 40,
    marginBottom: spacing.md,
  },
  heroTitleAccent: {
    color: colors.primary[400],
  },
  heroSubtitle: {
    fontSize: typography.fontSize.base,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary[400],
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: "#64748b",
    marginTop: 2,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[400],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  heroCtaText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#0f172a",
    marginRight: spacing.sm,
  },
  heroNote: {
    fontSize: typography.fontSize.sm,
    color: "#64748b",
    marginTop: spacing.md,
  },

  // Problem/Solution Section
  problemSolutionSection: {
    padding: spacing.xl,
    backgroundColor: "#fff",
  },
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  problemTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  comparisonContainer: {
    gap: spacing.lg,
  },
  problemBox: {
    backgroundColor: "#fef2f2",
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  solutionBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  boxTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  pointRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  pointText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  arrowContainer: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  arrowCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "90deg" }],
  },

  // Features Section
  featuresSection: {
    padding: spacing.xl,
    backgroundColor: "#f8fafc",
  },
  sectionTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  featuresGrid: {
    gap: spacing.md,
  },
  featureCard: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadows.md,
  },
  featureIconGradient: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  featureTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // How It Works Section
  howItWorksSection: {
    padding: spacing.xl,
    paddingVertical: spacing["3xl"],
  },
  howItWorksLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[200],
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  howItWorksTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  stepsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  stepItem: {
    width: "23%",
    alignItems: "center",
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  stepNumber: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  stepLine: {
    position: "absolute",
    top: 20,
    right: -20,
    width: 40,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  stepTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    textAlign: "center",
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 10,
    color: colors.primary[200],
    textAlign: "center",
  },

  // Testimonials Section
  testimonialsSection: {
    padding: spacing.xl,
    backgroundColor: "#fff",
  },
  testimonialCard: {
    backgroundColor: "#f8fafc",
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  quoteIcon: {
    marginBottom: spacing.md,
  },
  testimonialQuote: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    lineHeight: 26,
    fontStyle: "italic",
    marginBottom: spacing.lg,
  },
  testimonialAuthor: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  authorInitial: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  authorName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  authorRole: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // Pricing Section
  pricingSection: {
    padding: spacing.xl,
    backgroundColor: "#f8fafc",
  },
  pricingCard: {
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    alignItems: "center",
  },
  pricingBadge: {
    backgroundColor: "#92400e",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  pricingBadgeText: {
    color: "#fff",
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  pricingTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#78350f",
    marginBottom: spacing.sm,
  },
  pricingSubtitle: {
    fontSize: typography.fontSize.base,
    color: "#92400e",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  pricingFeatures: {
    alignSelf: "stretch",
  },
  pricingFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  pricingFeatureText: {
    fontSize: typography.fontSize.base,
    color: "#78350f",
    marginLeft: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },

  // Final CTA Section
  finalCtaSection: {
    padding: spacing.xl,
    paddingVertical: spacing["3xl"],
    backgroundColor: "#0f172a",
    alignItems: "center",
  },
  finalCtaTitle: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  finalCtaSubtitle: {
    fontSize: typography.fontSize.base,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: spacing.xl,
  },
  finalCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[500],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    ...shadows.lg,
    marginBottom: spacing.lg,
  },
  finalCtaButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
    marginLeft: spacing.sm,
  },
  signInLink: {
    paddingVertical: spacing.sm,
  },
  signInLinkText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[400],
  },
});

export default ImportBusinessLanding;
