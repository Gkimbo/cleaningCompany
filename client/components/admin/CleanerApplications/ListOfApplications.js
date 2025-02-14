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
import homePageStyles from "../../../services/styles/HomePageStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import ApplicationListStyles from "../../../services/styles/ApplicationListStyles"
import ApplicationTile from "./ApplicationTile";
import Application from "../../../services/fetchRequests/ApplicationClass";
import CreateNewEmployeeForm from "./CreateNewEmployeeForm";

const ListOfApplications = () => {
  const [listApplications, setApplicationsList] = useState([]);
  const styles = ApplicationListStyles
	const [deleteAnimation] = useState(new Animated.Value(0));
	const [deleteConfirmation, setDeleteConfirmation] = useState({});
	const [confirmationModalVisible, setConfirmationModalVisible] = useState({
		boolean: false,
		id: null,
	});
 
	const { width } = Dimensions.get("window");
	const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
	const navigate = useNavigate();

  useEffect(() => {
    FetchData.getApplicationsFromBackend().then((response) => {
      console.log(response.serializedApplications);
      setApplicationsList(response.serializedApplications);
    });
  }, []);

  const onDeleteApplication = async (id) => {
		try {
			const application = await Application.deleteApplication(id);
      FetchData.getApplicationsFromBackend().then((response) => {
        console.log(response.serializedApplications);
        setApplicationsList(response.serializedApplications);
      });
		} catch (error) {
			console.error("Error deleting application:", error);
		}
	};

  const handleDeletePress = (applicationId) => {
		setDeleteConfirmation((prevConfirmations) => ({
			[applicationId]: !prevConfirmations[applicationId],
		}));
		if (deleteConfirmation[applicationId]) {
			Animated.timing(deleteAnimation, {
				toValue: 0,
				duration: 300,
				easing: Easing.linear,
				useNativeDriver: false,
			}).start(() => {
				onDeleteApplication(applicationId);
				setDeleteConfirmation((prevConfirmations) => ({
					...prevConfirmations,
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
		setDeleteConfirmation((prevConfirmations) => ({
			[applicationId]: !prevConfirmations[applicationId],
		}));
	};

  const usersApplications = listApplications.map((application) => {
		return (
			<View key={application.id}>
				<ApplicationTile
					id={application.id}
					firstName= {application.firstName}
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
		);
	});

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Applications List</Text>
      <View>
        {listApplications.length > 0 ? (
            <View style={styles.card}>
             {usersApplications}
            </View>
        ) : (
          <Text style={styles.noData}>No applications found.</Text>
        )}
      </View>
    </ScrollView>
  );
};

export default ListOfApplications;

