import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";
import { colors, spacing, radius, shadows } from "../../services/styles/theme";
import Application from "../../services/fetchRequests/ApplicationClass";
import ClientDashboardService from "../../services/fetchRequests/ClientDashboardService";
import ReferralService from "../../services/fetchRequests/ReferralService";

import AppointmentsButton from "./AppointmentsButton";
import BillButton from "./BillButton";
import ChooseNewJobButton from "./ChooseNewJobButton";
import CleanerRequestsButton from "./CleanerRequestsButton";
import EarningsButton from "./EarningsButton";
import EditHomeButton from "./EditHomeButton";
import EmployeeAssignmentsButton from "./EmployeeAssignmentsButton";
import HomeButton from "./HomeButton";
import ManageEmployees from "./ManageEmployeeButton";
import ManagePricingButton from "./ManagePricingButton";
import IncentivesButton from "./IncentivesButton";
import MyRequestsButton from "./MyRequestsButton";
import ScheduleCleaningButton from "./ScheduleCleaningButton";
import SeeAllAppointments from "./SeeAllAppointmentsButton";
import SignOutButton from "./SignoutButton";
import UnassignedAppointmentsButton from "./UnassignedAppointmentsButton";
import ViewApplicationsButton from "./ViewApplicationsButton";
import MessagesButton from "../messaging/MessagesButton";
import AccountSettingsButton from "./AccountSettingsButton";
import RecommendedSuppliesButton from "./RecommendedSuppliesButton";
import ArchiveButton from "./ArchiveButton";
import ReviewsButton from "./ReviewsButton";
import ReferralsButton from "./ReferralsButton";
import MyReferralsButton from "./MyReferralsButton";
import ChecklistEditorButton from "./ChecklistEditorButton";
import HRManagementButton from "./HRManagementButton";
import TermsEditorButton from "./TermsEditorButton";
import WithdrawalsButton from "./WithdrawalsButton";
import MyClientsButton from "./MyClientsButton";
import SuspiciousReportsButton from "./SuspiciousReportsButton";

