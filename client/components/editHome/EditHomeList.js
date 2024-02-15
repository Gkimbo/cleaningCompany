import React, { useState, useEffect } from "react";
import {
	Pressable,
	View,
	Text,
	ScrollView,
	Animated,
	Easing,
	Dimensions,
	Modal,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import EditHomeTile from "../tiles/EditHomeTile";
import FetchData from "../../services/fetchRequests/fetchData";
import topBarStyles from "../../services/styles/TopBarStyles";
import calenderStyles from "../../services/styles/CalenderSyles";
import Appointment from "../../services/fetchRequests/AppointmentClass";

const EditHomeList = ({ state, dispatch }) => {
	const [redirect, setRedirect] = useState(false);
	const [backRedirect, setBackRedirect] = useState(false);
	const [deleteAnimation] = useState(new Animated.Value(0));
	const [deleteConfirmation, setDeleteConfirmation] = useState({});
	const [fee, setFee] = useState(0);
	const [confirmationModalVisible, setConfirmationModalVisible] = useState({
		boolean: false,
		id: null,
	});
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	useEffect(() => {
		if (redirect) {
			navigate("/add-home");
			setRedirect(false);
		}
		if (backRedirect) {
			navigate("/");
			setBackRedirect(false);
		}
	}, [redirect, backRedirect]);

	const handlePress = () => {
		setRedirect(true);
	};

	const handleBackPress = () => {
		setBackRedirect(true);
	};

	const handleEdit = (id) => {
		navigate(`/edit-home/${id}`);
	};

	const handleNoPress = (homeId) => {
		setDeleteConfirmation((prevConfirmations) => ({
			[homeId]: !prevConfirmations[homeId],
		}));
	};

	const handleConfirmation = async (deleteAppointment, id) => {
		setConfirmationModalVisible({ boolean: false, id: null });
		if (deleteAppointment) {
			try {
				const deleteHome = await FetchData.deleteHome(id);
				if (deleteHome) {
					dispatch({ type: "DELETE_HOME", payload: id });
				}
			} catch (error) {
				console.error("Error deleting home:", error);
			}
		}
	};

	const checkAppointmentsWithinWeek = async (homeId) => {
		const appointments = await Appointment.getHomeAppointments(homeId);
		const currentDate = new Date();
		let fee = 0;
		const dateArray = appointments.appointments.map((date) => {
			return new Date(date.date);
		});

		const isWithinWeek = dateArray.map((date) => {
			if (date.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000) {
				fee += 25;
			}
			return date.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;
		});

		const withinWeek = dateArray.some((date) => {
			const timeDifference = date.getTime() - currentDate.getTime();
			const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
			return timeDifference >= 0 && timeDifference <= oneWeekInMilliseconds;
		});
		setFee(fee);
		return withinWeek;
	};

	const onDeleteHome = async (id) => {
		try {
			const checkAppointments = await checkAppointmentsWithinWeek(id);
			if (!checkAppointments) {
				const deleteHome = await FetchData.deleteHome(id);
				if (deleteHome) {
					dispatch({ type: "DELETE_HOME", payload: id });
				}
			} else {
				setConfirmationModalVisible({ boolean: true, id: id });
			}
		} catch (error) {
			console.error("Error deleting home:", error);
		}
	};

	const handleDeletePress = (homeId) => {
		setDeleteConfirmation((prevConfirmations) => ({
			[homeId]: !prevConfirmations[homeId],
		}));
		if (deleteConfirmation[homeId]) {
			Animated.timing(deleteAnimation, {
				toValue: 0,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start(() => {
				onDeleteHome(homeId);
				setDeleteConfirmation((prevConfirmations) => ({
					...prevConfirmations,
					[homeId]: false,
				}));
			});
		} else {
			Animated.timing(deleteAnimation, {
				toValue: 1,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start();
		}
	};

	const usersHomes = state.homes.map((home) => {
		return (
			<View key={home.id}>
				<EditHomeTile
					id={home.id}
					nickName={home.nickName}
					state={home.state}
					address={home.address}
					city={home.city}
					zipcode={home.zipcode}
					numBeds={home.numBeds}
					numBaths={home.numBaths}
					sheetsProvided={home.sheetsProvided}
					towelsProvided={home.towelsProvided}
					keyPadCode={home.keyPadCode}
					keyLocation={home.keyLocation}
					recyclingLocation={home.recyclingLocation}
					compostLocation={home.compostLocation}
					trashLocation={home.trashLocation}
					handleDeletePress={handleDeletePress}
					deleteAnimation={deleteAnimation}
					deleteConfirmation={deleteConfirmation}
					setDeleteConfirmation={setDeleteConfirmation}
					handleNoPress={handleNoPress}
					handleEdit={handleEdit}
				/>
			</View>
		);
	});

	return (
		<View style={{ ...homePageStyles.container, flexDirection: "column" }}>
			<View style={homePageStyles.backButtonContainerList}>
				<Pressable
					style={homePageStyles.backButtonForm}
					onPress={handleBackPress}
				>
					<View
						style={{ flexDirection: "row", alignItems: "center", padding: 10 }}
					>
						<Icon name="angle-left" size={iconSize} color="black" />
						<View style={{ marginLeft: 15 }}>
							<Text style={topBarStyles.buttonTextSchedule}>Back</Text>
						</View>
					</View>
				</Pressable>
			</View>
			<ScrollView>
				{state.homes.length > 0 ? (
					<>
						{usersHomes}
						<Pressable
							style={homePageStyles.AddHomeButton}
							onPress={handlePress}
						>
							<Text style={homePageStyles.AddHomeButtonText}>
								Add another Home
							</Text>
						</Pressable>
					</>
				) : (
					<Pressable style={homePageStyles.AddHomeButton} onPress={handlePress}>
						<Text style={homePageStyles.AddHomeButtonText}>Add a Home</Text>
					</Pressable>
				)}
			</ScrollView>
			<Modal
				animationType="slide"
				transparent={true}
				visible={confirmationModalVisible.boolean}
				onRequestClose={() =>
					setConfirmationModalVisible({ boolean: false, id: null })
				}
			>
				<View style={calenderStyles.modalContainer}>
					<View style={calenderStyles.modalContent}>
						<Text style={calenderStyles.modalText}>
							{`Are you sure you want to delete this home? 
							A $${fee} cancellation fee will be charged to delete all appointments that are within a week of today.`}
						</Text>
						<View style={calenderStyles.modalButtons}>
							<Pressable
								onPress={() =>
									handleConfirmation(false, confirmationModalVisible.id)
								}
							>
								<View style={calenderStyles.keepButton}>
									<Text style={calenderStyles.buttonText}>Keep</Text>
								</View>
							</Pressable>
							<Pressable
								onPress={() =>
									handleConfirmation(true, confirmationModalVisible.id)
								}
							>
								<View style={calenderStyles.deleteButton}>
									<Text style={calenderStyles.buttonText}>Delete</Text>
								</View>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</View>
	);
};

export default EditHomeList;
