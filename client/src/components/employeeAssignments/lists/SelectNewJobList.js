import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import * as Location from "expo-location";
import FetchData from "../../../services/fetchRequests/fetchData";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import RequestedTile from "../tiles/RequestedTile";
import LargeHomeWarningModal from "../../modals/LargeHomeWarningModal";
import JobFilterModal, { defaultFilters } from "./JobFilterModal";
import {
  MultiCleanerJobCard,
  MultiCleanerOfferModal,
  TeamBookingModal,
} from "../../multiCleaner";
import {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} from "../../../services/styles/theme";
import { usePricing } from "../../../context/PricingContext";
import { calculateLinensFromRoomCounts } from "../../../utils/linensUtils";

// Format time constraint for display: "10-3" → "10am - 3pm"
const formatTimeConstraint = (time) => {
  if (!time || time.toLowerCase() === "anytime") return "Anytime";
  const match = time.match(/^(\d+)(am|pm)?-(\d+)(am|pm)?$/i);
  if (!match) return time;
  const startHour = parseInt(match[1], 10);
  const startPeriod = match[2]?.toLowerCase() || (startHour >= 8 && startHour <= 11 ? "am" : "pm");
  const endHour = parseInt(match[3], 10);
  const endPeriod = match[4]?.toLowerCase() || (endHour >= 1 && endHour <= 6 ? "pm" : "am");
  return `${startHour}${startPeriod} - ${endHour}${endPeriod}`;
};

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const sortOptions = [
  {
    value: "distanceClosest",
    label: "Distance (Closest)",
    icon: "location-arrow",
  },
  {
    value: "distanceFurthest",
    label: "Distance (Furthest)",
    icon: "location-arrow",
  },
  { value: "priceLow", label: "Price (Low to High)", icon: "dollar" },
  { value: "priceHigh", label: "Price (High to Low)", icon: "dollar" },
  { value: "dateNewest", label: "Date (Soonest)", icon: "calendar" },
  { value: "dateOldest", label: "Date (Latest)", icon: "calendar" },
];