const TopBar = ({ dispatch, state }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [signInRedirect, setSignInRedirect] = useState(false);
  const [signUpRedirect, setSignUpRedirect] = useState(false);
  const [becomeCleanerRedirect, setBecomeCleanerRedirect] = useState(false);
  const [importBusinessRedirect, setImportBusinessRedirect] = useState(false);
  const [referralsEnabled, setReferralsEnabled] = useState(false);

  // Use global state for pending applications and cleaner requests
  const pendingApplications = state.pendingApplications || 0;
  const pendingCleanerRequests = state.pendingCleanerRequests || 0;

  const navigate = useNavigate();

  // Fetch pending applications count for owners and HR
  useEffect(() => {
    const fetchPendingApplications = async () => {
      if (state.account === "owner" || state.account === "humanResources") {
        const count = await Application.getPendingCount();
        dispatch({
          type: "SET_PENDING_APPLICATIONS",
          payload: count,
        });
      }
    };
    fetchPendingApplications();
  }, [state.account, dispatch]);

  // Fetch pending cleaner requests count for clients (homeowners)
  useEffect(() => {
    const fetchPendingCleanerRequests = async () => {
      // Only fetch for regular users (clients/homeowners), not cleaners or owners
      if (!state.account && state.currentUser.token) {
        try {
          const data = await ClientDashboardService.getPendingRequestsForClient(
            state.currentUser.token
          );
          dispatch({
            type: "SET_PENDING_CLEANER_REQUESTS",
            payload: data.totalCount || 0,
          });
        } catch (error) {
          console.error("Error fetching pending cleaner requests:", error);
        }
      }
    };
    fetchPendingCleanerRequests();

    // Refresh every 60 seconds
    const interval = setInterval(fetchPendingCleanerRequests, 60000);
    return () => clearInterval(interval);
  }, [state.account, state.currentUser.token, dispatch]);

  // Fetch referral programs status to determine if referrals button should be shown
  useEffect(() => {
    const fetchReferralsStatus = async () => {
      // Only check for clients and cleaners (not owners - they always see it)
      if (state.currentUser.token && state.account !== "owner") {
        try {
          const data = await ReferralService.getCurrentPrograms();

          if (!data.active || !data.programs || data.programs.length === 0) {
            setReferralsEnabled(false);
            return;
          }

          // Check if there are programs applicable to the user's type
          const isCleaner = state.account === "cleaner";
          const hasApplicablePrograms = data.programs.some((program) => {
            if (isCleaner) {
              // Cleaners can use cleaner_to_cleaner and cleaner_to_client programs
              return program.type === "cleaner_to_cleaner" || program.type === "cleaner_to_client";
            } else {
              // Homeowners/clients can use client_to_client and client_to_cleaner programs
              return program.type === "client_to_client" || program.type === "client_to_cleaner";
            }
          });

          setReferralsEnabled(hasApplicablePrograms);
        } catch (error) {
          console.error("Error fetching referral programs:", error);
          setReferralsEnabled(false);
        }
      }
    };
    fetchReferralsStatus();
  }, [state.currentUser.token, state.account]);

  useEffect(() => {
    if (signInRedirect) {
      navigate("/sign-in");
      setSignInRedirect(false);
    }
    if (signUpRedirect) {
      navigate("/sign-up");
      setSignUpRedirect(false);
    }
    if (becomeCleanerRedirect) {
      navigate("/apply");
      setBecomeCleanerRedirect(false);
    }
    if (importBusinessRedirect) {
      navigate("/import-business");
      setImportBusinessRedirect(false);
    }
  }, [signInRedirect, signUpRedirect, becomeCleanerRedirect, importBusinessRedirect]);

  const toggleModal = () => setModalVisible(!modalVisible);
  const closeModal = () => setModalVisible(false);

  return (
    <View style={styles.glassContainer}>
      {state.currentUser.token ? (
        <>
          <View style={styles.headerContent}>
            <Text style={styles.brand}>Kleanr</Text>

            <View style={styles.rightSection}>
              <MessagesButton state={state} dispatch={dispatch} />
              <HomeButton />
              {/* Applications notification badge for owners and HR */}
              {(state.account === "owner" || state.account === "humanResources") && pendingApplications > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.notificationButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => navigate("/view-all-applications")}
                >
                  <Feather name="users" size={20} color="white" />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {pendingApplications > 9 ? "9+" : pendingApplications}
                    </Text>
                  </View>
                </Pressable>
              )}
              {/* Pending cleaner requests notification badge for clients */}
              {!state.account && pendingCleanerRequests > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles.notificationButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => navigate("/client-requests")}
                >
                  <Feather name="user-check" size={20} color="white" />
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {pendingCleanerRequests > 9
                        ? "9+"
                        : pendingCleanerRequests}
                    </Text>
                  </View>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [
                  styles.hamburgerButton,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={toggleModal}
              >
                <Feather name="menu" size={26} color="white" />
              </Pressable>

              {/* Sidebar Modal */}
              <Modal
                animationType="slide"
                transparent
                visible={modalVisible}
                onRequestClose={closeModal}
              >
                <TouchableWithoutFeedback onPress={closeModal}>
                  <View style={styles.overlay}>
                    <View style={styles.glassSidebar}>
                      <Text style={styles.sidebarHeader}>Menu</Text>

                      <ScrollView
                        style={styles.menuScrollView}
                        showsVerticalScrollIndicator={false}
                      >
                        {state.account === "owner" ? (
                          <>
                            <ManageEmployees closeModal={closeModal} />
                            <ManagePricingButton closeModal={closeModal} />
                            <ReferralsButton closeModal={closeModal} />
                            <SeeAllAppointments closeModal={closeModal} />
                            <UnassignedAppointmentsButton
                              closeModal={closeModal}
                            />
                            <ViewApplicationsButton closeModal={closeModal} />
                            <IncentivesButton closeModal={closeModal} />
                            <ChecklistEditorButton closeModal={closeModal} />
                            <HRManagementButton closeModal={closeModal} />
                            <SuspiciousReportsButton closeModal={closeModal} />
                            <TermsEditorButton closeModal={closeModal} />
                            <WithdrawalsButton closeModal={closeModal} />
                          </>
                        ) : state.account === "cleaner" ? (
                          <>
                            <ChooseNewJobButton closeModal={closeModal} />
                            <EmployeeAssignmentsButton closeModal={closeModal} />
                            <MyRequestsButton closeModal={closeModal} />
                            <MyClientsButton closeModal={closeModal} />
                            {/* <EmployeeShiftButton closeModal={closeModal} /> */}
                            <EarningsButton closeModal={closeModal} />
                            {referralsEnabled && <MyReferralsButton closeModal={closeModal} />}
                            <RecommendedSuppliesButton closeModal={closeModal} />
                          </>
                        ) : state.account === "humanResources" ? (
                          <>
                            <ViewApplicationsButton closeModal={closeModal} />
                            <ManageEmployees closeModal={closeModal} />
                            <SuspiciousReportsButton closeModal={closeModal} />
                          </>
                        ) : (
                          <>
                            <ScheduleCleaningButton closeModal={closeModal} />
                            <EditHomeButton closeModal={closeModal} />
                            {/* <CleanerRequestsButton closeModal={closeModal} /> */}
                          </>
                        )}

                        {state.currentUser.token && !state.account && (
                          <>
                            {state.appointments.length !== 0 && (
                              <AppointmentsButton closeModal={closeModal} />
                            )}
                            <BillButton closeModal={closeModal} />
                            <ArchiveButton closeModal={closeModal} />
                            <ReviewsButton closeModal={closeModal} />
                            {referralsEnabled && <MyReferralsButton closeModal={closeModal} />}
                          </>
                        )}

                        <AccountSettingsButton closeModal={closeModal} />
                        <SignOutButton
                          dispatch={dispatch}
                          closeModal={closeModal}
                        />
                      </ScrollView>

                      <Pressable
                        style={({ pressed }) => [
                          styles.closeButton,
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={closeModal}
                      >
                        <Text style={styles.closeButtonText}>Close</Text>
                      </Pressable>
                    </View>
                  </View>
                </TouchableWithoutFeedback>
              </Modal>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.unauthContainer}>
          <View style={styles.authButtonsContainerTitle}>
            <Text style={styles.brand}>Kleanr</Text>
            <HomeButton />
          </View>
          <View style={styles.authButtonsContainer}>
            <Pressable
              style={styles.authButton}
              onPress={() => setSignInRedirect(true)}
            >
              <Text style={styles.authButtonText}>Sign In</Text>
            </Pressable>
            <Pressable
              style={styles.authButton}
              onPress={() => setSignUpRedirect(true)}
            >
              <Text style={styles.authButtonText}>Sign Up</Text>
            </Pressable>
            <Pressable
              style={styles.authButton}
              onPress={() => setBecomeCleanerRedirect(true)}
            >
              <Text style={styles.authButtonText}>Become a Cleaner</Text>
            </Pressable>
            <Pressable
              style={[styles.authButton, styles.importBusinessButton]}
              onPress={() => setImportBusinessRedirect(true)}
            >
              <Text style={styles.authButtonText}>Business Owner</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Top bar container - dark slate that complements teal
  glassContainer: {
    marginTop: Platform.OS === "ios" ? 10 : 5,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.neutral[700],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: colors.neutral[800],
  },

  // Container for brand and right section
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },

  brand: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
    color: colors.primary[400], // Teal accent for brand
    fontFamily: Platform.select({
      ios: "AvenirNext-Bold",
      android: "Roboto-Bold",
      default: "Poppins-Bold",
    }),
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Right section (buttons)
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Hamburger menu button
  hamburgerButton: {
    padding: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.neutral[700],
  },

  // Notification button with badge
  notificationButton: {
    padding: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primary[600],
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error[500],
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.neutral[800],
  },
  badgeText: {
    color: colors.neutral[0],
    fontSize: 10,
    fontWeight: "700",
  },

  // Auth buttons (Sign In / Sign Up / Become Cleaner)
  authButton: {
    backgroundColor: colors.neutral[700],
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[600],
  },
  authButtonText: {
    color: colors.neutral[100],
    fontWeight: "600",
    fontSize: 12,
  },
  importBusinessButton: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[500],
  },

  // Overlay behind modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 60,
  },

  // Sidebar modal container
  glassSidebar: {
    width: 250,
    height: "100%",
    backgroundColor: colors.neutral[800],
    borderLeftWidth: 1,
    borderColor: colors.neutral[700],
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },

  // Scrollable menu content
  menuScrollView: {
    flex: 1,
    marginBottom: 10,
  },

  // Modal header text
  sidebarHeader: {
    color: colors.primary[400],
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[700],
  },

  // Close button inside modal
  closeButton: {
    marginTop: 24,
    backgroundColor: colors.primary[600],
    paddingVertical: 12,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  closeButtonText: {
    color: colors.neutral[0],
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },

  // General glass buttons (Sign Out / My Requests / Home)
  glassButton: {
    marginVertical: 6,
    backgroundColor: colors.neutral[700],
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neutral[600],
  },
  glassButtonText: {
    color: colors.neutral[100],
    fontWeight: "600",
    fontSize: 15,
  },
  unauthContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  unauthContainerTitle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },

  authButtonsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
  },
  authButtonsContainerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 2,
  },
});

export default TopBar;
