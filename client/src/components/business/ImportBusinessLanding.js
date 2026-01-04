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
    { value: "5+", label: "Hours Saved/Week" },
  ];

  const impactNumbers = [
    { number: "10+", label: "Hours saved per week on admin", icon: "clock" },
    { number: "99%", label: "On-time payment rate", icon: "credit-card" },
    { number: "40%", label: "Fewer no-shows with reminders", icon: "bell" },
    { number: "500+", label: "Active cleaning businesses", icon: "users" },
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
    {
      icon: "users",
      title: "Employee Management",
      description: "Hire employees, assign jobs, track their work, and manage payroll - all in one place.",
      gradient: ["#3b82f6", "#2563eb"],
    },
    {
      icon: "clipboard",
      title: "Custom Job Flows",
      description: "Create your own checklists and workflows. Set photo requirements and add notes for each client or home.",
      gradient: ["#10b981", "#059669"],
    },
    {
      icon: "bar-chart-2",
      title: "Financial Dashboard",
      description: "Track earnings, expenses, and profit margins. See your business performance at a glance.",
      gradient: ["#6366f1", "#4f46e5"],
    },
    {
      icon: "calendar",
      title: "Smart Calendar",
      description: "View all jobs, employee schedules, and availability in one unified calendar view.",
      gradient: ["#f43f5e", "#e11d48"],
    },
  ];

  const businessBenefits = [
    {
      icon: "trending-up",
      title: "Grow Your Client Base",
      stat: "30%",
      description: "Average increase in bookings with professional scheduling and reminders",
    },
    {
      icon: "clock",
      title: "Save 10+ Hours Weekly",
      stat: "10hrs",
      description: "Stop doing invoices, chasing payments, and manual scheduling",
    },
    {
      icon: "shield",
      title: "Never Miss a Payment",
      stat: "99%",
      description: "Automatic payments mean you get paid on time, every time",
    },
    {
      icon: "heart",
      title: "Happier Clients",
      stat: "4.8",
      description: "Average rating from clients using the platform",
    },
  ];

  const testimonials = [
    {
      quote: "I went from chasing 20% of my payments to getting paid automatically 100% of the time. That's an extra $800/month I was leaving on the table.",
      name: "Maria S.",
      role: "5 years in business",
      stat: "$800/mo recovered",
    },
    {
      quote: "I hired my first employee last month. Kleanr made it so easy to assign jobs and track their work. I'm finally scaling my business!",
      name: "James T.",
      role: "Business Owner, 3 employees",
      stat: "3x more jobs",
    },
    {
      quote: "The custom checklists are game-changing. Each of my clients has different needs and now my team knows exactly what to do at each home.",
      name: "Sarah L.",
      role: "Owner, Sparkle Clean Co.",
      stat: "Zero complaints",
    },
    {
      quote: "I used to spend Sunday nights doing invoices. Now I spend it with my family. The app does everything for me.",
      name: "David R.",
      role: "Solo Cleaner",
      stat: "10+ hrs saved/week",
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

        {/* By The Numbers Section */}
        <View style={styles.numbersSection}>
          <Text style={styles.sectionLabel}>BY THE NUMBERS</Text>
          <Text style={styles.sectionTitle}>Real Results for Real Cleaners</Text>
          <View style={styles.numbersGrid}>
            {impactNumbers.map((item, index) => (
              <View key={index} style={styles.numberCard}>
                <View style={styles.numberIconContainer}>
                  <Feather name={item.icon} size={24} color={colors.primary[500]} />
                </View>
                <Text style={styles.numberValue}>{item.number}</Text>
                <Text style={styles.numberLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Business Benefits Section */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionLabel}>WHY SWITCH</Text>
          <Text style={styles.sectionTitle}>Transform Your Business</Text>
          <Text style={styles.sectionSubtitle}>
            See the difference Kleanr makes for cleaning professionals
          </Text>
          <View style={styles.benefitsGrid}>
            {businessBenefits.map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <View style={styles.benefitHeader}>
                  <View style={styles.benefitIconCircle}>
                    <Feather name={benefit.icon} size={20} color={colors.primary[600]} />
                  </View>
                  <Text style={styles.benefitStat}>{benefit.stat}</Text>
                </View>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDescription}>{benefit.description}</Text>
              </View>
            ))}
          </View>
        </View>

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
          <Text style={styles.sectionLabel}>SUCCESS STORIES</Text>
          <Text style={styles.sectionTitle}>Real Results from Real Cleaners</Text>
          <Text style={styles.sectionSubtitle}>
            See how business owners like you are growing with Kleanr
          </Text>

          {testimonials.map((testimonial, index) => (
            <View key={index} style={styles.testimonialCard}>
              <View style={styles.testimonialHeader}>
                <View style={styles.quoteIcon}>
                  <Feather name="message-circle" size={20} color={colors.primary[400]} />
                </View>
                {testimonial.stat && (
                  <View style={styles.testimonialStatBadge}>
                    <Text style={styles.testimonialStatText}>{testimonial.stat}</Text>
                  </View>
                )}
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
          <Text style={styles.finalCtaTitle}>Ready to Work Smarter, Not Harder?</Text>
          <Text style={styles.finalCtaSubtitle}>
            Join 500+ cleaning professionals who save 10+ hours every week
          </Text>

          <View style={styles.finalCtaFeatures}>
            <View style={styles.finalCtaFeatureRow}>
              <Feather name="check-circle" size={18} color={colors.primary[400]} />
              <Text style={styles.finalCtaFeatureText}>Free to start, no credit card required</Text>
            </View>
            <View style={styles.finalCtaFeatureRow}>
              <Feather name="check-circle" size={18} color={colors.primary[400]} />
              <Text style={styles.finalCtaFeatureText}>Set up in under 5 minutes</Text>
            </View>
            <View style={styles.finalCtaFeatureRow}>
              <Feather name="check-circle" size={18} color={colors.primary[400]} />
              <Text style={styles.finalCtaFeatureText}>Cancel anytime, keep your data</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.finalCtaButton}
            onPress={() => navigate("/business-signup-check")}
          >
            <Feather name="zap" size={20} color="#fff" />
            <Text style={styles.finalCtaButtonText}>Start Growing Your Business</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.calculatorLink}
            onPress={() => navigate("/earnings-calculator")}
          >
            <Feather name="calculator" size={16} color={colors.primary[400]} />
            <Text style={styles.calculatorLinkText}>
              See how much you could earn
            </Text>
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

  // By The Numbers Section
  numbersSection: {
    padding: spacing.xl,
    backgroundColor: "#fff",
  },
  numbersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  numberCard: {
    width: "48%",
    backgroundColor: "#f8fafc",
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  numberIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  numberValue: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary[600],
    marginBottom: 4,
  },
  numberLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 16,
  },

  // Business Benefits Section
  benefitsSection: {
    padding: spacing.xl,
    backgroundColor: "#f0fdf4",
  },
  benefitsGrid: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  benefitCard: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    ...shadows.sm,
  },
  benefitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  benefitIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
  },
  benefitStat: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.success[600],
  },
  benefitTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  benefitDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
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
  testimonialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  quoteIcon: {},
  testimonialStatBadge: {
    backgroundColor: colors.success[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  testimonialStatText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[700],
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
    marginBottom: spacing.lg,
  },
  finalCtaFeatures: {
    marginBottom: spacing.xl,
  },
  finalCtaFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  finalCtaFeatureText: {
    fontSize: typography.fontSize.sm,
    color: "#cbd5e1",
    marginLeft: spacing.sm,
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
  calculatorLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  calculatorLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[400],
    marginLeft: spacing.xs,
    textDecorationLine: "underline",
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