const SelectNewJobList = ({ state }) => {
  const { pricing } = usePricing();
  const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
  const [allAppointments, setAllAppointments] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [appointmentLocations, setAppointmentLocations] = useState(null);
  const [sortOption, setSortOption] = useState("dateNewest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);

  // Large home warning modal state
  const [showLargeHomeModal, setShowLargeHomeModal] = useState(false);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Stripe setup required state
  const [showStripeSetupModal, setShowStripeSetupModal] = useState(false);
  const [stripeSetupMessage, setStripeSetupMessage] = useState("");

  const navigate = useNavigate();

  // Filter state
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [homeDetails, setHomeDetails] = useState({});
  const [availableCities, setAvailableCities] = useState([]);

  // Preferred homes state
  const [preferredHomeIds, setPreferredHomeIds] = useState([]);

  // Multi-cleaner jobs state
  const [multiCleanerOffers, setMultiCleanerOffers] = useState([]);
  const [availableMultiCleanerJobs, setAvailableMultiCleanerJobs] = useState(
    []
  );
  const [pendingMultiCleanerRequests, setPendingMultiCleanerRequests] =
    useState([]);
  const [selectedMultiCleanerJob, setSelectedMultiCleanerJob] = useState(null);
  const [showMultiCleanerModal, setShowMultiCleanerModal] = useState(false);
  const [multiCleanerLoading, setMultiCleanerLoading] = useState(false);

  // Team booking modal state (for business owners)
  const [showTeamBookingModal, setShowTeamBookingModal] = useState(false);
  const [selectedJobForTeam, setSelectedJobForTeam] = useState(null);

  // Job request loading state
  const [requestingJobId, setRequestingJobId] = useState(null);

  // Section expand/collapse state (all expanded by default)
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    team: true,
    available: true,
  });

  // Track which request linens dropdowns are expanded
  const [expandedLinens, setExpandedLinens] = useState({});

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const toggleLinens = useCallback((requestId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedLinens((prev) => ({
      ...prev,
      [requestId]: !prev[requestId],
    }));
  }, []);

  const requestsAndAppointments = useMemo(() => {
    const requestsWithFlag = allRequests.map((item) => ({
      ...item,
      isRequest: true,
    }));
    const appointmentsWithFlag = allAppointments.map((item) => ({
      ...item,
      isRequest: false,
    }));
    return [...requestsWithFlag, ...appointmentsWithFlag];
  }, [allRequests, allAppointments]);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);

      try {
        const [appointmentResponse, userResponse] = await Promise.all([
          FetchData.get(
            "/api/v1/users/appointments/employee",
            state.currentUser.token
          ),
          getCurrentUser(state.currentUser.token),
        ]);

        const now = new Date();
        const isUpcoming = (item) => new Date(item.date) >= now;

        // Filter out jobs that have already been assigned to anyone (including yourself)
        // Those should only show on the "My Jobs" page
        const availableAppointments = (appointmentResponse.appointments || [])
          .filter(isUpcoming)
          .filter((appt) => !appt.hasBeenAssigned);

        setAllAppointments(availableAppointments);
        setAllRequests(
          (appointmentResponse.requested || []).filter(isUpcoming)
        );
        setUserId(userResponse.user.id);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [state.currentUser.token]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch preferred home IDs for this cleaner
  useEffect(() => {
    const fetchPreferredHomes = async () => {
      try {
        const response = await FetchData.get(
          "/api/v1/users/preferred-homes",
          state.currentUser.token
        );
        if (response.preferredHomeIds) {
          setPreferredHomeIds(response.preferredHomeIds);
        }
      } catch (error) {
        console.error("Error fetching preferred homes:", error);
      }
    };

    if (state.currentUser.token) {
      fetchPreferredHomes();
    }
  }, [state.currentUser.token]);

  // Fetch multi-cleaner job offers and pending requests
  const fetchMultiCleanerJobs = useCallback(async () => {
    try {
      const [offersResponse, requestsResponse] = await Promise.all([
        FetchData.getMultiCleanerOffers(state.currentUser.token),
        FetchData.getMyMultiCleanerRequests(state.currentUser.token),
      ]);

      if (!offersResponse.error) {
        setMultiCleanerOffers(offersResponse.personalOffers || []);
        setAvailableMultiCleanerJobs(offersResponse.availableJobs || []);
      }

      if (!requestsResponse.error) {
        setPendingMultiCleanerRequests(requestsResponse.requests || []);
      }
    } catch (error) {
      console.log("Error fetching multi-cleaner jobs:", error.message);
    }
  }, [state.currentUser.token]);

  useEffect(() => {
    if (state.currentUser.token) {
      fetchMultiCleanerJobs();
    }
  }, [fetchMultiCleanerJobs]);

  // Fetch locations only for items missing inline coordinates (fallback)
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        // Only collect home IDs for items missing inline coordinates
        const soloHomesNeedingFetch = [...allAppointments, ...allRequests]
          .filter((a) => a.latitude == null || a.longitude == null)
          .map((a) => a.homeId)
          .filter(Boolean);
        const multiCleanerJobHomesNeedingFetch = availableMultiCleanerJobs
          .filter((j) => j.appointment?.home?.latitude == null || j.appointment?.home?.longitude == null)
          .map((j) => j.homeId || j.appointment?.home?.id)
          .filter(Boolean);
        const pendingRequestHomesNeedingFetch = pendingMultiCleanerRequests
          .filter((r) => r.appointment?.home?.latitude == null || r.appointment?.home?.longitude == null)
          .map((r) => r.homeId || r.appointment?.home?.id)
          .filter(Boolean);
        const offerHomesNeedingFetch = multiCleanerOffers
          .filter((o) => o.multiCleanerJob?.appointment?.home?.latitude == null || o.multiCleanerJob?.appointment?.home?.longitude == null)
          .map(
            (o) =>
              o.multiCleanerJob?.homeId ||
              o.multiCleanerJob?.appointment?.home?.id
          )
          .filter(Boolean);

        // Deduplicate homeIds to avoid redundant fetches
        const homeIdsNeedingFetch = [
          ...new Set([
            ...soloHomesNeedingFetch,
            ...multiCleanerJobHomesNeedingFetch,
            ...pendingRequestHomesNeedingFetch,
            ...offerHomesNeedingFetch,
          ]),
        ];

        if (homeIdsNeedingFetch.length === 0) return;

        const locations = await Promise.all(
          homeIdsNeedingFetch.map(async (homeId) => {
            const response = await FetchData.getLatAndLong(homeId);
            // Validate the response has lat/long
            if (
              response &&
              typeof response.latitude === "number" &&
              typeof response.longitude === "number"
            ) {
              return { [homeId]: response };
            }
            return { [homeId]: null };
          })
        );
        setAppointmentLocations(Object.assign({}, ...locations));
      } catch (error) {
        console.log("Error fetching locations:", error.message);
      }
    };

    if (
      allAppointments.length > 0 ||
      allRequests.length > 0 ||
      availableMultiCleanerJobs.length > 0 ||
      pendingMultiCleanerRequests.length > 0 ||
      multiCleanerOffers.length > 0
    ) {
      fetchLocations();
    }
  }, [
    allAppointments,
    allRequests,
    availableMultiCleanerJobs,
    pendingMultiCleanerRequests,
    multiCleanerOffers,
  ]);

  useEffect(() => {
    let locationSubscription = null;

    const startLocationTracking = async () => {
      try {
        // Request permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Location permission denied");
          return;
        }

        // Get initial location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        console.log(
          "User location detected:",
          location.coords.latitude,
          location.coords.longitude
        );
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // Watch for location updates
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000,
            distanceInterval: 100,
          },
          (location) => {
            setUserLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });
          }
        );
      } catch (error) {
        console.log("Location unavailable:", error.message || error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Fetch home details for filtering
  useEffect(() => {
    const fetchHomeDetails = async () => {
      const allItems = [...allAppointments, ...allRequests];
      const homeIds = [...new Set(allItems.map((a) => a.homeId))];
      const details = {};

      await Promise.all(
        homeIds.map(async (homeId) => {
          try {
            const response = await FetchData.getHome(homeId);
            if (response && !response.error) {
              details[homeId] = response.home || response;
            }
          } catch (err) {
            console.error("Error fetching home:", homeId, err);
          }
        })
      );

      setHomeDetails(details);
      const cities = [
        ...new Set(
          Object.values(details)
            .map((h) => h?.city)
            .filter(Boolean)
        ),
      ].sort();
      setAvailableCities(cities);
    };

    if (allAppointments.length > 0 || allRequests.length > 0) {
      fetchHomeDetails();
    }
  }, [allAppointments, allRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(true);
    fetchMultiCleanerJobs();
  }, [fetchData, fetchMultiCleanerJobs]);

  // Handle booking request with large home check
  const handleBookingRequest = useCallback(
    async (employeeId, appointmentId) => {
      setRequestingJobId(appointmentId);
      try {
        // First, check if this is a large home that requires acknowledgment
        const info = await FetchData.getBookingInfo(
          appointmentId,
          state.currentUser.token
        );

        if (info.error) {
          console.error("Error getting booking info:", info.error);
          // Proceed with booking anyway if we can't get info
          const result = await FetchData.addEmployee(
            employeeId,
            appointmentId,
            false
          );
          if (result.success) {
            setAllAppointments((prev) => {
              const assigned = prev.find((a) => a.id === appointmentId);
              if (assigned) setAllRequests((reqs) => [...reqs, assigned]);
              return prev.filter((a) => a.id !== appointmentId);
            });
            // Show success message for regular requests
            Alert.alert(
              "Request Sent!",
              "Your request has been sent to the homeowner. You can view it in Pending Requests above.",
              [{ text: "OK" }]
            );
          }
          return;
        }

        if (info.multiCleanerRequired) {
          // This home requires multiple cleaners - no solo option
          Alert.alert(
            "Multi-Cleaner Required",
            `This is a large home (${info.homeInfo.numBeds} beds, ${info.homeInfo.numBaths} baths) that requires ${info.recommendedCleaners} cleaners. Solo cleaning is not available for this home.`,
            [{ text: "OK" }]
          );
          return;
        }

        if (info.requiresAcknowledgment) {
          // Show warning modal for edge large homes (solo allowed with warning)
          setBookingInfo(info);
          setPendingBooking({ employeeId, appointmentId });
          setShowLargeHomeModal(true);
        } else {
          // Proceed directly for small homes
          const result = await FetchData.addEmployee(
            employeeId,
            appointmentId,
            false
          );
          if (result.success) {
            setAllAppointments((prev) => {
              const assigned = prev.find((a) => a.id === appointmentId);
              if (assigned && !result.directBooking) {
                setAllRequests((reqs) => [...reqs, assigned]);
              }
              return prev.filter((a) => a.id !== appointmentId);
            });
            // Show success message
            if (result.directBooking) {
              Alert.alert(
                "Job Booked!",
                "As a preferred cleaner, this job has been confirmed automatically. The homeowner has been notified.",
                [{ text: "OK" }]
              );
            } else {
              Alert.alert(
                "Request Sent!",
                "Your request has been sent to the homeowner. You can view it in Pending Requests above.",
                [{ text: "OK" }]
              );
            }
          } else if (result.requiresStripeSetup) {
            // Show Stripe setup modal
            setStripeSetupMessage(
              result.message ||
                "You need to set up your Stripe account to receive payments before you can request appointments."
            );
            setShowStripeSetupModal(true);
          } else if (result.error) {
            console.error("Error booking:", result.error);
          }
        }
      } catch (err) {
        console.error("Error handling booking request:", err);
      } finally {
        setRequestingJobId(null);
      }
    },
    [state.currentUser.token]
  );

  // Confirm booking after acknowledging large home warning
  const handleConfirmLargeHomeBooking = useCallback(async () => {
    if (!pendingBooking) return;

    setBookingLoading(true);
    try {
      const { employeeId, appointmentId } = pendingBooking;
      const result = await FetchData.addEmployee(
        employeeId,
        appointmentId,
        true
      );

      if (result.success) {
        setAllAppointments((prev) => {
          const assigned = prev.find((a) => a.id === appointmentId);
          if (assigned && !result.directBooking) {
            setAllRequests((reqs) => [...reqs, assigned]);
          }
          return prev.filter((a) => a.id !== appointmentId);
        });
        setShowLargeHomeModal(false);
        setBookingInfo(null);
        setPendingBooking(null);
        // Show success message
        if (result.directBooking) {
          Alert.alert(
            "Job Booked!",
            "As a preferred cleaner, this job has been confirmed automatically. The homeowner has been notified.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Request Sent!",
            "Your request has been sent to the homeowner. You can view it in Pending Requests above.",
            [{ text: "OK" }]
          );
        }
      } else if (result.requiresStripeSetup) {
        setShowLargeHomeModal(false);
        setBookingInfo(null);
        setPendingBooking(null);
        setStripeSetupMessage(
          result.message ||
            "You need to set up your Stripe account to receive payments before you can request appointments."
        );
        setShowStripeSetupModal(true);
      } else if (result.error) {
        console.error("Error confirming booking:", result.error);
      }
    } catch (err) {
      console.error("Error confirming large home booking:", err);
    } finally {
      setBookingLoading(false);
    }
  }, [pendingBooking]);

  // Close large home modal
  const handleCloseLargeHomeModal = useCallback(() => {
    setShowLargeHomeModal(false);
    setBookingInfo(null);
    setPendingBooking(null);
  }, []);

  // Multi-cleaner helper functions
  const formatAddress = (home) => {
    if (!home) return "";
    return `${home.city || ""}, ${home.state || ""}`.replace(/^, |, $/g, "");
  };

  const transformOfferToJobData = (offer) => {
    // Server stores earningsOffered in cents, convert to dollars for display
    const earningsInDollars = offer.earningsOffered
      ? offer.earningsOffered / 100
      : null;

    // Calculate distance for this offer
    // Use inline coordinates from API response, fallback to fetched locations
    const offerHomeId =
      offer.multiCleanerJob?.homeId ||
      offer.multiCleanerJob?.appointment?.home?.id;
    const inlineLat = offer.multiCleanerJob?.appointment?.home?.latitude;
    const inlineLng = offer.multiCleanerJob?.appointment?.home?.longitude;
    const fallbackLoc = appointmentLocations?.[offerHomeId];
    const locLat = inlineLat ?? fallbackLoc?.latitude;
    const locLng = inlineLng ?? fallbackLoc?.longitude;
    let distance = null;
    if (userLocation && locLat != null && locLng != null) {
      distance = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        locLat,
        locLng
      );
    }

    return {
      id: offer.multiCleanerJob?.id,
      appointmentDate: offer.multiCleanerJob?.appointment?.date,
      address: formatAddress(offer.multiCleanerJob?.appointment?.home),
      city: offer.multiCleanerJob?.appointment?.home?.city,
      state: offer.multiCleanerJob?.appointment?.home?.state,
      totalCleanersRequired: offer.multiCleanerJob?.totalCleanersRequired || 2,
      cleanersConfirmed: offer.multiCleanerJob?.cleanersConfirmed || 0,
      status: offer.multiCleanerJob?.status,
      earningsOffered: earningsInDollars,
      perCleanerEarnings: earningsInDollars,
      timeToBeCompleted: offer.multiCleanerJob?.appointment?.timeToBeCompleted,
      distance,
      numBeds: offer.multiCleanerJob?.appointment?.home?.numBeds,
      numBaths: offer.multiCleanerJob?.appointment?.home?.numBaths,
    };
  };

  const transformJobData = (job) => {
    // Calculate per-cleaner earnings from appointment price (after platform fee, split by cleaners)
    const totalPrice = job.appointment?.price || 0;
    const cleanersRequired = job.totalCleanersRequired || 2;
    const cleanersConfirmed = job.cleanersConfirmed || 0;
    const cleanersTotalShare = totalPrice * cleanerSharePercent;
    const perCleanerEarnings =
      totalPrice > 0 ? Math.round(cleanersTotalShare / cleanersRequired) : null;

    // Get estimated time (totalEstimatedMinutes from job, or parse timeToBeCompleted from appointment)
    let estimatedMinutes = job.totalEstimatedMinutes;
    if (!estimatedMinutes && job.appointment?.timeToBeCompleted) {
      // Parse timeToBeCompleted string (e.g., "2 hours", "1.5 hours", "90 minutes")
      const timeStr = job.appointment.timeToBeCompleted.toLowerCase();
      const hourMatch = timeStr.match(/([\d.]+)\s*h/);
      const minMatch = timeStr.match(/([\d.]+)\s*m/);
      if (hourMatch) {
        estimatedMinutes = parseFloat(hourMatch[1]) * 60;
      } else if (minMatch) {
        estimatedMinutes = parseFloat(minMatch[1]);
      }
    }

    // Calculate distance for this job
    // Use inline coordinates from API response, fallback to fetched locations
    const jobHomeId = job.homeId || job.appointment?.home?.id;
    const inlineLat = job.appointment?.home?.latitude;
    const inlineLng = job.appointment?.home?.longitude;
    const fallbackLoc = appointmentLocations?.[jobHomeId];
    const locLat = inlineLat ?? fallbackLoc?.latitude;
    const locLng = inlineLng ?? fallbackLoc?.longitude;
    let distance = null;
    if (userLocation && locLat != null && locLng != null) {
      distance = haversineDistance(
        userLocation.latitude,
        userLocation.longitude,
        locLat,
        locLng
      );
    }

    return {
      id: job.id,
      appointmentId: job.appointmentId,
      appointmentDate: job.appointment?.date,
      address: formatAddress(job.appointment?.home),
      city: job.appointment?.home?.city,
      state: job.appointment?.home?.state,
      totalCleanersRequired: cleanersRequired,
      cleanersConfirmed,
      remainingSlots: cleanersRequired - cleanersConfirmed,
      status: job.status,
      perCleanerEarnings,
      totalJobPrice: totalPrice,
      estimatedMinutes,
      timeToBeCompleted: job.appointment?.timeToBeCompleted,
      distance,
      numBeds: job.appointment?.home?.numBeds,
      numBaths: job.appointment?.home?.numBaths,
    };
  };

  const transformJobToOfferFormat = (job) => {
    const totalPrice = job.appointment?.price || 0;
    const cleanersRequired = job.totalCleanersRequired || 2;
    const cleanersTotalShare = totalPrice * cleanerSharePercent;
    const perCleanerEarnings =
      totalPrice > 0 ? Math.round(cleanersTotalShare / cleanersRequired) : null;

    return {
      id: job.id,
      totalCleanersRequired: cleanersRequired,
      appointmentDate: job.appointment?.date,
      address: formatAddress(job.appointment?.home),
      city: job.appointment?.home?.city,
      state: job.appointment?.home?.state,
      estimatedMinutes: null,
      earningsOffered: perCleanerEarnings,
      totalJobPrice: totalPrice,
      platformFee: null,
      percentOfWork: Math.round(100 / cleanersRequired),
      roomAssignments: [],
      expiresAt: null,
      timeToBeCompleted: job.appointment?.timeToBeCompleted,
    };
  };

  // Handle accepting a multi-cleaner offer
  const handleAcceptOffer = useCallback(
    async (offer) => {
      setMultiCleanerLoading(true);
      try {
        const result = await FetchData.acceptMultiCleanerOffer(
          offer.id,
          state.currentUser.token
        );
        if (result.error) {
          Alert.alert("Error", result.error);
        } else {
          Alert.alert(
            "Success!",
            "You've joined this team cleaning job. Check your schedule for details.",
            [{ text: "OK" }]
          );
          fetchMultiCleanerJobs();
        }
      } catch (error) {
        Alert.alert("Error", "Failed to accept offer. Please try again.");
      } finally {
        setMultiCleanerLoading(false);
      }
    },
    [state.currentUser.token, fetchMultiCleanerJobs]
  );

  // Handle declining a multi-cleaner offer
  const handleDeclineOffer = useCallback(
    async (offer) => {
      Alert.alert(
        "Decline Offer",
        "Are you sure you want to decline this team cleaning job?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Decline",
            style: "destructive",
            onPress: async () => {
              try {
                const result = await FetchData.declineMultiCleanerOffer(
                  offer.id,
                  "",
                  state.currentUser.token
                );
                if (result.error) {
                  Alert.alert("Error", result.error);
                } else {
                  fetchMultiCleanerJobs();
                }
              } catch (error) {
                Alert.alert(
                  "Error",
                  "Failed to decline offer. Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [state.currentUser.token, fetchMultiCleanerJobs]
  );

  // Handle viewing an open multi-cleaner job
  const handleViewMultiCleanerJob = useCallback((job) => {
    setSelectedMultiCleanerJob(job);
    setShowMultiCleanerModal(true);
  }, []);

  // Handle directly joining a multi-cleaner job (no modal, for edge large homes in team section)
  const handleDirectJoinMultiCleanerJob = useCallback(
    async (job) => {
      setMultiCleanerLoading(true);
      try {
        const result = await FetchData.joinMultiCleanerJob(
          job.id,
          state.currentUser.token
        );
        if (result.error) {
          Alert.alert("Error", result.error);
        } else if (result.status === "pending_approval") {
          // Non-preferred cleaner - request sent to homeowner
          Alert.alert(
            "Request Sent",
            "Your request to join this team has been sent to the homeowner for approval. You'll be notified when they respond.",
            [{ text: "OK" }]
          );
          // Refresh both lists
          fetchData(true);
          fetchMultiCleanerJobs();
        } else {
          // Preferred cleaner - auto-approved
          Alert.alert(
            "Joined Team!",
            "You've joined this cleaning team. We'll notify you when the team is complete.",
            [{ text: "OK" }]
          );
          // Refresh both lists
          fetchData(true);
          fetchMultiCleanerJobs();
        }
      } catch (error) {
        Alert.alert("Error", "Failed to join job. Please try again.");
      } finally {
        setMultiCleanerLoading(false);
      }
    },
    [state.currentUser.token, fetchData, fetchMultiCleanerJobs]
  );

  // Handle opening team booking modal (for business owners)
  const handleOpenTeamBooking = useCallback((job) => {
    const jobData = transformJobData(job);
    setSelectedJobForTeam(jobData);
    setShowTeamBookingModal(true);
  }, []);

  // Handle successful team booking
  const handleTeamBookingComplete = useCallback(() => {
    setShowTeamBookingModal(false);
    setSelectedJobForTeam(null);
    // Refresh the job lists
    fetchData(true);
    fetchMultiCleanerJobs();
  }, [fetchData, fetchMultiCleanerJobs]);

  // Handle joining an open multi-cleaner job
  const handleJoinMultiCleanerJob = useCallback(async () => {
    if (!selectedMultiCleanerJob) return;

    setMultiCleanerLoading(true);
    try {
      const result = await FetchData.joinMultiCleanerJob(
        selectedMultiCleanerJob.id,
        state.currentUser.token
      );
      if (result.error) {
        Alert.alert("Error", result.error);
      } else if (result.status === "pending_approval") {
        // Non-preferred cleaner - request sent to homeowner
        Alert.alert(
          "Request Sent",
          "Your request to join this team has been sent to the homeowner for approval. You'll be notified when they respond.",
          [{ text: "OK" }]
        );
        setShowMultiCleanerModal(false);
        setSelectedMultiCleanerJob(null);
        fetchMultiCleanerJobs();
      } else {
        // Preferred cleaner - auto-approved
        Alert.alert(
          "Joined Team!",
          "You've joined this team cleaning job. Check your schedule for details.",
          [{ text: "OK" }]
        );
        setShowMultiCleanerModal(false);
        setSelectedMultiCleanerJob(null);
        fetchMultiCleanerJobs();
      }
    } catch (error) {
      Alert.alert("Error", "Failed to join job. Please try again.");
    } finally {
      setMultiCleanerLoading(false);
    }
  }, [selectedMultiCleanerJob, state.currentUser.token, fetchMultiCleanerJobs]);

  // Close multi-cleaner modal
  const handleCloseMultiCleanerModal = useCallback(() => {
    setShowMultiCleanerModal(false);
    setSelectedMultiCleanerJob(null);
  }, []);

  // Handle cancelling a multi-cleaner request
  const handleCancelMultiCleanerRequest = useCallback(
    (request) => {
      Alert.alert(
        "Cancel Request",
        "Are you sure you want to cancel this team cleaning request?",
        [
          { text: "No, Keep It", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              try {
                const result = await FetchData.cancelMultiCleanerRequest(
                  request.id,
                  state.currentUser.token
                );
                if (result.error) {
                  Alert.alert("Error", result.error);
                } else {
                  Alert.alert(
                    "Request Cancelled",
                    "Your request has been cancelled."
                  );
                  fetchMultiCleanerJobs();
                }
              } catch (error) {
                Alert.alert(
                  "Error",
                  "Failed to cancel request. Please try again."
                );
              }
            },
          },
        ]
      );
    },
    [state.currentUser.token, fetchMultiCleanerJobs]
  );

  const sortedData = useMemo(() => {
    const processed = requestsAndAppointments.map((appointment) => {
      let distance = null;
      // Use inline coordinates from API response, fallback to fetched locations
      const inlineLat = appointment.latitude;
      const inlineLng = appointment.longitude;
      const fallbackLoc = appointmentLocations?.[appointment.homeId];
      const locLat = inlineLat ?? fallbackLoc?.latitude;
      const locLng = inlineLng ?? fallbackLoc?.longitude;
      // Only calculate distance if we have valid user location and home location
      if (
        userLocation &&
        userLocation.latitude !== 0 &&
        userLocation.longitude !== 0 &&
        locLat != null &&
        locLng != null
      ) {
        distance = haversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          locLat,
          locLng
        );
      }
      return { ...appointment, distance };
    });

    const sortFn = {
      distanceClosest: (a, b) =>
        (a.distance ?? Infinity) - (b.distance ?? Infinity),
      distanceFurthest: (a, b) => (b.distance ?? 0) - (a.distance ?? 0),
      priceLow: (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0),
      priceHigh: (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0),
      dateNewest: (a, b) => new Date(a.date) - new Date(b.date),
      dateOldest: (a, b) => new Date(b.date) - new Date(a.date),
    };

    return [...processed].sort((a, b) => {
      const primary = sortFn[sortOption]?.(a, b) ?? 0;
      if (primary === 0) return a.id > b.id ? 1 : -1;
      return primary;
    });
  }, [requestsAndAppointments, userLocation, appointmentLocations, sortOption]);

  // Filter the sorted data
  const filteredData = useMemo(() => {
    return sortedData.filter((appt) => {
      const home = homeDetails[appt.homeId];

      // Preferred homes filter
      if (filters.preferredOnly && !preferredHomeIds.includes(appt.homeId)) {
        return false;
      }

      // Distance filter (distance is in km, convert miles for comparison)
      if (filters.distance.preset !== "any" && userLocation) {
        const maxDistMiles =
          filters.distance.preset === "custom"
            ? filters.distance.customValue
            : parseInt(filters.distance.preset);
        const distMiles = (appt.distance ?? 999) * 0.621371;
        if (distMiles > maxDistMiles) return false;
      }

      // Sheets filter (case-insensitive check for "yes")
      const needsSheets = appt.bringSheets?.toLowerCase() === "yes";
      if (filters.sheets === "needed" && !needsSheets) return false;
      if (filters.sheets === "not_needed" && needsSheets) return false;

      // Towels filter (case-insensitive check for "yes")
      const needsTowels = appt.bringTowels?.toLowerCase() === "yes";
      if (filters.towels === "needed" && !needsTowels) return false;
      if (filters.towels === "not_needed" && needsTowels) return false;

      // Skip home-based filters if home data not loaded
      if (home) {
        // Bedrooms filter
        const beds = parseFloat(home.numBeds) || 0;
        if (filters.bedrooms !== "any") {
          if (filters.bedrooms === "5+") {
            if (beds < 5) return false;
          } else {
            if (beds !== parseInt(filters.bedrooms)) return false;
          }
        }

        // Bathrooms filter
        const baths = parseFloat(home.numBaths) || 0;
        const halfBaths = parseFloat(home.numHalfBaths) || 0;
        const totalBaths = baths + halfBaths * 0.5;
        if (filters.bathrooms !== "any") {
          if (filters.bathrooms === "3+") {
            if (totalBaths < 3) return false;
          } else {
            if (totalBaths !== parseFloat(filters.bathrooms)) return false;
          }
        }

        // City filter
        if (filters.city !== "any" && home.city !== filters.city) return false;
      }

      // Time window filter
      if (
        filters.timeWindow !== "any" &&
        appt.timeToBeCompleted !== filters.timeWindow
      ) {
        return false;
      }

      // Min earnings filter (cleaner share based on platform fee)
      if (filters.minEarnings) {
        const cleanerSharePercent = 1 - (pricing?.platform?.feePercent || 0.1);
        const earnings = Number(appt.price) * cleanerSharePercent;
        if (earnings < filters.minEarnings) return false;
      }

      return true;
    });
  }, [
    sortedData,
    homeDetails,
    filters,
    userLocation,
    preferredHomeIds,
    pricing,
  ]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.distance.preset !== "any") count++;
    if (filters.sheets !== "any") count++;
    if (filters.towels !== "any") count++;
    if (filters.bedrooms !== "any") count++;
    if (filters.bathrooms !== "any") count++;
    if (filters.timeWindow !== "any") count++;
    if (filters.city !== "any") count++;
    if (filters.minEarnings) count++;
    if (filters.preferredOnly) count++;
    return count;
  }, [filters]);

  // Get appointment IDs that are in the multi-cleaner section to exclude from available jobs
  const multiCleanerAppointmentIds = useMemo(() => {
    const offerApptIds = multiCleanerOffers.map((o) => o.appointmentId);
    const jobApptIds = availableMultiCleanerJobs
      .map((j) => j.appointment?.id)
      .filter(Boolean);
    return new Set([...offerApptIds, ...jobApptIds]);
  }, [multiCleanerOffers, availableMultiCleanerJobs]);

  const availableJobs = filteredData.filter((item) => {
    // Exclude requests
    if (item.isRequest) return false;
    // Exclude multi-cleaner jobs (they're shown in the Team Cleaning section)
    if (item.isMultiCleanerJob) return false;
    // Exclude appointments already in the multi-cleaner offers/jobs lists
    if (multiCleanerAppointmentIds.has(item.id)) return false;
    return true;
  });
  const requestedJobs = filteredData.filter((item) => item.isRequest);

  const currentSortLabel =
    sortOptions.find((o) => o.value === sortOption)?.label || "Sort";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Finding available jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigate("/")}>
          <Icon name="angle-left" size={20} color={colors.primary[600]} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Find Jobs</Text>
        <Pressable
          style={styles.calendarButton}
          onPress={() => navigate("/appointment-calender")}
        >
          <Icon name="calendar" size={18} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{availableJobs.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        {multiCleanerOffers.length + availableMultiCleanerJobs.length > 0 && (
          <View style={[styles.statCard, styles.statCardTeam]}>
            <Text style={[styles.statValue, styles.statValueTeam]}>
              {multiCleanerOffers.length + availableMultiCleanerJobs.length}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelTeam]}>Team</Text>
          </View>
        )}
        <View style={[styles.statCard, styles.statCardHighlight]}>
          <Text style={[styles.statValue, styles.statValueHighlight]}>
            {requestedJobs.length + pendingMultiCleanerRequests.length}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelHighlight]}>
            Requested
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {activeFilterCount > 0
              ? `${filteredData.length}/${sortedData.length}`
              : sortedData.length}
          </Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        {/* Filter Button */}
        <Pressable
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Icon name="filter" size={14} color={colors.primary[600]} />
          <Text style={styles.filterButtonText}>Filter</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        {/* Sort Button */}
        <Pressable
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <Icon name="sort" size={14} color={colors.primary[600]} />
          <Text style={styles.sortButtonText}>{currentSortLabel}</Text>
          <Icon name="angle-down" size={14} color={colors.primary[600]} />
        </Pressable>
      </View>

      {/* Job List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary[500]]}
            tintColor={colors.primary[500]}
          />
        }
      >
        {filteredData.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon
                name={activeFilterCount > 0 ? "filter" : "briefcase"}
                size={40}
                color={
                  activeFilterCount > 0
                    ? colors.neutral[400]
                    : colors.primary[300]
                }
              />
            </View>
            <Text style={styles.emptyTitle}>
              {activeFilterCount > 0
                ? "No Jobs Match Your Filters"
                : "No Jobs Available"}
            </Text>
            <Text style={styles.emptyText}>
              {activeFilterCount > 0
                ? "Try adjusting your filters to see more opportunities."
                : "Check back later to see new cleaning opportunities in your area."}
            </Text>
            {activeFilterCount > 0 ? (
              <Pressable
                style={styles.clearFiltersButton}
                onPress={() => setFilters(defaultFilters)}
              >
                <Icon
                  name="times-circle"
                  size={14}
                  color={colors.primary[600]}
                />
                <Text style={styles.clearFiltersButtonText}>
                  Clear All Filters
                </Text>
              </Pressable>
            ) : (
              <Pressable style={styles.refreshButton} onPress={onRefresh}>
                <Icon name="refresh" size={14} color={colors.neutral[0]} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {/* Pending Requests Section */}
            {(requestedJobs.length > 0 ||
              pendingMultiCleanerRequests.length > 0) && (
              <View style={styles.section}>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("pending")}
                >
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionBadge}>
                      <Icon
                        name="clock-o"
                        size={12}
                        color={colors.warning[600]}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Pending Requests</Text>
                  </View>
                  <View style={styles.sectionHeaderRight}>
                    <Text style={styles.sectionCount}>
                      {requestedJobs.length +
                        pendingMultiCleanerRequests.length}
                    </Text>
                    <Icon
                      name={
                        expandedSections.pending ? "chevron-up" : "chevron-down"
                      }
                      size={14}
                      color={colors.text.tertiary}
                    />
                  </View>
                </Pressable>
                {expandedSections.pending && (
                  <>
                    {/* Regular job requests */}
                    {requestedJobs.map((appointment) => (
                      <View key={appointment.id} style={styles.tileWrapper}>
                        <RequestedTile
                          {...appointment}
                          cleanerId={userId}
                          removeRequest={async (employeeId, appointmentId) => {
                            try {
                              await FetchData.removeRequest(
                                employeeId,
                                appointmentId
                              );
                              setAllRequests((prev) => {
                                const removed = prev.find(
                                  (a) => a.id === appointmentId
                                );
                                if (removed)
                                  setAllAppointments((apps) => [
                                    ...apps,
                                    removed,
                                  ]);
                                return prev.filter(
                                  (a) => a.id !== appointmentId
                                );
                              });
                            } catch (err) {
                              console.error("Error removing request:", err);
                            }
                          }}
                        />
                      </View>
                    ))}
                    {/* Multi-cleaner job requests */}
                    {pendingMultiCleanerRequests.map((request) => {
                      const hasTimeConstraint =
                        request.appointment?.timeToBeCompleted &&
                        request.appointment.timeToBeCompleted.toLowerCase() !==
                          "anytime";

                      // Calculate distance for this request
                      // Use inline coordinates from API response, fallback to fetched locations
                      const requestHomeId =
                        request.homeId || request.appointment?.home?.id;
                      const requestInlineLat = request.appointment?.home?.latitude;
                      const requestInlineLng = request.appointment?.home?.longitude;
                      const requestFallbackLoc = appointmentLocations?.[requestHomeId];
                      const requestLocLat = requestInlineLat ?? requestFallbackLoc?.latitude;
                      const requestLocLng = requestInlineLng ?? requestFallbackLoc?.longitude;
                      let requestDistance = null;
                      if (userLocation && requestLocLat != null && requestLocLng != null) {
                        requestDistance = haversineDistance(
                          userLocation.latitude,
                          userLocation.longitude,
                          requestLocLat,
                          requestLocLng
                        );
                      }

                      // Calculate per-cleaner linens based on assigned rooms
                      // If no rooms assigned yet (pending), estimate based on total/cleaners
                      const totalCleaners =
                        request.multiCleanerJob?.totalCleanersRequired || 2;
                      const totalBeds = request.appointment?.home?.numBeds || 0;
                      const totalBaths =
                        request.appointment?.home?.numBaths || 0;
                      const hasAssignedRooms =
                        (request.assignedBedrooms || 0) > 0 ||
                        (request.assignedBathrooms || 0) > 0;

                      const estimatedBedrooms = hasAssignedRooms
                        ? request.assignedBedrooms
                        : Math.ceil(totalBeds / totalCleaners);
                      const estimatedBathrooms = hasAssignedRooms
                        ? request.assignedBathrooms
                        : Math.ceil(totalBaths / totalCleaners);

                      const linensCalc = calculateLinensFromRoomCounts({
                        assignedBedrooms: estimatedBedrooms,
                        assignedBathrooms: estimatedBathrooms,
                        bringSheets:
                          request.appointment?.bringSheets?.toLowerCase() ===
                          "yes",
                        bringTowels:
                          request.appointment?.bringTowels?.toLowerCase() ===
                          "yes",
                      });
                      const isLinensEstimated = !hasAssignedRooms;
                      const linensKey = `mc-${request.id}`;

                      return (
                        <View
                          key={`mc-${request.id}`}
                          style={styles.tileWrapper}
                        >
                          <View style={styles.multiCleanerRequestTile}>
                            <View style={styles.multiCleanerRequestHeader}>
                              <View style={styles.teamBadge}>
                                <Icon
                                  name="users"
                                  size={12}
                                  color={colors.primary[600]}
                                />
                                <Text style={styles.teamBadgeText}>
                                  Team Cleaning
                                </Text>
                              </View>
                              <Text style={styles.pendingBadge}>
                                Awaiting Approval
                              </Text>
                            </View>

                            <Text style={styles.multiCleanerRequestAddress}>
                              {request.appointment?.home?.city},{" "}
                              {request.appointment?.home?.state}
                            </Text>
                            <Text style={styles.multiCleanerRequestDate}>
                              {new Date(
                                request.appointment?.date + "T00:00:00"
                              ).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </Text>
                            <View style={styles.multiCleanerRequestDetails}>
                              <Text style={styles.multiCleanerRequestDetail}>
                                {request.appointment?.home?.numBeds} bed /{" "}
                                {request.appointment?.home?.numBaths} bath
                              </Text>
                              <Text style={styles.multiCleanerRequestDetail}>
                                {request.multiCleanerJob?.cleanersConfirmed ||
                                  0}
                                /
                                {request.multiCleanerJob
                                  ?.totalCleanersRequired || 2}{" "}
                                cleaners
                              </Text>
                              {requestDistance != null && (
                                <Text style={styles.multiCleanerRequestDetail}>
                                  {(requestDistance * 0.621371).toFixed(1)} mi
                                  away
                                </Text>
                              )}
                            </View>

                            {/* Linens Dropdown - Per-cleaner linens based on assigned rooms */}
                            {linensCalc.needsLinens && (
                              <View style={styles.linensContainer}>
                                <Pressable
                                  style={styles.linensHeader}
                                  onPress={() => toggleLinens(linensKey)}
                                >
                                  <View style={styles.linensHeaderLeft}>
                                    <Icon
                                      name="exclamation-triangle"
                                      size={14}
                                      color={colors.warning[600]}
                                    />
                                    <Text style={styles.linensHeaderText}>
                                      Your Linens
                                    </Text>
                                  </View>
                                  <Icon
                                    name={
                                      expandedLinens[linensKey]
                                        ? "chevron-up"
                                        : "chevron-down"
                                    }
                                    size={12}
                                    color={colors.warning[600]}
                                  />
                                </Pressable>
                                {expandedLinens[linensKey] && (
                                  <View style={styles.linensContent}>
                                    {linensCalc.needsSheets &&
                                      linensCalc.sheetsText && (
                                        <View style={styles.linenSection}>
                                          <View style={styles.linenCategory}>
                                            <Icon
                                              name="bed"
                                              size={14}
                                              color={colors.primary[600]}
                                            />
                                            <Text
                                              style={styles.linenCategoryTitle}
                                            >
                                              Sheets
                                            </Text>
                                          </View>
                                          <Text style={styles.linenSummary}>
                                            {linensCalc.sheetsText}
                                          </Text>
                                        </View>
                                      )}
                                    {linensCalc.needsTowels &&
                                      linensCalc.towelsText && (
                                        <View
                                          style={[
                                            styles.linenSection,
                                            linensCalc.needsSheets &&
                                              styles.linenSectionSpaced,
                                          ]}
                                        >
                                          <View style={styles.linenCategory}>
                                            <Icon
                                              name="tint"
                                              size={14}
                                              color={colors.primary[600]}
                                            />
                                            <Text
                                              style={styles.linenCategoryTitle}
                                            >
                                              Towels
                                            </Text>
                                          </View>
                                          <Text style={styles.linenSummary}>
                                            {linensCalc.towelsText}
                                          </Text>
                                        </View>
                                      )}
                                    <View style={styles.linenNote}>
                                      <Icon
                                        name="info-circle"
                                        size={12}
                                        color={colors.text.tertiary}
                                      />
                                      <Text style={styles.linenNoteText}>
                                        {isLinensEstimated
                                          ? `Estimated for your share (~${estimatedBedrooms} bed, ${estimatedBathrooms} bath)`
                                          : `Based on your assigned rooms (${linensCalc.assignedBedrooms} bed, ${linensCalc.assignedBathrooms} bath)`}
                                      </Text>
                                    </View>
                                  </View>
                                )}
                              </View>
                            )}

                            <View style={styles.multiCleanerRequestEarnings}>
                              <Icon
                                name="dollar"
                                size={12}
                                color={colors.success[600]}
                              />
                              <Text
                                style={styles.multiCleanerRequestEarningsText}
                              >
                                {(
                                  ((Number(request.appointment?.price) || 0) *
                                    cleanerSharePercent) /
                                  (request.multiCleanerJob
                                    ?.totalCleanersRequired || 2)
                                ).toFixed(0)}{" "}
                                your share
                              </Text>
                            </View>

                            {/* Time Constraint */}
                            {hasTimeConstraint && (
                              <View style={styles.timeConstraintRow}>
                                <Icon
                                  name="clock-o"
                                  size={12}
                                  color={colors.warning[600]}
                                />
                                <Text style={styles.timeConstraintText}>
                                  Complete by{" "}
                                  {formatTimeConstraint(request.appointment.timeToBeCompleted)}
                                </Text>
                              </View>
                            )}

                            <Text style={styles.expiresText}>
                              Expires{" "}
                              {new Date(request.expiresAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                }
                              )}
                            </Text>
                            {/* Request Sent badge and Cancel button */}
                            <View style={styles.multiCleanerRequestActions}>
                              <View style={styles.requestSentBadge}>
                                <Icon
                                  name="check-circle"
                                  size={14}
                                  color={colors.success[600]}
                                />
                                <Text style={styles.requestSentText}>
                                  Request Sent
                                </Text>
                              </View>
                              <Pressable
                                style={styles.cancelRequestButton}
                                onPress={() =>
                                  handleCancelMultiCleanerRequest(request)
                                }
                              >
                                <Icon
                                  name="times"
                                  size={14}
                                  color={colors.error[600]}
                                />
                                <Text style={styles.cancelRequestText}>
                                  Cancel
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {/* Team Cleaning Jobs Section */}
            {(multiCleanerOffers.length > 0 ||
              availableMultiCleanerJobs.length > 0) && (
              <View style={styles.section}>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("team")}
                >
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={[styles.sectionBadge, styles.sectionBadgeTeam]}
                    >
                      <Icon
                        name="users"
                        size={12}
                        color={colors.primary[600]}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Team Cleaning Jobs</Text>
                  </View>
                  <View style={styles.sectionHeaderRight}>
                    <Text style={styles.sectionCount}>
                      {multiCleanerOffers.length +
                        availableMultiCleanerJobs.length}
                    </Text>
                    <Icon
                      name={
                        expandedSections.team ? "chevron-up" : "chevron-down"
                      }
                      size={14}
                      color={colors.text.tertiary}
                    />
                  </View>
                </Pressable>

                {expandedSections.team && (
                  <>
                    {/* Personal Offers (direct invitations) */}
                    {multiCleanerOffers.map((offer) => {
                      const jobData = transformOfferToJobData(offer);
                      return (
                        <View
                          key={`offer-${offer.id}`}
                          style={styles.tileWrapper}
                        >
                          <MultiCleanerJobCard
                            job={jobData}
                            isOffer={true}
                            expiresAt={offer.expiresAt}
                            onAccept={() => handleAcceptOffer(offer)}
                            onDecline={() => handleDeclineOffer(offer)}
                            loading={multiCleanerLoading}
                            timeToBeCompleted={jobData.timeToBeCompleted}
                          />
                        </View>
                      );
                    })}

                    {/* Available Open Jobs - Join directly without modal */}
                    {availableMultiCleanerJobs.map((job) => {
                      const jobData = transformJobData(job);
                      return (
                        <View key={`job-${job.id}`} style={styles.tileWrapper}>
                          <MultiCleanerJobCard
                            job={jobData}
                            isOffer={false}
                            onJoinTeam={() =>
                              handleDirectJoinMultiCleanerJob(job)
                            }
                            onBookWithTeam={() => handleOpenTeamBooking(job)}
                            loading={multiCleanerLoading}
                            isBusinessOwner={state.isBusinessOwner}
                            hasEmployees={true}
                            timeToBeCompleted={jobData.timeToBeCompleted}
                          />
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {/* Available Jobs Section */}
            {availableJobs.length > 0 && (
              <View style={styles.section}>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("available")}
                >
                  <View style={styles.sectionTitleRow}>
                    <View
                      style={[
                        styles.sectionBadge,
                        styles.sectionBadgeAvailable,
                      ]}
                    >
                      <Icon
                        name="check"
                        size={12}
                        color={colors.success[600]}
                      />
                    </View>
                    <Text style={styles.sectionTitle}>Available Jobs</Text>
                  </View>
                  <View style={styles.sectionHeaderRight}>
                    <Text style={styles.sectionCount}>
                      {availableJobs.length}
                    </Text>
                    <Icon
                      name={
                        expandedSections.available
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={14}
                      color={colors.text.tertiary}
                    />
                  </View>
                </Pressable>
                {expandedSections.available && (
                  <>
                    {availableJobs.map((appointment) => (
                      <View key={appointment.id} style={styles.tileWrapper}>
                        <EmployeeAssignmentTile
                          {...appointment}
                          cleanerId={userId}
                          assigned={
                            appointment.employeesAssigned?.includes(
                              String(userId)
                            ) || false
                          }
                          isPreferred={preferredHomeIds.includes(
                            appointment.homeId
                          )}
                          isRequesting={requestingJobId === appointment.id}
                          addEmployee={handleBookingRequest}
                          removeEmployee={async (employeeId, appointmentId) => {
                            try {
                              await FetchData.removeEmployee(
                                employeeId,
                                appointmentId
                              );
                              setAllAppointments((prev) =>
                                prev.map((a) =>
                                  a.id === appointmentId
                                    ? {
                                        ...a,
                                        employeesAssigned:
                                          a.employeesAssigned?.filter(
                                            (id) => id !== String(employeeId)
                                          ),
                                      }
                                    : a
                                )
                              );
                            } catch (err) {
                              console.error("Error removing employee:", err);
                            }
                          }}
                        />
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort Jobs By</Text>
              <Pressable onPress={() => setShowSortModal(false)}>
                <Icon name="times" size={20} color={colors.text.secondary} />
              </Pressable>
            </View>
            {sortOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.sortOption,
                  sortOption === option.value && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortOption(option.value);
                  setShowSortModal(false);
                }}
              >
                <Icon
                  name={option.icon}
                  size={16}
                  color={
                    sortOption === option.value
                      ? colors.primary[600]
                      : colors.text.secondary
                  }
                />
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === option.value && styles.sortOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {sortOption === option.value && (
                  <Icon name="check" size={16} color={colors.primary[600]} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Large Home Warning Modal */}
      <LargeHomeWarningModal
        visible={showLargeHomeModal}
        onClose={handleCloseLargeHomeModal}
        onConfirm={handleConfirmLargeHomeBooking}
        bookingInfo={bookingInfo}
        loading={bookingLoading}
      />

      {/* Filter Modal */}
      <JobFilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onApply={setFilters}
        availableCities={availableCities}
        matchCount={filteredData.length}
        hasGeolocation={userLocation && userLocation.latitude !== 0}
        hasPreferredHomes={preferredHomeIds.length > 0}
      />

      {/* Stripe Setup Required Modal */}
      <Modal
        visible={showStripeSetupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStripeSetupModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowStripeSetupModal(false)}
        >
          <View
            style={styles.stripeModalContent}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.stripeModalIcon}>
              <Icon name="credit-card" size={32} color={colors.primary[600]} />
            </View>
            <Text style={styles.stripeModalTitle}>Payment Setup Required</Text>
            <Text style={styles.stripeModalMessage}>{stripeSetupMessage}</Text>
            <View style={styles.stripeModalButtons}>
              <Pressable
                style={styles.stripeSetupButton}
                onPress={() => {
                  setShowStripeSetupModal(false);
                  navigate("/earnings");
                }}
              >
                <Icon name="credit-card" size={16} color={colors.neutral[0]} />
                <Text style={styles.stripeSetupButtonText}>
                  Set Up Payments
                </Text>
              </Pressable>
              <Pressable
                style={styles.stripeCancelButton}
                onPress={() => setShowStripeSetupModal(false)}
              >
                <Text style={styles.stripeCancelButtonText}>Maybe Later</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Multi-Cleaner Job Modal */}
      <MultiCleanerOfferModal
        visible={showMultiCleanerModal}
        offer={
          selectedMultiCleanerJob
            ? transformJobToOfferFormat(selectedMultiCleanerJob)
            : null
        }
        onAccept={handleJoinMultiCleanerJob}
        onDecline={handleCloseMultiCleanerModal}
        onClose={handleCloseMultiCleanerModal}
        loading={multiCleanerLoading}
      />

      {/* Team Booking Modal (for business owners) */}
      <TeamBookingModal
        visible={showTeamBookingModal}
        job={selectedJobForTeam}
        onBook={handleTeamBookingComplete}
        onClose={() => {
          setShowTeamBookingModal(false);
          setSelectedJobForTeam(null);
        }}
        state={state}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing["3xl"],
    paddingBottom: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  calendarButton: {
    padding: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
  },

  // Stats
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  statCardHighlight: {
    backgroundColor: colors.warning[50],
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  statCardTeam: {
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
  },
  statValueHighlight: {
    color: colors.warning[700],
  },
  statValueTeam: {
    color: colors.primary[700],
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statLabelHighlight: {
    color: colors.warning[600],
  },
  statLabelTeam: {
    color: colors.primary[600],
  },

  // Controls Row
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },

  // Filter Button
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  filterBadge: {
    backgroundColor: colors.primary[600],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: typography.fontSize.xs,
    color: colors.neutral[0],
    fontWeight: typography.fontWeight.bold,
  },

  // Sort Button
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.neutral[0],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  sortButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  // Sections
  section: {
    marginBottom: spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sectionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warning[100],
    alignItems: "center",
    justifyContent: "center",
  },
  sectionBadgeAvailable: {
    backgroundColor: colors.success[100],
  },
  sectionBadgeTeam: {
    backgroundColor: colors.primary[100],
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sectionCount: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: typography.fontWeight.medium,
  },

  // Tile Wrapper
  tileWrapper: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.neutral[0],
    ...shadows.md,
    borderWidth: 1,
    borderColor: colors.border.light,
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["4xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  refreshButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  clearFiltersButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.glass.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.neutral[0],
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    paddingBottom: spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  sortOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sortOptionActive: {
    backgroundColor: colors.primary[50],
  },
  sortOptionText: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  },
  sortOptionTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },

  bottomSpacer: {
    height: spacing["4xl"],
  },

  // Stripe Setup Modal
  stripeModalContent: {
    backgroundColor: colors.neutral[0],
    marginHorizontal: spacing.lg,
    marginVertical: "auto",
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.lg,
  },
  stripeModalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary[100],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  stripeModalTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  stripeModalMessage: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  stripeModalButtons: {
    width: "100%",
    gap: spacing.sm,
  },
  stripeSetupButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  stripeSetupButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.neutral[0],
  },
  stripeCancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  stripeCancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  // Multi-cleaner request tile styles
  multiCleanerRequestTile: {
    backgroundColor: colors.neutral[0],
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderLeftWidth: 4,
    borderLeftColor: colors.primary[500],
  },
  multiCleanerRequestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  teamBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary[50],
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: 4,
  },
  teamBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  pendingBadge: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[600],
    backgroundColor: colors.warning[50],
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
  },
  multiCleanerRequestAddress: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: 2,
  },
  multiCleanerRequestDate: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  multiCleanerRequestDetails: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  multiCleanerRequestDetail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
  },
  multiCleanerRequestEarnings: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  multiCleanerRequestEarningsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  expiresText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: "italic",
  },
  // Time Constraint
  timeConstraintRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warning[50],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  timeConstraintText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.warning[700],
  },
  // Linens Dropdown
  linensContainer: {
    backgroundColor: colors.warning[50],
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.warning[200],
  },
  linensHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  linensHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  linensHeaderText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  linensContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.warning[200],
    paddingTop: spacing.sm,
  },
  linenSection: {
    marginBottom: spacing.sm,
  },
  linenSectionSpaced: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning[100],
  },
  linenCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: 2,
  },
  linenCategoryTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
  },
  linenSummary: {
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    paddingLeft: 22,
    lineHeight: 20,
  },
  linenNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.warning[100],
  },
  linenNoteText: {
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    flex: 1,
    lineHeight: 16,
  },
  multiCleanerRequestActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  requestSentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.success[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  requestSentText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.success[600],
  },
  cancelRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.error[50],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  cancelRequestText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.error[600],
  },
});

export default SelectNewJobList;
