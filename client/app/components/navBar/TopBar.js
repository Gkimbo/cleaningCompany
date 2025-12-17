import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useNavigate } from "react-router-native";

import AppointmentsButton from "./AppointmentsButton";
import BillButton from "./BillButton";
import ChooseNewJobButton from "./ChooseNewJobButton";
import CleanerRequestsButton from "./CleanerRequestsButton";
import EarningsButton from "./EarningsButton";
import EditHomeButton from "./EditHomeButton";
import EmployeeAssignmentsButton from "./EmployeeAssignmentsButton";
import HomeButton from "./HomeButton";
import ManageEmployees from "./ManageEmployeeButton";
import MyRequestsButton from "./MyRequestsButton";
import ScheduleCleaningButton from "./ScheduleCleaningButton";
import SeeAllAppointments from "./SeeAllAppointmentsButton";
import SignOutButton from "./SignoutButton";
import UnassignedAppointmentsButton from "./UnassignedAppointmentsButton";
import ViewApplicationsButton from "./ViewApplicationsButton";
import MessagesButton from "../messaging/MessagesButton";
import AccountSettingsButton from "./AccountSettingsButton";


const TopBar = ({ dispatch, state }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [signInRedirect, setSignInRedirect] = useState(false);
  const [signUpRedirect, setSignUpRedirect] = useState(false);
  const [becomeCleanerRedirect, setBecomeCleanerRedirect] = useState(false);

  const navigate = useNavigate();

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
  }, [signInRedirect, signUpRedirect, becomeCleanerRedirect]);

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

                      {state.account === "manager1" ? (
                        <>
                          <ManageEmployees closeModal={closeModal} />
                          <SeeAllAppointments closeModal={closeModal} />
                          <UnassignedAppointmentsButton
                            closeModal={closeModal}
                          />
                          <ViewApplicationsButton closeModal={closeModal} />
                        </>
                      ) : state.account === "cleaner" ? (
                        <>
                          <ChooseNewJobButton closeModal={closeModal} />
                          <EmployeeAssignmentsButton closeModal={closeModal} />
                          <MyRequestsButton closeModal={closeModal} />
                          {/* <EmployeeShiftButton closeModal={closeModal} /> */}
                          <EarningsButton closeModal={closeModal} />
                          <AccountSettingsButton closeModal={closeModal} />
                        </>
                      ) : (
                        <>
                          <ScheduleCleaningButton closeModal={closeModal} />
                          <EditHomeButton closeModal={closeModal} />
                          <CleanerRequestsButton closeModal={closeModal} />
                          <AccountSettingsButton closeModal={closeModal} />
                        </>
                      )}

                      {state.currentUser.token && !state.account && (
                        <>
                          {state.appointments.length !== 0 && (
                            <AppointmentsButton closeModal={closeModal} />
                          )}
                          <BillButton closeModal={closeModal} />
                        </>
                      )}

                      <SignOutButton
                        dispatch={dispatch}
                        closeModal={closeModal}
                      />

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
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Top bar container with vibrant multi-color glass effect
  glassContainer: {
    marginTop: Platform.OS === "ios" ? 10 : 5,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#FF69B4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
    backdropFilter: "blur(12px)", // web
    backgroundColor: "rgba(30, 144, 255, 0.35)",
    // Multi-color gradient for web fallback
    background:
      "linear-gradient(90deg, #1E90FF, #7B68EE, #FF69B4, #FFB347, #00CED1)",
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
    color: "#facc15", // warm amber-gold that pairs beautifully with blue
    fontFamily: Platform.select({
      ios: "AvenirNext-Bold",
      android: "Roboto-Bold",
      default: "Poppins-Bold",
    }),

    // Light shadow for clarity, not drama
    textShadowColor: "rgba(0, 0, 0, 0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,

    // Small glow for subtle prominence on glassy backgrounds
    shadowColor: "rgba(250, 189, 21, 0.4)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
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
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#FF69B4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },

  // Auth buttons (Sign In / Sign Up / Become Cleaner)
  authButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  authButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Overlay behind modal
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 60, // pushes sidebar down so header is visible
  },

  // Sidebar modal container
  glassSidebar: {
    width: 230,
    height: "100%",
    backgroundColor: "rgba(123, 104, 238, 0.35)", // purple-tinted glass
    borderLeftWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    padding: 20,
    backdropFilter: "blur(15px)",
    shadowColor: "#FF69B4",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal header text
  sidebarHeader: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Close button inside modal
  closeButton: {
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },

  // General glass buttons (Sign Out / My Requests / Home)
  glassButton: {
    marginVertical: 8,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#FF4500",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  glassButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  unauthContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  unauthContainerTitle: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },

  authButtonsContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
});

export default TopBar;
