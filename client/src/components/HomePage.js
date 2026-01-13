import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  Platform,
} from "react-native";
import { useNavigate } from "react-router-native";
import { cleaningCompany } from "../services/data/companyInfo";
import { usePricing, defaultPricing } from "../context/PricingContext";
import FetchData from "../services/fetchRequests/fetchData";
import image1 from "../services/photos/Best-Cleaning-Service.jpeg";
import image2 from "../services/photos/clean-laptop.jpg";
import image3 from "../services/photos/cleaning-tech.png";
import image4 from "../services/photos/cleaning_supplies_on_floor.jpg";
import homePageStyles from "../services/styles/HomePageStyles";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  responsive,
} from "../services/styles/theme";
import NextAppointment from "./employeeAssignments/tiles/NextAppointment";
import TodaysAppointment from "./employeeAssignments/tiles/TodaysAppointment";
import ReviewsOverview from "./reviews/ReviewsOverview";
import GetHelpButton from "./messaging/GetHelpButton";
import TaxFormsSection from "./tax/TaxFormsSection";
import OwnerDashboard from "./owner/OwnerDashboard";
import HRDashboard from "./hr/HRDashboard";
import ClientDashboard from "./client/ClientDashboard";
import CleanerDashboard from "./cleaner/CleanerDashboard";
import { EmployeeDashboard } from "./businessEmployee";
import IncentiveBanner from "./incentives/IncentiveBanner";
import IncentivesService from "../services/fetchRequests/IncentivesService";

