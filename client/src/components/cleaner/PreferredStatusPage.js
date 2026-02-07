import React, { useState, useEffect, useContext } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { UserContext } from "../../context/UserContext";
import PreferredCleanerService from "../../services/fetchRequests/PreferredCleanerService";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../services/styles/theme";

// Shorthand for font sizes
const fontSize = typography.fontSize;

// Tier configuration with colors and icons
const TIER_CONFIG = {
  bronze: {
    color: "#CD7F32",
    bgColor: "#FDF4E8",
    icon: "trophy",
    label: "Bronze",
  },
  silver: {
    color: "#71717A",
    bgColor: "#F4F4F5",
    icon: "trophy",
    label: "Silver",
  },
  gold: {
    color: "#CA8A04",
    bgColor: "#FEF9C3",
    icon: "star",
    label: "Gold",
  },
  platinum: {
    color: "#6366F1",
    bgColor: "#EEF2FF",
    icon: "diamond",
    label: "Platinum",
  },
};

// Default tier thresholds (fallback if API doesn't return them)
const DEFAULT_TIER_THRESHOLDS = {
  bronze: { min: 1, max: 2 },
  silver: { min: 3, max: 5 },
  gold: { min: 6, max: 10 },
  platinum: { min: 11, max: null },
};

// Helper to build tier thresholds from API data
const buildTierThresholds = (tierInfo) => {
  if (!tierInfo || !tierInfo.tiers || tierInfo.tiers.length === 0) {
    return DEFAULT_TIER_THRESHOLDS;
  }

  const thresholds = {};
  const tierNames = ["bronze", "silver", "gold", "platinum"];

  tierInfo.tiers.forEach((tier, index) => {
    const tierName = tierNames[index] || tier.name?.toLowerCase();
    if (tierName) {
      thresholds[tierName] = {
        min: tier.minHomes,
        max: tier.maxHomes,
        bonusPercent: tier.bonusPercent || 0,
        fasterPayouts: tier.fasterPayouts || false,
        payoutHours: tier.payoutHours || 48,
        earlyAccess: tier.earlyAccess || false,
        perks: tier.perks || [],
      };
    }
  });

  return Object.keys(thresholds).length > 0 ? thresholds : DEFAULT_TIER_THRESHOLDS;
};

// Helper to build dynamic tier details from API data
const buildTierDetails = (tierThresholds) => {
  const tierOrder = ["bronze", "silver", "gold", "platinum"];

  return {
    bronze: {
      requirement: `${tierThresholds.bronze?.min || 1}-${tierThresholds.bronze?.max || 2} preferred homes`,
      tagline: "Start Your Journey",
      description: "You're building trust with homeowners. Keep delivering excellent service to grow your preferred client base.",
      benefits: [
        { icon: "star", text: "Preferred cleaner recognition on your profile" },
        { icon: "bolt", text: "Priority notifications when preferred homes book" },
        { icon: "shield", text: "Homeowners see you first for their bookings" },
      ],
      unlocks: tierThresholds.silver
        ? `Reach ${tierThresholds.silver.min} preferred homes to unlock Silver tier and start earning bonuses!`
        : null,
    },
    silver: {
      requirement: `${tierThresholds.silver?.min || 3}-${tierThresholds.silver?.max || 5} preferred homes`,
      tagline: "Earning Bonuses",
      description: "You've proven yourself to multiple homeowners. Now you're earning bonus rewards on every preferred job.",
      benefits: [
        { icon: "check", text: "All Bronze tier benefits" },
        { icon: "percent", text: `+${tierThresholds.silver?.bonusPercent || 3}% earnings bonus on all preferred home jobs`, highlight: true },
        { icon: "users", text: "Growing reputation attracts more clients" },
      ],
      unlocks: tierThresholds.gold
        ? `Reach ${tierThresholds.gold.min} preferred homes to unlock Gold tier with ${tierThresholds.gold.bonusPercent || 5}% bonus and faster payouts!`
        : null,
    },
    gold: {
      requirement: `${tierThresholds.gold?.min || 6}-${tierThresholds.gold?.max || 10} preferred homes`,
      tagline: "Premium Rewards",
      description: "You're a trusted professional with a strong client base. Enjoy increased bonuses and faster access to your earnings.",
      benefits: [
        { icon: "check", text: "All Silver tier benefits" },
        { icon: "percent", text: `+${tierThresholds.gold?.bonusPercent || 5}% earnings bonus on all preferred home jobs`, highlight: true },
        { icon: "clock-o", text: `Faster payouts - receive earnings in ${tierThresholds.gold?.payoutHours || 24} hours`, highlight: tierThresholds.gold?.fasterPayouts },
        { icon: "line-chart", text: "Priority placement in search results" },
      ],
      unlocks: tierThresholds.platinum
        ? `Reach ${tierThresholds.platinum.min} preferred homes to unlock Platinum - our highest tier!`
        : null,
    },
    platinum: {
      requirement: `${tierThresholds.platinum?.min || 11}+ preferred homes`,
      tagline: "Elite Status",
      description: "You're among our top cleaners with an exceptional reputation. Enjoy maximum rewards and exclusive early access to opportunities.",
      benefits: [
        { icon: "check", text: "All Gold tier benefits" },
        { icon: "percent", text: `+${tierThresholds.platinum?.bonusPercent || 7}% earnings bonus on all preferred home jobs`, highlight: true },
        { icon: "clock-o", text: `Fastest payouts - earnings in ${tierThresholds.platinum?.payoutHours || 24} hours` },
        { icon: "eye", text: "Early access to new job listings before other cleaners", highlight: tierThresholds.platinum?.earlyAccess },
        { icon: "diamond", text: "Platinum badge displayed on your profile", highlight: true },
        { icon: "trophy", text: "Recognition as a top-tier professional" },
      ],
      unlocks: null, // Max tier
    },
  };
};

