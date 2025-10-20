import React, { useEffect, useState } from "react";
import {
	Animated,
	Dimensions,
	Easing,
	ScrollView,
	Text,
	View
} from "react-native";
import { useNavigate } from "react-router-native";
import Application from "../../../services/fetchRequests/ApplicationClass";
import FetchData from "../../../services/fetchRequests/fetchData";
import ApplicationTile from "./ApplicationTile";
import CreateNewEmployeeForm from "./CreateNewEmployeeForm";

const ListOfApplications = () => {
	const [listApplications, setApplicationsList] = useState([]);
	const [deleteAnimation] = useState(new Animated.Value(0));
	const [deleteConfirmation, setDeleteConfirmation] = useState({});
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

	useEffect(() => {
		FetchData.getApplicationsFromBackend().then((response) => {
			setApplicationsList(response.serializedApplications);
		});
	}, []);

	const onDeleteApplication = async (id) => {
		try {
			await Application.deleteApplication(id);
			const response = await FetchData.getApplicationsFromBackend();
			setApplicationsList(response.serializedApplications);
		} catch (error) {
			console.error("Error deleting application:", error);
		}
	};

	const handleDeletePress = (applicationId) => {
		setDeleteConfirmation((prev) => ({
			[applicationId]: !prev[applicationId],
		}));

		if (deleteConfirmation[applicationId]) {
			Animated.timing(deleteAnimation, {
				toValue: 0,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start(() => {
				onDeleteApplication(applicationId);
				setDeleteConfirmation((prev) => ({
					...prev,
					[applicationId]: false,
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

	const handleNoPress = (applicationId) => {
		setDeleteConfirmation((prev) => ({
			[applicationId]: !prev[applicationId],
		}));
	};

	const usersApplications = listApplications.map((application) => (
		<View key={application.id} style={styles.cardContainer}>
			<ApplicationTile
				id={application.id}
				firstName={application.firstName}
				lastName={application.lastName}
				email={application.email}
				phone={application.phone}
				availability={application.availability}
				experience={application.experience}
				message={application.message}
				handleDeletePress={handleDeletePress}
				deleteAnimation={deleteAnimation}
				deleteConfirmation={deleteConfirmation}
				setDeleteConfirmation={setDeleteConfirmation}
				handleNoPress={handleNoPress}
				CreateNewEmployeeForm={CreateNewEmployeeForm}
				setApplicationsList={setApplicationsList}
			/>
		</View>
	));

	return (
		<ScrollView style={styles.container}>
			<View style={styles.headerContainer}>
				<Text style={styles.headerText}>Applications</Text>
				<View style={styles.headerLine} />
			</View>

			<View style={styles.listWrapper}>
				{listApplications.length > 0 ? (
					usersApplications
				) : (
					<Text style={styles.noData}>No applications found.</Text>
				)}
			</View>
		</ScrollView>
	);
};

const styles = {
	container: {
		flex: 1,
		backgroundColor: "#f8f9fb",
		paddingHorizontal: 20,
		paddingTop: 40,
	},
	headerContainer: {
		marginBottom: 20,
		alignItems: "center",
	},
	headerText: {
		fontSize: 24,
		fontWeight: "700",
		color: "#1E1E1E",
		marginBottom: 8,
		letterSpacing: 0.5,
	},
	headerLine: {
		width: 80,
		height: 3,
		backgroundColor: "#f9bc60",
		borderRadius: 2,
	},
	listWrapper: {
		paddingBottom: 40,
	},
	cardContainer: {
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 16,
		marginBottom: 16,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 6,
		elevation: 3,
	},
	noData: {
		textAlign: "center",
		color: "#777",
		fontSize: 16,
		marginTop: 40,
		fontWeight: "500",
	},
};

export default ListOfApplications;