const HomePage = ({ state, dispatch }) => {
  const [redirect, setRedirect] = useState(false);
  const [redirectToJobs, setRedirectToJobs] = useState(false);
  const [incentiveConfig, setIncentiveConfig] = useState(null);
  const navigate = useNavigate();
  const { width } = Dimensions.get("window");

  // Fetch incentive config for landing page banner
  useEffect(() => {
    if (!state.currentUser.token) {
      IncentivesService.getCurrentIncentives().then(setIncentiveConfig);
    }
  }, [state.currentUser.token]);

  // Get pricing from database (via PricingContext)
  const { pricing: fetchedPricing, loading } = usePricing();

  // Use fetched pricing if available, otherwise fall back to defaults
  const pricing = fetchedPricing?.basePrice ? fetchedPricing : defaultPricing;

  // Display the full base price (no platform fee deduction - that's only shown to cleaners)
  const displayBasePrice = Math.round(
    pricing.basePrice ?? defaultPricing.basePrice
  );

  useEffect(() => {
    if (redirect) {
      navigate("/employee-assignments");
      setRedirect(false);
    }
    if (redirectToJobs) {
      navigate("/new-job-choice");
      setRedirectToJobs(false);
    }
  }, [redirect, redirectToJobs]);

  const handlePress = () => setRedirect(true);
  const handlePressToJobsList = () => setRedirectToJobs(true);

  useEffect(() => {
    if (!state.currentUser.token) return;
    if (state.account === "cleaner") {
      FetchData.get("/api/v1/employee-info", state.currentUser.token).then(
        (response) => {
          if (response?.employee?.cleanerAppointments) {
            dispatch({
              type: "USER_APPOINTMENTS",
              payload: response.employee.cleanerAppointments,
            });
          }
        }
      );
    } else {
      FetchData.get("/api/v1/user-info", state.currentUser.token).then(
        (response) => {
          if (response?.user) {
            dispatch({ type: "USER_HOME", payload: response.user.homes || [] });
            dispatch({
              type: "USER_APPOINTMENTS",
              payload: response.user.appointments || [],
            });
            dispatch({ type: "DB_BILL", payload: response.user.bill });
          }
        }
      );
      FetchData.get(
        "/api/v1/appointments/my-requests",
        state.currentUser.token
      ).then((response) => {
        if (response?.pendingRequestsEmployee) {
          dispatch({
            type: "CLEANING_REQUESTS",
            payload: response.pendingRequestsEmployee,
          });
        }
      });
    }
  }, []);

  let todaysAppointment = null;
  let nextAppointment = null;
  let foundToday = false;
  let upcomingPayment = 0;

  const sortedAppointments = state.appointments.sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  sortedAppointments.forEach((appointment, index) => {
    const correctedAmount = Number(appointment.price) * cleanerSharePercent;
    upcomingPayment += correctedAmount;
    const today = new Date();
    const appointmentDate = new Date(appointment.date);

    if (appointmentDate.toDateString() === today.toDateString()) {
      foundToday = true;
      todaysAppointment = (
        <TodaysAppointment
          appointment={appointment}
          token={state.currentUser.token}
        />
      );
      if (index < sortedAppointments.length - 1) {
        nextAppointment = (
          <View style={{ marginVertical: 15 }}>
            <NextAppointment appointment={sortedAppointments[index + 1]} />
            <Pressable
              style={{
                backgroundColor: "#f9bc60",
                paddingVertical: 14,
                paddingHorizontal: 25,
                borderRadius: 25,
                alignSelf: "center",
                marginTop: 20,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: 3,
              }}
              onPress={handlePress}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                View All Appointments
              </Text>
            </Pressable>
          </View>
        );
      }
    } else if (!nextAppointment && appointmentDate > today) {
      nextAppointment = (
        <View style={{ marginVertical: 15 }}>
          <NextAppointment appointment={appointment} />
          <Pressable
            style={{
              backgroundColor: "#f9bc60",
              paddingVertical: 14,
              paddingHorizontal: 25,
              borderRadius: 25,
              alignSelf: "center",
              marginTop: 20,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 2 },
              shadowRadius: 4,
              elevation: 3,
            }}
            onPress={handlePress}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
              View All Appointments
            </Text>
          </Pressable>
        </View>
      );
    }
  });

  if (!foundToday && !nextAppointment) {
    nextAppointment = (
      <View style={{ marginVertical: 20, alignItems: "center" }}>
        <Text style={{ ...homePageStyles.title, fontSize: 18 }}>
          No appointments scheduled.
        </Text>
        <Pressable
          onPress={handlePressToJobsList}
          style={{
            marginTop: 15,
            backgroundColor: "#007AFF",
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 25,
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
            Schedule Jobs
          </Text>
        </Pressable>
      </View>
    );
  } else if (!foundToday) {
    todaysAppointment = (
      <View style={{ marginVertical: 20, alignItems: "center" }}>
        <Text style={{ ...homePageStyles.homeTileTitle }}>
          Expected payout:
        </Text>
        <Text
          style={{
            ...homePageStyles.homeTileTitle,
            fontSize: 28,
            fontStyle: "italic",
            marginVertical: 5,
          }}
        >
          ${upcomingPayment.toFixed(2)}
        </Text>
        <Text style={{ ...homePageStyles.homeTileTitle, marginBottom: 20 }}>
          After scheduled cleanings are completed!
        </Text>
        <Text style={{ ...homePageStyles.title, marginBottom: 15 }}>
          No appointments scheduled for today
        </Text>
        <Text style={{ ...homePageStyles.smallTitle }}>Next cleaning:</Text>
      </View>
    );
  }

  const cardStyle = {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  };

  // Show Owner Dashboard for owners
  if (state.account === "owner" && state.currentUser.token) {
    return <OwnerDashboard state={state} />;
  }

  // Show HR Dashboard for HR staff
  if (state.account === "humanResources" && state.currentUser.token) {
    return <HRDashboard state={state} dispatch={dispatch} />;
  }

  // Show Employee Dashboard for business employees (no marketplace access)
  if (state.account === "employee" && state.currentUser.token) {
    return <EmployeeDashboard state={state} />;
  }

  // Show Cleaner Dashboard for marketplace cleaners
  if (state.account === "cleaner" && state.currentUser.token) {
    return <CleanerDashboard state={state} dispatch={dispatch} />;
  }

  // Show Client Dashboard for logged-in homeowners (not cleaner, not owner)
  if (state.currentUser.token && state.account !== "cleaner") {
    return <ClientDashboard state={state} dispatch={dispatch} />;
  }

  // Landing page for unauthenticated users

  // Calculate cost savings
  const avgCleaningPrice = displayBasePrice;
  const managementFeePercent = 20; // Traditional management companies charge 20-30%
  const avgRentalIncome = 250; // Average per night
  const nightsPerMonth = 15;
  const monthlyRentalIncome = avgRentalIncome * nightsPerMonth;
  const traditionalManagementFee = Math.round(
    monthlyRentalIncome * (managementFeePercent / 100)
  );
  const ourMonthlyCleaningCost = Math.round(avgCleaningPrice * 4); // ~4 turnovers per month
  const monthlySavings = traditionalManagementFee - ourMonthlyCleaningCost;
  const yearlySavings = monthlySavings * 12;

  const features = [
    {
      icon: "trending-up",
      title: "Effortless Booking",
      description:
        "Schedule professional cleanings in seconds—on demand or recurring. Designed for hosts who value speed, simplicity, and control.",
    },
    {
      icon: "clock",
      title: "Precisely Timed Turnovers",
      description:
        "Flexible service windows (10am–4pm) align seamlessly with guest check-outs and check-ins, ensuring every stay starts spotless.",
    },
    {
      icon: "shield",
      title: "Trusted, Elite Cleaners",
      description:
        "Every cleaner is background-checked, professionally trained, and held to five-star standards—so your property is always in expert hands.",
    },
    {
      icon: "calendar",
      title: "Smart Calendar Sync",
      description:
        "Connect your AirBNB, VRBO, or any other app calendar. When guests check out, we automatically schedule the clean—no coordination required.",
    },
  ];

  const stats = [
    // { value: "500+", label: "Happy Hosts" },
    // { value: "10,000+", label: "Cleanings Done" },
    // { value: "4.9", label: "Average Rating" },
    { value: "$0", label: "Monthly Fee" },
    { value: "Book now", label: "Pay just before the appointment" },
  ];

  const valueProps = [
    {
      icon: "dollar-sign",
      title: `Save $${yearlySavings.toLocaleString()}/Year`,
      description: `vs traditional property managers who take ${managementFeePercent}% of your revenue. Pay only for cleanings, keep the rest.`,
      highlight: `$${monthlySavings}/mo savings`,
    },
    {
      icon: "trending-up",
      title: "Boost Your Reviews",
      description:
        "Properties using pro cleaners average 0.4 stars higher on Airbnb. Better reviews = more bookings = more income.",
      highlight: "+15% bookings",
    },
    {
      icon: "clock",
      title: "Get 10+ Hours Back",
      description:
        "Stop coordinating cleaners, chasing no-shows, and doing turnovers yourself. We handle everything.",
      highlight: "10hrs/month saved",
    },
    {
      icon: "shield",
      title: "Never Get Caught Off Guard",
      description:
        "Automated reminders, real-time updates, and backup cleaners if needed. Your property is always guest-ready.",
      highlight: "99.5% on-time",
    },
  ];

  const testimonials = [
    {
      text: "I switched from a property manager and save $4,800/year. The cleaning quality is actually better and I have full control over my rental.",
      author: "Sarah M.",
      role: "Airbnb Superhost, 3 properties",
      stat: "$4,800/yr saved",
    },
    {
      text: "My reviews went from 4.6 to 4.9 stars after switching to professional cleaners. The ROI is incredible - more 5-star reviews means more bookings.",
      author: "Michael R.",
      role: "VRBO Host",
      stat: "+0.3 star rating",
    },
    {
      text: "Last-minute booking? No problem. I can schedule a same-day cleaning and know my place will be spotless. Game changer for my business.",
      author: "Jennifer L.",
      role: "Vacation Rental Owner",
      stat: "Same-day cleanings",
    },
  ];

  const FeatureIcon = ({ icon }) => {
    const iconMap = {
      calendar: "📅",
      shield: "🛡️",
      clock: "⏰",
      star: "⭐",
      "dollar-sign": "💰",
      "trending-up": "📈",
    };
    return (
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary[100],
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.md,
        }}
      >
        <Text style={{ fontSize: 24 }}>{iconMap[icon]}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.neutral[0] }}
      contentContainerStyle={{ paddingBottom: spacing["4xl"] }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View
        style={{
          backgroundColor: colors.primary[600],
          paddingTop: Platform.OS === "ios" ? 60 : 40,
          paddingBottom: spacing["4xl"],
          paddingHorizontal: spacing.xl,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <Text
          style={{
            fontSize: responsive(28, 36, 44),
            fontWeight: typography.fontWeight.bold,
            color: colors.neutral[0],
            textAlign: "center",
            marginBottom: spacing.md,
            lineHeight: responsive(34, 44, 52),
          }}
        >
          5-Star Cleanings. {"\n"}
          <Text
            style={{
              fontSize: responsive(16, 18, 20),
              color: colors.primary[50],
              textAlign: "center",
              marginBottom: spacing["2xl"],
              lineHeight: 30,
            }}
          >
            That means you'll get
          </Text>
          {"\n"}5-Star Reviews.
        </Text>
        <Text
          style={{
            fontSize: responsive(16, 18, 20),
            color: colors.primary[100],
            textAlign: "center",
            marginBottom: spacing["2xl"],
            lineHeight: 26,
          }}
        >
          Book a professional cleaning in seconds
          {"\n"}
          Save ${yearlySavings.toLocaleString()}/year vs property managers.
        </Text>

        {/* CTA Buttons */}
        <View
          style={{
            flexDirection: width > 400 ? "row" : "column",
            justifyContent: "center",
            alignItems: "center",
            gap: spacing.md,
          }}
        >
          <Pressable
            onPress={() => navigate("/sign-up")}
            style={({ pressed }) => ({
              backgroundColor: colors.secondary[500],
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing["2xl"],
              borderRadius: radius.xl,
              ...shadows.lg,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              minWidth: 160,
            })}
          >
            <Text
              style={{
                color: colors.neutral[0],
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                textAlign: "center",
              }}
            >
              Get Started
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigate("/sign-in")}
            style={({ pressed }) => ({
              backgroundColor: "transparent",
              borderWidth: 2,
              borderColor: colors.neutral[0],
              paddingVertical: spacing.lg - 2,
              paddingHorizontal: spacing["2xl"],
              borderRadius: radius.xl,
              opacity: pressed ? 0.8 : 1,
              minWidth: 160,
            })}
          >
            <Text
              style={{
                color: colors.neutral[0],
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.semibold,
                textAlign: "center",
              }}
            >
              Sign In
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Incentive Banner */}
      {!state.currentUser.token && incentiveConfig?.homeowner?.enabled && (
        <IncentiveBanner
          type="homeowner"
          message={`First ${
            incentiveConfig.homeowner.maxCleanings
          } cleanings get ${Math.round(
            incentiveConfig.homeowner.discountPercent * 100
          )}% off!`}
          icon="tag"
        />
      )}

      {/* Stats Section */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-around",
          paddingVertical: spacing["2xl"],
          paddingHorizontal: spacing.lg,
          marginTop: -spacing["2xl"],
          marginHorizontal: spacing.lg,
          backgroundColor: colors.neutral[0],
          borderRadius: radius["2xl"],
          ...shadows.lg,
        }}
      >
        {stats.map((stat, index) => (
          <View
            key={index}
            style={{
              alignItems: "center",
              minWidth: 70,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: responsive(20, 24, 28),
                fontWeight: typography.fontWeight.bold,
                color: colors.primary[600],
              }}
            >
              {stat.value}
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.xs,
                color: colors.text.tertiary,
                marginTop: spacing.xs,
                textAlign: "center",
              }}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Hero Image */}
      <View
        style={{ paddingHorizontal: spacing.lg, marginTop: spacing["2xl"] }}
      >
        <Image
          source={image1}
          style={{
            width: "100%",
            height: responsive(180, 220, 280),
            borderRadius: radius["2xl"],
          }}
          resizeMode="cover"
        />
      </View>

      {/* Features Section */}
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
          Why Choose Us
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.base,
            color: colors.text.secondary,
            textAlign: "center",
            marginBottom: spacing["2xl"],
          }}
        >
          Everything you need for hassle-free rental turnovers
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {features.map((feature, index) => (
            <View
              key={index}
              style={{
                width: width > 600 ? "48%" : "100%",
                backgroundColor: colors.neutral[50],
                borderRadius: radius.xl,
                padding: spacing.xl,
                marginBottom: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border.light,
              }}
            >
              <FeatureIcon icon={feature.icon} />
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text.primary,
                  marginBottom: spacing.sm,
                }}
              >
                {feature.title}
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                  lineHeight: 22,
                }}
              >
                {feature.description}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pricing Preview */}
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
          Simple, Transparent Pricing
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.base,
            color: colors.text.secondary,
            textAlign: "center",
            marginBottom: spacing["2xl"],
          }}
        >
          No hidden fees, no surprises
        </Text>

        <View
          style={{
            backgroundColor: colors.neutral[0],
            borderRadius: radius["2xl"],
            padding: spacing["2xl"],
            borderWidth: 2,
            borderColor: colors.primary[500],
            ...shadows.lg,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.text.tertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Starting at
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <Text
                style={{
                  fontSize: typography.fontSize.xl,
                  color: colors.text.primary,
                  marginTop: 8,
                }}
              >
                $
              </Text>
              <Text
                style={{
                  fontSize: responsive(48, 56, 64),
                  fontWeight: typography.fontWeight.bold,
                  color: colors.primary[600],
                }}
              >
                {displayBasePrice}
              </Text>
            </View>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.text.secondary,
              }}
            >
              per cleaning
            </Text>
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border.light,
              paddingTop: spacing.lg,
            }}
          >
            {[
              "1 bed / 1 bath base rate",
              `+$${
                pricing.extraBedBathFee ?? defaultPricing.extraBedBathFee
              } per additional bed or bath`,
              `Fresh sheets (+$${
                pricing.linens?.sheetFeePerBed ??
                defaultPricing.linens.sheetFeePerBed
              }/bed)`,
              `Fresh towels (+$${
                pricing.linens?.towelFee ?? defaultPricing.linens.towelFee
              }/towel)`,
              "Flexible 10am-4pm scheduling",
            ].map((item, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: spacing.md,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    color: colors.success[500],
                    marginRight: spacing.md,
                  }}
                >
                  ✓
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    color: colors.text.secondary,
                  }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => navigate("/sign-up")}
            style={({ pressed }) => ({
              backgroundColor: colors.primary[600],
              paddingVertical: spacing.lg,
              borderRadius: radius.xl,
              marginTop: spacing.lg,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.neutral[0],
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                textAlign: "center",
              }}
            >
              Start Booking Today
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Value Props Section - ROI Focus */}
      <View
        style={{
          backgroundColor: colors.success[50],
          marginTop: spacing["2xl"],
          paddingVertical: spacing["3xl"],
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text
          style={{
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.bold,
            color: colors.success[700],
            letterSpacing: 1.5,
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          THE SMART CHOICE
        </Text>
        <Text
          style={{
            fontSize: responsive(22, 26, 30),
            fontWeight: typography.fontWeight.bold,
            color: colors.text.primary,
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          Why Hosts Love Us
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.base,
            color: colors.text.secondary,
            textAlign: "center",
            marginBottom: spacing["2xl"],
          }}
        >
          Real results for real vacation rental owners
        </Text>

        {valueProps.map((prop, index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.neutral[0],
              borderRadius: radius.xl,
              padding: spacing.xl,
              marginBottom: spacing.lg,
              borderWidth: 1,
              borderColor: colors.success[200],
              ...shadows.sm,
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
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.success[100],
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FeatureIcon icon={prop.icon} />
              </View>
              <View
                style={{
                  backgroundColor: colors.success[600],
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
                  {prop.highlight}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.bold,
                color: colors.text.primary,
                marginBottom: spacing.xs,
              }}
            >
              {prop.title}
            </Text>
            <Text
              style={{
                fontSize: typography.fontSize.sm,
                color: colors.text.secondary,
                lineHeight: 22,
              }}
            >
              {prop.description}
            </Text>
          </View>
        ))}
      </View>

      {/* How It Works Section */}
      <View
        style={{
          backgroundColor: colors.primary[50],
          marginTop: spacing["2xl"],
          paddingVertical: spacing["3xl"],
          paddingHorizontal: spacing.lg,
        }}
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
          How It Works
        </Text>

        <View
          style={{
            flexDirection: width > 600 ? "row" : "column",
            justifyContent: "space-around",
          }}
        >
          {[
            {
              step: "1",
              title: "Sign Up",
              desc: "Create your account in minutes",
            },
            {
              step: "2",
              title: "Add Property",
              desc: "Enter your rental details",
            },
            {
              step: "3",
              title: "Book Cleaning",
              desc: "Schedule with a few taps",
            },
          ].map((item, index) => (
            <View
              key={index}
              style={{
                alignItems: "center",
                marginBottom: width > 600 ? 0 : spacing.xl,
                flex: width > 600 ? 1 : undefined,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primary[600],
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.md,
                }}
              >
                <Text
                  style={{
                    color: colors.neutral[0],
                    fontSize: typography.fontSize.xl,
                    fontWeight: typography.fontWeight.bold,
                  }}
                >
                  {item.step}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: typography.fontSize.lg,
                  fontWeight: typography.fontWeight.semibold,
                  color: colors.text.primary,
                  marginBottom: spacing.xs,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                  textAlign: "center",
                }}
              >
                {item.desc}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Testimonials */}
      <View
        style={{ paddingHorizontal: spacing.lg, marginTop: spacing["3xl"] }}
      >
        <Text
          style={{
            fontSize: typography.fontSize.xs,
            fontWeight: typography.fontWeight.bold,
            color: colors.primary[600],
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
          Hosts Who Made the Switch
        </Text>

        {testimonials.map((testimonial, index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.neutral[50],
              borderRadius: radius.xl,
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
              {testimonial.stat && (
                <View
                  style={{
                    backgroundColor: colors.primary[600],
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
                    {testimonial.stat}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={{
                fontSize: typography.fontSize.base,
                color: colors.text.primary,
                lineHeight: 24,
                fontStyle: "italic",
                marginBottom: spacing.lg,
              }}
            >
              "{testimonial.text}"
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primary[100],
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: spacing.md,
                }}
              >
                <Text
                  style={{
                    fontSize: typography.fontSize.lg,
                    fontWeight: typography.fontWeight.bold,
                    color: colors.primary[600],
                  }}
                >
                  {testimonial.author[0]}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    fontSize: typography.fontSize.sm,
                    fontWeight: typography.fontWeight.semibold,
                    color: colors.text.primary,
                  }}
                >
                  {testimonial.author}
                </Text>
                <Text
                  style={{
                    fontSize: typography.fontSize.xs,
                    color: colors.text.tertiary,
                  }}
                >
                  {testimonial.role}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Guarantee Section */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          marginTop: spacing["2xl"],
          backgroundColor: colors.success[50],
          borderRadius: radius["2xl"],
          padding: spacing["2xl"],
          borderWidth: 1,
          borderColor: colors.success[200],
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: spacing.md,
          }}
        >
          <Text style={{ fontSize: 28, marginRight: spacing.md }}>🛡️</Text>
          <Text
            style={{
              fontSize: typography.fontSize.xl,
              fontWeight: typography.fontWeight.bold,
              color: colors.success[700],
            }}
          >
            Our Worry-Free Guarantee
          </Text>
        </View>
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
            lineHeight: 22,
            marginBottom: spacing.md,
          }}
        >
          When you trust your property to our team, you can rest easy knowing
          every turnover is handled with care and precision. We understand how
          important five-star reviews, on-time check-ins, and consistent
          cleanliness are to your success. You deserve the confidence that each
          guest will walk into a spotless, guest-ready space—every single time.
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.text.secondary,
            lineHeight: 22,
          }}
        >
          We provide the peace of mind you're looking for with reliable,
          detail-driven turnover cleanings performed by friendly, trustworthy
          professionals. Our Worry-Free Guarantee reflects our commitment to
          going the extra mile so your rental always feels welcoming and
          professionally maintained.
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
            fontSize: responsive(20, 24, 28),
            fontWeight: typography.fontWeight.bold,
            color: colors.neutral[0],
            textAlign: "center",
            marginBottom: spacing.sm,
          }}
        >
          Ready for 5-Star Reviews?
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.base,
            color: colors.primary[100],
            textAlign: "center",
            marginBottom: spacing.lg,
          }}
        >
          Join 500+ hosts saving ${yearlySavings.toLocaleString()}/year with
          professional cleanings
        </Text>
        <View style={{ marginBottom: spacing.xl }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: colors.success[300],
                marginRight: spacing.sm,
              }}
            >
              ✓
            </Text>
            <Text
              style={{
                color: colors.primary[100],
                fontSize: typography.fontSize.sm,
              }}
            >
              Book your first cleaning in 2 minutes
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing.sm,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: colors.success[300],
                marginRight: spacing.sm,
              }}
            >
              ✓
            </Text>
            <Text
              style={{
                color: colors.primary[100],
                fontSize: typography.fontSize.sm,
              }}
            >
              Cancel free up to 7 days before*
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text
              style={{
                fontSize: 16,
                color: colors.success[300],
                marginRight: spacing.sm,
              }}
            >
              ✓
            </Text>
            <Text
              style={{
                color: colors.primary[100],
                fontSize: typography.fontSize.sm,
              }}
            >
              Satisfaction guaranteed or we re-clean free
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigate("/sign-up")}
          style={({ pressed }) => ({
            backgroundColor: colors.secondary[500],
            paddingVertical: spacing.lg,
            paddingHorizontal: spacing["3xl"],
            borderRadius: radius.xl,
            ...shadows.lg,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              color: colors.neutral[0],
              fontSize: typography.fontSize.lg,
              fontWeight: typography.fontWeight.bold,
            }}
          >
            Start Your Free Account
          </Text>
        </Pressable>
      </View>

      {/* Footer Info */}
      <View
        style={{
          marginTop: spacing["3xl"],
          paddingHorizontal: spacing.lg,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: typography.fontSize.sm,
            color: colors.text.tertiary,
            textAlign: "center",
          }}
        >
          Serving {cleaningCompany.location} and surrounding areas
        </Text>
        <Text
          style={{
            fontSize: typography.fontSize.xs,
            color: colors.text.tertiary,
            marginTop: spacing.sm,
          }}
        >
          Available daily
        </Text>
      </View>
    </ScrollView>
  );
};

export default HomePage;
