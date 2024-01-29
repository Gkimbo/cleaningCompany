import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	Pressable,
	Modal,
	StyleSheet,
	TouchableWithoutFeedback,
} from "react-native";
import { useNavigate } from "react-router-native";
import { Feather } from "@expo/vector-icons"; // Import the Feather icon library

import topBarStyles from "../../services/styles/TopBarStyles";
import HomeButton from "./HomeButton";
import SignOutButton from "./SignoutButton";
import ScheduleCleaningButton from "./ScheduleCleaningButton";
import EditHomeButton from "./EditHomeButton";
import AppointmentsButton from "./AppointmentsButton";
import BillButton from "./BillButton";

const TopBar = ({ dispatch, state }) => {
	const [signInRedirect, setSignInRedirect] = useState(false);
	const [signUpRedirect, setSignUpRedirect] = useState(false);
	const [modalVisible, setModalVisible] = useState(false);
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
	}, [signInRedirect, signUpRedirect]);

	const handlePressSignIn = () => {
		setSignInRedirect(true);
	};

	const handlePressSignUp = () => {
		setSignUpRedirect(true);
	};

	const toggleModal = () => {
		setModalVisible(!modalVisible);
	};

	const closeModal = () => {
		setModalVisible(false);
	};

	return (
		<View style={topBarStyles.container}>
			<View style={topBarStyles.containerTitleSection}>
				<Text style={topBarStyles.title}>Air BNB Cleaning Services</Text>
			</View>
			<View style={topBarStyles.containerButtonSection}>
				<HomeButton />
				{state.currentUser.token !== null ? (
					<>
						<Pressable style={styles.hamburgerButton} onPress={toggleModal}>
							<Feather name="menu" size={24} color="white" />
						</Pressable>
						<Modal
							animationType="slide"
							transparent={true}
							visible={modalVisible}
							onRequestClose={closeModal}
						>
							<TouchableWithoutFeedback onPress={closeModal}>
								<View style={styles.sideBarView}>
									<View style={styles.modalView}>
										<Text style={styles.modalHeader}>Menu</Text>
										{!state.account ? (
											<>
												<ScheduleCleaningButton closeModal={closeModal} />
												<View style={styles.buttonSeparator} />
												<EditHomeButton closeModal={closeModal} />
												<View style={styles.buttonSeparator} />
											</>
										) : null}
										{state.currentUser.token !== null && (
											<>
												{!state.account ? (
													<>
														{state.appointments.length !== 0 ? (
															<AppointmentsButton closeModal={closeModal} />
														) : null}
														<View style={styles.buttonSeparator} />
													</>
												) : null}

												<BillButton closeModal={closeModal} />
											</>
										)}
										<View style={styles.buttonSeparator} />
										<Text style={{ alignSelf: "center" }}>
											----------------
										</Text>
										<View style={styles.buttonSeparator} />
										<SignOutButton
											dispatch={dispatch}
											closeModal={closeModal}
										/>
										<TouchableWithoutFeedback onPress={closeModal}>
											<View style={styles.closeButton}>
												<Text style={styles.closeButtonText}>Close</Text>
											</View>
										</TouchableWithoutFeedback>
									</View>
								</View>
							</TouchableWithoutFeedback>
						</Modal>
					</>
				) : (
					<>
						<Pressable style={topBarStyles.button} onPress={handlePressSignIn}>
							<Text style={topBarStyles.buttonText}>Sign In</Text>
						</Pressable>
						<Pressable style={topBarStyles.button} onPress={handlePressSignUp}>
							<Text style={topBarStyles.buttonText}>Sign up</Text>
						</Pressable>
					</>
				)}
			</View>
		</View>
	);
};
const styles = StyleSheet.create({
	hamburgerButton: {
		padding: 8,
		marginRight: 8,
	},
	buttonSeparator: {
		height: 8, // Adjusted height for spacing between buttons
	},
	overlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	modalContainer: {
		flex: 1,
		justifyContent: "flex-end",
		alignItems: "flex-end",
		padding: 16,
	},
	modalContent: {
		backgroundColor: "white",
		borderRadius: 10,
		padding: 16,
		width: 200,
	},
	centeredView: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	sideBarView: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "flex-end",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
	},
	modalView: {
		backgroundColor: "white",
		borderRadius: 10,
		padding: 16, // Adjusted padding for a smaller sidebar
		width: 200, // Adjusted width for a smaller sidebar
		height: "100%",
		elevation: 5,
	},
	modalHeader: {
		fontSize: 20,
		fontWeight: "bold",
		marginBottom: 16,
	},
	closeButton: {
		marginTop: 13,
		backgroundColor: "#2196F3",
		padding: 10,
		borderRadius: 5,
		alignSelf: "center",
		alignItems: "center",
	},
	closeButtonText: {
		color: "white",
		fontWeight: "bold",
	},
});

export default TopBar;