// Benefit Card Component
const BenefitCard = ({ icon, title, description, active, highlight }) => (
  <View style={[styles.benefitCard, active && styles.benefitCardActive, highlight && styles.benefitCardHighlight]}>
    <View style={[styles.benefitIconContainer, active && styles.benefitIconActive]}>
      <Icon name={icon} size={18} color={active ? colors.primary[600] : colors.text.tertiary} />
    </View>
    <View style={styles.benefitContent}>
      <Text style={[styles.benefitTitle, active && styles.benefitTitleActive]}>{title}</Text>
      <Text style={styles.benefitDescription}>{description}</Text>
    </View>
    {active && (
      <Icon name="check-circle" size={18} color={colors.success[500]} />
    )}
  </View>
);

// Tier Progress Component
const TierProgress = ({ currentTier, currentHomes, nextTier, nextTierMinHomes, tierThresholds }) => {
  const tierOrder = ["bronze", "silver", "gold", "platinum"];
  const currentIndex = tierOrder.indexOf(currentTier);
  const thresholds = tierThresholds || DEFAULT_TIER_THRESHOLDS;

  // Calculate progress percentage
  let progressPercent = 100;
  if (nextTier && nextTierMinHomes) {
    const currentTierMin = thresholds[currentTier]?.min || 1;
    const range = nextTierMinHomes - currentTierMin;
    const progress = currentHomes - currentTierMin;
    progressPercent = Math.min(100, Math.max(0, (progress / range) * 100));
  }

  const homesNeeded = nextTierMinHomes ? nextTierMinHomes - currentHomes : 0;

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>
          {nextTier ? "Progress to Next Tier" : "Maximum Tier Reached!"}
        </Text>
        {nextTier && (
          <Text style={styles.progressSubtitle}>
            {homesNeeded} more home{homesNeeded !== 1 ? "s" : ""} to {TIER_CONFIG[nextTier]?.label}
          </Text>
        )}
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: TIER_CONFIG[currentTier]?.color }
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelCurrent}>{currentHomes} homes</Text>
          {nextTier && (
            <Text style={styles.progressLabelNext}>{nextTierMinHomes} homes</Text>
          )}
        </View>
      </View>

      {/* Tier milestones */}
      <View style={styles.milestonesContainer}>
        {tierOrder.map((tier, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = tier === currentTier;
          const tierConfig = TIER_CONFIG[tier];

          return (
            <View key={tier} style={styles.milestone}>
              <View
                style={[
                  styles.milestoneIcon,
                  isCompleted && { backgroundColor: tierConfig.color },
                  isCurrent && { backgroundColor: tierConfig.color, borderWidth: 3, borderColor: tierConfig.color + "40" },
                  !isCompleted && !isCurrent && styles.milestoneIconInactive,
                ]}
              >
                <Icon
                  name={isCompleted || isCurrent ? "check" : tierConfig.icon}
                  size={12}
                  color={isCompleted || isCurrent ? "#fff" : colors.text.tertiary}
                />
              </View>
              <Text style={[
                styles.milestoneLabel,
                (isCompleted || isCurrent) && { color: tierConfig.color, fontWeight: "600" }
              ]}>
                {tierConfig.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

// Preferred Home Card Component
const PreferredHomeCard = ({ home }) => (
  <View style={styles.homeCard}>
    <View style={styles.homeIconContainer}>
      <Icon name="home" size={18} color={colors.primary[600]} />
    </View>
    <View style={styles.homeContent}>
      <Text style={styles.homeNickname}>{home.nickName || "Home"}</Text>
      <Text style={styles.homeAddress}>
        {home.city}, {home.state}
      </Text>
      {home.preferenceLevel === "favorite" && (
        <View style={styles.favoriteBadge}>
          <Icon name="heart" size={10} color={colors.error[500]} />
          <Text style={styles.favoriteText}>Favorite</Text>
        </View>
      )}
    </View>
    <Text style={styles.homeDate}>
      Since {new Date(home.setAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
    </Text>
  </View>
);

// Tier details with full explanations
const TIER_DETAILS = {
  bronze: {
    requirement: "1-2 preferred homes",
    tagline: "Start Your Journey",
    description: "You're building trust with homeowners. Keep delivering excellent service to grow your preferred client base.",
    benefits: [
      { icon: "star", text: "Preferred cleaner recognition on your profile" },
      { icon: "bolt", text: "Priority notifications when preferred homes book" },
      { icon: "shield", text: "Homeowners see you first for their bookings" },
    ],
    unlocks: "Reach 3 preferred homes to unlock Silver tier and start earning bonuses!",
  },
  silver: {
    requirement: "3-5 preferred homes",
    tagline: "Earning Bonuses",
    description: "You've proven yourself to multiple homeowners. Now you're earning bonus rewards on every preferred job.",
    benefits: [
      { icon: "check", text: "All Bronze tier benefits" },
      { icon: "percent", text: "+3% earnings bonus on all preferred home jobs", highlight: true },
      { icon: "users", text: "Growing reputation attracts more clients" },
    ],
    unlocks: "Reach 6 preferred homes to unlock Gold tier with 5% bonus and faster payouts!",
  },
  gold: {
    requirement: "6-10 preferred homes",
    tagline: "Premium Rewards",
    description: "You're a trusted professional with a strong client base. Enjoy increased bonuses and faster access to your earnings.",
    benefits: [
      { icon: "check", text: "All Silver tier benefits" },
      { icon: "percent", text: "+5% earnings bonus on all preferred home jobs", highlight: true },
      { icon: "clock-o", text: "Faster payouts - receive earnings in 24 hours instead of 48", highlight: true },
      { icon: "line-chart", text: "Priority placement in search results" },
    ],
    unlocks: "Reach 11 preferred homes to unlock Platinum - our highest tier!",
  },
  platinum: {
    requirement: "11+ preferred homes",
    tagline: "Elite Status",
    description: "You're among our top cleaners with an exceptional reputation. Enjoy maximum rewards and exclusive early access to opportunities.",
    benefits: [
      { icon: "check", text: "All Gold tier benefits" },
      { icon: "percent", text: "+7% earnings bonus on all preferred home jobs", highlight: true },
      { icon: "clock-o", text: "Fastest payouts - earnings in 24 hours" },
      { icon: "eye", text: "Early access to new job listings before other cleaners", highlight: true },
      { icon: "diamond", text: "Platinum badge displayed on your profile", highlight: true },
      { icon: "trophy", text: "Recognition as a top-tier professional" },
    ],
    unlocks: null, // Max tier
  },
};

// Tier Info Card Component
const TierInfoCard = ({ tier, config, isCurrentTier, tierDetails }) => {
  const [isExpanded, setIsExpanded] = useState(isCurrentTier);
  const details = tierDetails ? tierDetails[tier] : TIER_DETAILS[tier];

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={[styles.tierInfoCard, isCurrentTier && { borderColor: config.color, borderWidth: 2 }]}>
      <Pressable style={styles.tierInfoHeader} onPress={toggleExpanded}>
        <View style={[styles.tierInfoIconContainer, { backgroundColor: config.bgColor }]}>
          <Icon name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.tierInfoTitleContainer}>
          <View style={styles.tierInfoTitleRow}>
            <Text style={[styles.tierInfoTitle, { color: config.color }]}>{config.label}</Text>
            {isCurrentTier && (
              <View style={[styles.currentBadge, { backgroundColor: config.color }]}>
                <Text style={styles.currentBadgeText}>Current</Text>
              </View>
            )}
          </View>
          <Text style={styles.tierTagline}>{details.tagline}</Text>
        </View>
        <Icon
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.text.tertiary}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.tierInfoContent}>
          <View style={styles.tierRequirementBadge}>
            <Icon name="home" size={12} color={config.color} />
            <Text style={[styles.tierInfoRequirement, { color: config.color }]}>
              {details.requirement}
            </Text>
          </View>

          <Text style={styles.tierDescription}>{details.description}</Text>

          <View style={styles.tierBenefitsList}>
            {details.benefits.map((benefit, index) => (
              <View
                key={index}
                style={[
                  styles.tierBenefitItem,
                  benefit.highlight && styles.tierBenefitItemHighlight
                ]}
              >
                <Icon
                  name={benefit.icon}
                  size={14}
                  color={benefit.highlight ? config.color : colors.success[500]}
                />
                <Text style={[
                  styles.tierBenefitText,
                  benefit.highlight && { color: colors.text.primary, fontWeight: "500" }
                ]}>
                  {benefit.text}
                </Text>
              </View>
            ))}
          </View>

          {details.unlocks && (
            <View style={styles.unlockHint}>
              <Icon name="arrow-up" size={12} color={colors.primary[600]} />
              <Text style={styles.unlockHintText}>{details.unlocks}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// Main Component
const PreferredStatusPage = ({ state }) => {
  const { state: contextState } = useContext(UserContext);
  const currentState = state || contextState;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [perkStatus, setPerkStatus] = useState(null);
  const [preferredHomes, setPreferredHomes] = useState([]);
  const [tierInfo, setTierInfo] = useState(null);

  const fetchData = async () => {
    try {
      const token = currentState?.currentUser?.token;
      if (!token) return;

      const [statusRes, homesRes, tierRes] = await Promise.all([
        PreferredCleanerService.getMyPerkStatus(token),
        PreferredCleanerService.getMyPreferredHomes(token),
        PreferredCleanerService.getTierInfo(token),
      ]);

      setPerkStatus(statusRes);
      setPreferredHomes(homesRes?.preferredHomes || []);
      setTierInfo(tierRes);
    } catch (err) {
      console.error("[PreferredStatusPage] Error fetching data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentState?.currentUser?.token]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.loadingText}>Loading your preferred status...</Text>
      </View>
    );
  }

  const currentTier = perkStatus?.tier || "bronze";
  const tierConfig = TIER_CONFIG[currentTier];
  const tierOrder = ["bronze", "silver", "gold", "platinum"];
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const nextTier = currentTierIndex < tierOrder.length - 1 ? tierOrder[currentTierIndex + 1] : null;

  // Build dynamic tier thresholds and details from API data
  const tierThresholds = buildTierThresholds(tierInfo);
  const dynamicTierDetails = buildTierDetails(tierThresholds);
  const nextTierMinHomes = nextTier ? tierThresholds[nextTier]?.min : null;

  // If no preferred status yet
  if (!perkStatus || perkStatus.preferredHomeCount === 0) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyStateIcon}>
            <Icon name="star-o" size={48} color={colors.text.tertiary} />
          </View>
          <Text style={styles.emptyStateTitle}>Become a Preferred Cleaner</Text>
          <Text style={styles.emptyStateDescription}>
            When homeowners love your work, they can mark you as their preferred cleaner.
            Build your reputation and unlock exclusive benefits!
          </Text>

          <View style={styles.howItWorksSection}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.stepsList}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Deliver Great Service</Text>
                  <Text style={styles.stepDescription}>
                    Provide excellent cleaning and build relationships with homeowners
                  </Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Get Marked as Preferred</Text>
                  <Text style={styles.stepDescription}>
                    Happy homeowners can set you as their preferred cleaner
                  </Text>
                </View>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Unlock Rewards</Text>
                  <Text style={styles.stepDescription}>
                    Earn bonuses, faster payouts, and priority access to jobs
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Show all tiers */}
          <View style={styles.allTiersSection}>
            <Text style={styles.sectionTitle}>Tier Benefits</Text>
            {tierOrder.map(tier => (
              <TierInfoCard
                key={tier}
                tier={tier}
                config={TIER_CONFIG[tier]}
                isCurrentTier={false}
                tierDetails={dynamicTierDetails}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Current Tier Hero Section */}
      <View style={[styles.heroSection, { backgroundColor: tierConfig.bgColor }]}>
        <View style={[styles.heroIconContainer, { backgroundColor: tierConfig.color }]}>
          <Icon name={tierConfig.icon} size={32} color="#fff" />
        </View>
        <Text style={[styles.heroTierLabel, { color: tierConfig.color }]}>
          {tierConfig.label} Tier
        </Text>
        <Text style={styles.heroSubtitle}>Preferred Cleaner Status</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{perkStatus.preferredHomeCount}</Text>
            <Text style={styles.heroStatLabel}>Preferred Homes</Text>
          </View>
          {perkStatus.bonusPercent > 0 && (
            <View style={styles.heroStatDivider} />
          )}
          {perkStatus.bonusPercent > 0 && (
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>+{perkStatus.bonusPercent}%</Text>
              <Text style={styles.heroStatLabel}>Earnings Bonus</Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress Section */}
      <TierProgress
        currentTier={currentTier}
        currentHomes={perkStatus.preferredHomeCount}
        nextTier={nextTier}
        nextTierMinHomes={nextTierMinHomes}
        tierThresholds={tierThresholds}
      />

      {/* Current Benefits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Current Benefits</Text>

        <BenefitCard
          icon="star"
          title="Preferred Status"
          description="You're recognized as a preferred cleaner by homeowners"
          active={true}
        />

        <BenefitCard
          icon="bolt"
          title="Priority Access"
          description="Get first access to jobs at your preferred homes"
          active={true}
        />

        {perkStatus.bonusPercent > 0 && (
          <BenefitCard
            icon="percent"
            title={`+${perkStatus.bonusPercent}% Earnings Bonus`}
            description="Extra earnings on all preferred home jobs"
            active={true}
            highlight={true}
          />
        )}

        {perkStatus.fasterPayouts && (
          <BenefitCard
            icon="clock-o"
            title="Faster Payouts"
            description={`Receive payments in ${perkStatus.payoutHours || 24} hours`}
            active={true}
          />
        )}

        {perkStatus.earlyAccess && (
          <BenefitCard
            icon="eye"
            title="Early Job Access"
            description="See new job listings before other cleaners"
            active={true}
            highlight={true}
          />
        )}

        {/* Upcoming benefits (inactive) */}
        {!perkStatus.bonusPercent && (
          <BenefitCard
            icon="percent"
            title="Earnings Bonus"
            description="Reach Silver tier to unlock earnings bonuses"
            active={false}
          />
        )}

        {!perkStatus.fasterPayouts && (
          <BenefitCard
            icon="clock-o"
            title="Faster Payouts"
            description="Reach Gold tier for 24-hour payouts"
            active={false}
          />
        )}

        {!perkStatus.earlyAccess && (
          <BenefitCard
            icon="eye"
            title="Early Job Access"
            description="Reach Platinum tier for early access to jobs"
            active={false}
          />
        )}
      </View>

      {/* All Tiers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All Tier Levels</Text>
        {tierOrder.map(tier => (
          <TierInfoCard
            key={tier}
            tier={tier}
            config={TIER_CONFIG[tier]}
            isCurrentTier={tier === currentTier}
            tierDetails={dynamicTierDetails}
          />
        ))}
      </View>

      {/* Preferred Homes List */}
      {preferredHomes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Preferred Homes</Text>
          <Text style={styles.sectionSubtitle}>
            Homes where you're marked as a preferred cleaner
          </Text>
          {preferredHomes.map((home, index) => (
            <PreferredHomeCard key={home.homeId || index} home={home} />
          ))}
        </View>
      )}

      {/* Tips Section */}
      <View style={styles.tipsSection}>
        <View style={styles.tipsHeader}>
          <Icon name="lightbulb-o" size={20} color={colors.warning[600]} />
          <Text style={styles.tipsTitle}>Tips to Grow Your Status</Text>
        </View>
        <View style={styles.tipsList}>
          <Text style={styles.tipItem}>• Communicate clearly with homeowners</Text>
          <Text style={styles.tipItem}>• Pay attention to their specific preferences</Text>
          <Text style={styles.tipItem}>• Arrive on time and be reliable</Text>
          <Text style={styles.tipItem}>• Go above and beyond when possible</Text>
          <Text style={styles.tipItem}>• Ask satisfied clients to mark you as preferred</Text>
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.primary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },

  // Hero Section
  heroSection: {
    padding: spacing.xl,
    alignItems: "center",
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  heroTierLabel: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  heroStatLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.lg,
  },

  // Progress Section
  progressSection: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.lg,
  },
  progressHeader: {
    marginBottom: spacing.md,
  },
  progressTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
  },
  progressSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  progressBarContainer: {
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.border.light,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  progressLabelCurrent: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  progressLabelNext: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  milestonesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  milestone: {
    alignItems: "center",
  },
  milestoneIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  milestoneIconInactive: {
    backgroundColor: colors.border.light,
  },
  milestoneLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },

  // Sections
  section: {
    margin: spacing.lg,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },

  // Benefit Cards
  benefitCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  benefitCardActive: {
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  benefitCardHighlight: {
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  benefitIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  benefitIconActive: {
    backgroundColor: colors.primary[100],
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.secondary,
  },
  benefitTitleActive: {
    color: colors.text.primary,
  },
  benefitDescription: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },

  // Tier Info Cards
  tierInfoCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  tierInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  tierInfoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  tierInfoTitleContainer: {
    flex: 1,
  },
  tierInfoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tierInfoTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
  },
  tierTagline: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  currentBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  currentBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: "#fff",
  },
  tierInfoContent: {
    padding: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  tierRequirementBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.background.secondary,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  tierInfoRequirement: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  tierDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tierBenefitsList: {
    gap: spacing.sm,
  },
  tierBenefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tierBenefitItemHighlight: {
    backgroundColor: colors.primary[50],
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  tierBenefitText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  unlockHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    borderStyle: "dashed",
  },
  unlockHintText: {
    fontSize: fontSize.sm,
    color: colors.primary[600],
    fontWeight: "500",
    flex: 1,
  },

  // Home Cards
  homeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  homeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  homeContent: {
    flex: 1,
  },
  homeNickname: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.primary,
  },
  homeAddress: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  favoriteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  favoriteText: {
    fontSize: fontSize.xs,
    color: colors.error[500],
    fontWeight: "500",
  },
  homeDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },

  // Tips Section
  tipsSection: {
    margin: spacing.lg,
    marginTop: 0,
    padding: spacing.lg,
    backgroundColor: colors.warning[50],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  tipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tipsTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.warning[700],
  },
  tipsList: {
    gap: spacing.xs,
  },
  tipItem: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  // Empty State
  emptyStateContainer: {
    padding: spacing.xl,
  },
  emptyStateIcon: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptyStateDescription: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },

  // How It Works
  howItWorksSection: {
    marginBottom: spacing.xl,
  },
  stepsList: {
    gap: spacing.md,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary[600],
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  stepNumberText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: "#fff",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: fontSize.base,
    fontWeight: "500",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  stepDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },

  // All Tiers Section
  allTiersSection: {
    marginTop: spacing.lg,
  },

  bottomSpacer: {
    height: spacing.xl,
  },
});

export default PreferredStatusPage;
