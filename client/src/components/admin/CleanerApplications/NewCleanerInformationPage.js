import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radius, shadows, typography } from "../../../services/styles/theme";
import { usePricing, defaultPricing } from "../../../context/PricingContext";

const { width } = Dimensions.get("window");

const NewCleanerInformationPage = () => {
  const navigate = useNavigate();
  const { pricing: fetchedPricing } = usePricing();
  const pricing = fetchedPricing?.basePrice ? fetchedPricing : defaultPricing;

  // Calculator state
  const [jobsPerWeek, setJobsPerWeek] = useState(15);

  // Calculate earnings from pricing config
  const platformFeePercent = pricing?.platform?.feePercent || 0.10;
  const keepPercent = Math.round((1 - platformFeePercent) * 100);
  const basePrice = pricing?.basePrice || 150;
  const avgJobPrice = basePrice + 50; // Average job is slightly above base
  const cleanerEarningsPerJob = Math.round(avgJobPrice * (1 - platformFeePercent));

  // Weekly/Monthly/Yearly calculations
  const weeklyEarnings = jobsPerWeek * cleanerEarningsPerJob;
  const monthlyEarnings = weeklyEarnings * 4;
  const yearlyEarnings = monthlyEarnings * 12;

  const handleApplyPress = () => {
    navigate("/application-form");
  };

  const stats = [
    { value: `${keepPercent}%`, label: "You Keep", icon: "dollar-sign" },
    { value: "Fast", label: "Payouts", icon: "zap" },
    { value: "4.9", label: "Avg Rating", icon: "star" },
    { value: "$0", label: "To Start", icon: "gift" },
  ];

  const earnings = [
    { jobs: 10, weekly: 10 * cleanerEarningsPerJob, label: "Part-Time" },
    { jobs: 15, weekly: 15 * cleanerEarningsPerJob, label: "Standard" },
    { jobs: 20, weekly: 20 * cleanerEarningsPerJob, label: "Full-Time" },
    { jobs: 25, weekly: 25 * cleanerEarningsPerJob, label: "Hustle Mode" },
  ];

  const whyJoin = [
    {
      icon: "calendar",
      title: "You Control Your Schedule",
      description: "Work when you want. Accept only the jobs that fit your life. Take time off whenever you need - no permission required.",
      stat: "100%",
      statLabel: "Schedule Control",
    },
    {
      icon: "dollar-sign",
      title: "Earn More Per Job",
      description: `Average $${cleanerEarningsPerJob} per cleaning. That's $${weeklyEarnings.toLocaleString()}/week at ${jobsPerWeek} jobs. Top cleaners earn $${(25 * cleanerEarningsPerJob * 4).toLocaleString()}+/month.`,
      stat: `$${cleanerEarningsPerJob}`,
      statLabel: "Per Cleaning",
    },
    {
      icon: "zap",
      title: "Get Paid Fast",
      description: "No more waiting weeks for paychecks. Complete a job, get paid within 1-2 business days directly to your bank account.",
      stat: "Fast",
      statLabel: "Payouts",
    },
    {
      icon: "shield",
      title: "Guaranteed Payment",
      description: "Never chase payments again. Clients pay through the app before you arrive. 100% of your earnings, guaranteed.",
      stat: "100%",
      statLabel: "Payment Rate",
    },
  ];

  const benefits = [
    { icon: "map-pin", text: "Jobs in your area - no long commutes" },
    { icon: "repeat", text: "Build recurring clients for steady income" },
    { icon: "star", text: "Great reviews = more job offers" },
    { icon: "trending-up", text: "Preferred cleaner perks & bonuses" },
    { icon: "message-circle", text: "In-app messaging with clients" },
    { icon: "camera", text: "Document your work with before/after photos" },
    { icon: "bell", text: "Smart notifications for new jobs" },
    { icon: "users", text: "Join a community of 500+ cleaners" },
  ];

  const requirements = [
    { icon: "check", text: "18 years or older", required: true },
    { icon: "check", text: "Reliable transportation", required: true },
    { icon: "check", text: "Smartphone with internet access", required: true },
    { icon: "check", text: "Attention to detail", required: true },
    { icon: "plus", text: "Cleaning experience (helpful but not required)", required: false },
    { icon: "plus", text: "Own cleaning supplies (we can help)", required: false },
  ];

  const howItWorks = [
    { step: "1", title: "Apply", desc: "Quick 5-min application", icon: "edit-3" },
    { step: "2", title: "Get Approved", desc: "Usually within 48 hours", icon: "check-circle" },
    { step: "3", title: "Set Availability", desc: "Choose your working hours", icon: "calendar" },
    { step: "4", title: "Start Earning", desc: "Accept jobs & get paid", icon: "dollar-sign" },
  ];

  const testimonials = [
    {
      quote: "I left my 9-5 to clean full-time. Best decision ever. I make more money, set my own hours, and actually enjoy my work.",
      name: "Jessica M.",
      earnings: "$4,200/month",
      time: "8 months on platform",
    },
    {
      quote: "Started part-time while in school. Now I have 12 regular clients and make more than my friends with office jobs.",
      name: "Marcus T.",
      earnings: "$2,800/month",
      time: "Part-time cleaner",
    },
    {
      quote: "The guaranteed payments changed everything. No more awkward conversations about money. Just clean and get paid.",
      name: "Sarah L.",
      earnings: "$3,500/month",
      time: "1 year on platform",
    },
  ];

  const faqs = [
    {
      q: "How much can I really earn?",
      a: `The average cleaner earns $${cleanerEarningsPerJob} per job after our ${Math.round(platformFeePercent * 100)}% platform fee. At 15 jobs/week, that's $${(15 * cleanerEarningsPerJob * 4).toLocaleString()}/month. Top earners doing 25 jobs/week make $${(25 * cleanerEarningsPerJob * 4).toLocaleString()}+/month.`,
    },
    {
      q: "What's the platform fee?",
      a: `We take ${Math.round(platformFeePercent * 100)}% to cover payment processing, insurance, customer support, and app development. You keep ${keepPercent}% of every job. No hidden fees, no surprises.`,
    },
    {
      q: "Do I need experience?",
      a: "No prior cleaning experience required! We provide training resources and checklists to help you deliver 5-star cleanings every time.",
    },
    {
      q: "Can I choose which jobs to take?",
      a: "Absolutely. You see job details (location, size, price) before accepting. Only take jobs that work for your schedule and preferences.",
    },
    {
      q: "How fast do I get paid?",
      a: "Within 1-2 business days of completing a job, the money is in your bank account. No waiting for bi-weekly paychecks.",
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={["#059669", "#047857", "#065f46"]}
          style={styles.heroSection}
        >
          <View style={styles.heroBadge}>
            <Feather name="briefcase" size={14} color="#a7f3d0" />
            <Text style={styles.heroBadgeText}>Now Hiring Cleaners</Text>
          </View>

          <Text style={styles.heroTitle}>
            Earn Up To{"\n"}
            <Text style={styles.heroTitleAccent}>${yearlyEarnings.toLocaleString()}/Year</Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            Set your own schedule. Keep {keepPercent}% of every job.{"\n"}
            Fast payouts. No boss. No limits.
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Feather name={stat.icon} size={16} color="#a7f3d0" />
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.heroCta} onPress={handleApplyPress}>
            <Text style={styles.heroCtaText}>Apply Now - Takes 5 Minutes</Text>
            <Feather name="arrow-right" size={20} color="#065f46" />
          </TouchableOpacity>

          <Text style={styles.heroNote}>No fees to apply. Start earning this week.</Text>
        </LinearGradient>

        {/* Earnings Calculator */}
        <View style={styles.calculatorSection}>
          <Text style={styles.sectionLabel}>EARNINGS CALCULATOR</Text>
          <Text style={styles.sectionTitle}>See What You Could Earn</Text>

          <View style={styles.calculatorCard}>
            <Text style={styles.calculatorLabel}>Jobs per week:</Text>
            <View style={styles.sliderRow}>
              {earnings.map((tier) => (
                <TouchableOpacity
                  key={tier.jobs}
                  style={[
                    styles.sliderButton,
                    jobsPerWeek === tier.jobs && styles.sliderButtonActive,
                  ]}
                  onPress={() => setJobsPerWeek(tier.jobs)}
                >
                  <Text
                    style={[
                      styles.sliderButtonText,
                      jobsPerWeek === tier.jobs && styles.sliderButtonTextActive,
                    ]}
                  >
                    {tier.jobs}
                  </Text>
                  <Text
                    style={[
                      styles.sliderButtonLabel,
                      jobsPerWeek === tier.jobs && styles.sliderButtonLabelActive,
                    ]}
                  >
                    {tier.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.earningsDisplay}>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Weekly</Text>
                <Text style={styles.earningsValue}>${weeklyEarnings.toLocaleString()}</Text>
              </View>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Monthly</Text>
                <Text style={styles.earningsValueLarge}>${monthlyEarnings.toLocaleString()}</Text>
              </View>
              <View style={styles.earningsRow}>
                <Text style={styles.earningsLabel}>Yearly</Text>
                <Text style={styles.earningsValue}>${yearlyEarnings.toLocaleString()}</Text>
              </View>
            </View>

            <View style={styles.earningsNote}>
              <Feather name="info" size={14} color={colors.primary[600]} />
              <Text style={styles.earningsNoteText}>
                Based on avg ${avgJobPrice} job price, you keep ${cleanerEarningsPerJob} ({keepPercent}%)
              </Text>
            </View>
          </View>
        </View>

        {/* Why Join Section */}
        <View style={styles.whyJoinSection}>
          <Text style={styles.sectionLabel}>WHY JOIN US</Text>
          <Text style={styles.sectionTitle}>Work On Your Terms</Text>
          <Text style={styles.sectionSubtitle}>
            No more traditional jobs with rigid schedules and low pay
          </Text>

          <View style={styles.whyJoinGrid}>
            {whyJoin.map((item, index) => (
              <View key={index} style={styles.whyJoinCard}>
                <View style={styles.whyJoinHeader}>
                  <View style={styles.whyJoinIconCircle}>
                    <Feather name={item.icon} size={20} color={colors.success[600]} />
                  </View>
                  <View style={styles.whyJoinStat}>
                    <Text style={styles.whyJoinStatValue}>{item.stat}</Text>
                    <Text style={styles.whyJoinStatLabel}>{item.statLabel}</Text>
                  </View>
                </View>
                <Text style={styles.whyJoinTitle}>{item.title}</Text>
                <Text style={styles.whyJoinDescription}>{item.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Benefits Grid */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionLabel}>PLATFORM BENEFITS</Text>
          <Text style={styles.sectionTitle}>Everything You Need to Succeed</Text>

          <View style={styles.benefitsGrid}>
            {benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Feather name={benefit.icon} size={18} color={colors.primary[600]} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <LinearGradient
          colors={[colors.primary[600], colors.primary[700]]}
          style={styles.howItWorksSection}
        >
          <Text style={styles.howItWorksLabel}>GET STARTED</Text>
          <Text style={styles.howItWorksTitle}>Start Earning in 4 Simple Steps</Text>

          <View style={styles.stepsContainer}>
            {howItWorks.map((item, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepCircle}>
                  <Feather name={item.icon} size={20} color={colors.primary[600]} />
                </View>
                {index < howItWorks.length - 1 && <View style={styles.stepLine} />}
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepDesc}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Requirements */}
        <View style={styles.requirementsSection}>
          <Text style={styles.sectionLabel}>REQUIREMENTS</Text>
          <Text style={styles.sectionTitle}>What You Need</Text>

          <View style={styles.requirementsBox}>
            {requirements.map((req, index) => (
              <View key={index} style={styles.requirementRow}>
                <View
                  style={[
                    styles.requirementIcon,
                    !req.required && styles.requirementIconOptional,
                  ]}
                >
                  <Feather
                    name={req.icon}
                    size={14}
                    color={req.required ? colors.success[600] : colors.warning[600]}
                  />
                </View>
                <Text style={styles.requirementText}>
                  {req.text}
                  {!req.required && (
                    <Text style={styles.optionalBadge}> (Optional)</Text>
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Testimonials */}
        <View style={styles.testimonialsSection}>
          <Text style={styles.sectionLabel}>CLEANER STORIES</Text>
          <Text style={styles.sectionTitle}>Hear From Our Cleaners</Text>

          {testimonials.map((testimonial, index) => (
            <View key={index} style={styles.testimonialCard}>
              <View style={styles.testimonialHeader}>
                <View style={styles.quoteIcon}>
                  <Feather name="message-circle" size={20} color={colors.success[400]} />
                </View>
                <View style={styles.testimonialStatBadge}>
                  <Text style={styles.testimonialStatText}>{testimonial.earnings}</Text>
                </View>
              </View>
              <Text style={styles.testimonialQuote}>"{testimonial.quote}"</Text>
              <View style={styles.testimonialAuthor}>
                <View style={styles.authorAvatar}>
                  <Text style={styles.authorInitial}>{testimonial.name[0]}</Text>
                </View>
                <View>
                  <Text style={styles.authorName}>{testimonial.name}</Text>
                  <Text style={styles.authorRole}>{testimonial.time}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* FAQ Section */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionLabel}>FAQ</Text>
          <Text style={styles.sectionTitle}>Common Questions</Text>

          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqCard}>
              <Text style={styles.faqQuestion}>{faq.q}</Text>
              <Text style={styles.faqAnswer}>{faq.a}</Text>
            </View>
          ))}
        </View>

        {/* Final CTA */}
        <View style={styles.finalCtaSection}>
          <Text style={styles.finalCtaTitle}>Ready to Start Earning?</Text>
          <Text style={styles.finalCtaSubtitle}>
            Join 500+ cleaners earning ${cleanerEarningsPerJob}+ per job
          </Text>

          <View style={styles.finalCtaFeatures}>
            <View style={styles.finalCtaFeatureRow}>
              <Feather name="check-circle" size={18} color="#a7f3d0" />
              <Text style={styles.finalCtaFeatureText}>Free to apply - no fees ever</Text>
            </View>
            <View style={styles.finalCtaFeatureRow}>
              <Feather name="check-circle" size={18} color="#a7f3d0" />
              <Text style={styles.finalCtaFeatureText}>Get approved in 24-48 hours</Text>
            </View>
            <View style={styles.finalCtaFeatureRow}>
              <Feather name="check-circle" size={18} color="#a7f3d0" />
              <Text style={styles.finalCtaFeatureText}>Start working this week</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.finalCtaButton} onPress={handleApplyPress}>
            <Feather name="edit-3" size={20} color="#065f46" />
            <Text style={styles.finalCtaButtonText}>Apply Now - 5 Minutes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInLink}
            onPress={() => navigate("/sign-in")}
          >
            <Text style={styles.signInLinkText}>
              Already a cleaner? Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
    backgroundColor: "rgba(167, 243, 208, 0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.lg,
  },
  heroBadgeText: {
    color: "#a7f3d0",
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
    color: "#a7f3d0",
  },
  heroSubtitle: {
    fontSize: typography.fontSize.base,
    color: "#d1fae5",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: "#a7f3d0",
    marginTop: 2,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#a7f3d0",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    ...shadows.lg,
  },
  heroCtaText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#065f46",
    marginRight: spacing.sm,
  },
  heroNote: {
    fontSize: typography.fontSize.sm,
    color: "#a7f3d0",
    marginTop: spacing.md,
  },

  // Section Styles
  sectionLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: spacing.sm,
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

  // Calculator Section
  calculatorSection: {
    padding: spacing.xl,
    backgroundColor: "#fff",
  },
  calculatorCard: {
    backgroundColor: colors.success[50],
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  calculatorLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  sliderButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    marginHorizontal: 4,
    borderRadius: radius.lg,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.success[200],
  },
  sliderButtonActive: {
    backgroundColor: colors.success[600],
    borderColor: colors.success[600],
  },
  sliderButtonText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  sliderButtonTextActive: {
    color: "#fff",
  },
  sliderButtonLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sliderButtonLabelActive: {
    color: "#d1fae5",
  },
  earningsDisplay: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  earningsLabel: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  earningsValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  earningsValueLarge: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.success[600],
  },
  earningsNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  earningsNoteText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginLeft: spacing.xs,
  },

  // Why Join Section
  whyJoinSection: {
    padding: spacing.xl,
    backgroundColor: "#f0fdf4",
  },
  whyJoinGrid: {
    gap: spacing.md,
  },
  whyJoinCard: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    ...shadows.sm,
  },
  whyJoinHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  whyJoinIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.success[50],
    alignItems: "center",
    justifyContent: "center",
  },
  whyJoinStat: {
    alignItems: "flex-end",
  },
  whyJoinStatValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.success[600],
  },
  whyJoinStatLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },
  whyJoinTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  whyJoinDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Benefits Section
  benefitsSection: {
    padding: spacing.xl,
    backgroundColor: "#fff",
  },
  benefitsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.md,
  },
  benefitItem: {
    width: "50%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  benefitText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    lineHeight: 18,
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
  },
  stepItem: {
    width: "23%",
    alignItems: "center",
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  stepLine: {
    position: "absolute",
    top: 22,
    right: -15,
    width: 30,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  stepTitle: {
    fontSize: typography.fontSize.sm,
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

  // Requirements Section
  requirementsSection: {
    padding: spacing.xl,
    backgroundColor: "#f8fafc",
  },
  requirementsBox: {
    backgroundColor: "#fff",
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  requirementIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success[50],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  requirementIconOptional: {
    backgroundColor: colors.warning[50],
  },
  requirementText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  optionalBadge: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },

  // Testimonials Section
  testimonialsSection: {
    padding: spacing.xl,
    backgroundColor: "#fff",
  },
  testimonialCard: {
    backgroundColor: "#f0fdf4",
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  testimonialHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  quoteIcon: {},
  testimonialStatBadge: {
    backgroundColor: colors.success[600],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  testimonialStatText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
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
    backgroundColor: colors.success[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  authorInitial: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
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

  // FAQ Section
  faqSection: {
    padding: spacing.xl,
    backgroundColor: "#f8fafc",
  },
  faqCard: {
    backgroundColor: "#fff",
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  faqQuestion: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  faqAnswer: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Final CTA Section
  finalCtaSection: {
    padding: spacing.xl,
    paddingVertical: spacing["3xl"],
    backgroundColor: "#065f46",
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
    color: "#a7f3d0",
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
    color: "#d1fae5",
    marginLeft: spacing.sm,
  },
  finalCtaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#a7f3d0",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing["2xl"],
    borderRadius: radius.xl,
    ...shadows.lg,
    marginBottom: spacing.lg,
  },
  finalCtaButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: "#065f46",
    marginLeft: spacing.sm,
  },
  signInLink: {
    paddingVertical: spacing.sm,
  },
  signInLinkText: {
    fontSize: typography.fontSize.base,
    color: "#a7f3d0",
  },
});

export default NewCleanerInformationPage;
