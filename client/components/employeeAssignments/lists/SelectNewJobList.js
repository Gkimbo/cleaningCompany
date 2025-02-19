import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../../services/styles/TopBarStyles";
import FetchData from "../../../services/fetchRequests/fetchData";
import EmployeeAssignmentTile from "../tiles/EmployeeAssignmentTile";
import getCurrentUser from "../../../services/fetchRequests/getCurrentUser";

const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const SelectNewJobList = ({ state, dispatch }) => {
    const [allAppointments, setAllAppointments] = useState([]);
    const [refresh, setRefresh] = useState(false);
    const [changesSubmitted, setChangesSubmitted] = useState(false);
    const [redirect, setRedirect] = useState(false);
    const [backRedirect, setBackRedirect] = useState(false);
    const [userId, setUserId] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
	const [appointmentLocations, setAppointmentLocations] = useState(null)
    const { width } = Dimensions.get("window");
    const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
    const navigate = useNavigate();
	
useEffect(() => {
    if (navigator.geolocation) {
        const watcher = navigator.geolocation.watchPosition(
            (position) => {
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                console.error("Error getting location:", error);
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }
}, []);

useEffect(() => {
	const fetchLocations = async () => {
		try {
			const locations = await Promise.all(
				allAppointments.map(async (appointment) => {
					const response = await FetchData.getLatAndLong(appointment.homeId);
					return { [appointment.homeId]: response };
				})
			);
			setAppointmentLocations(Object.assign({}, ...locations));
		} catch (error) {
			console.error("Error fetching appointment locations:", error);
		}
	};

	if (allAppointments.length > 0) {
		fetchLocations();
	}
}, [allAppointments]);


    const fetchAppointments = async () => {
        const response = await FetchData.get(
            "/api/v1/users/appointments",
            state.currentUser.token
        );
        setAllAppointments(response.appointments);
    };

	const fetchAppointmentLocation = async (id) => {
		const response = await FetchData.getLatAndLong(id)
		console.log("LAT + LONG ",response)
		setAppointmentLocation(response)
	}
    const fetchUser = async () => {
        const response = await getCurrentUser();
        setUserId(response.user.id);
    };

    useEffect(() => {
        fetchAppointments();
        fetchUser();
        setChangesSubmitted(false);
        if (redirect) {
            navigate("/add-home");
            setRedirect(false);
        }
        if (backRedirect) {
            navigate("/");
            setBackRedirect(false);
        }
        if (refresh) {
            setRefresh(false);
        }
    }, [redirect, backRedirect, changesSubmitted, refresh]);

    const handlePress = () => {
        setRedirect(true);
    };

    const handleBackPress = () => {
        setBackRedirect(true);
    };

    const sortedAppointments = userLocation && appointmentLocations
    ? [...allAppointments].sort((a, b) => {
        const locA = appointmentLocations[a.homeId];
        const locB = appointmentLocations[b.homeId];
        if (!locA || !locB) return 0;
        const distA = haversineDistance(
            userLocation.latitude, userLocation.longitude,
            locA.latitude, locA.longitude
        );
        const distB = haversineDistance(
            userLocation.latitude, userLocation.longitude,
            locB.latitude, locB.longitude
        );
        return distA - distB;
    })
    : allAppointments;
	console.log(sortedAppointments)


    const removeEmployee = async (employeeId, appointmentId) => {
        await FetchData.removeEmployee(
            employeeId,
            appointmentId
        );
        setRefresh(true);
    };

    const addEmployee = async (employeeId, appointmentId) => {
        await FetchData.addEmployee(
            employeeId,
            appointmentId
        );
        setRefresh(true);
    };

    const assignedAppointments = sortedAppointments.map((appointment) => {
        let isAssigned = appointment.employeesAssigned.includes(String(userId));
        if (!appointment.hasBeenAssigned) {
            return (
                <View key={appointment.id}>
                    <EmployeeAssignmentTile
                        id={appointment.id}
                        cleanerId={userId}
                        date={appointment.date}
                        price={appointment.price}
                        homeId={appointment.homeId}
                        hasBeenAssigned={appointment.hasBeenAssigned}
                        bringSheets={appointment.bringSheets}
                        bringTowels={appointment.bringTowels}
                        completed={appointment.completed}
                        keyPadCode={appointment.keyPadCode}
                        keyLocation={appointment.keyLocation}
                        addEmployee={addEmployee}
                        removeEmployee={removeEmployee}
                        assigned={isAssigned}
                    />
                </View>
            );
        } else if (appointment.hasBeenAssigned && isAssigned) {
            return (
                <View key={appointment.id}>
                    <EmployeeAssignmentTile
                        id={appointment.id}
                        cleanerId={userId}
                        date={appointment.date}
                        price={appointment.price}
                        homeId={appointment.homeId}
                        hasBeenAssigned={appointment.hasBeenAssigned}
                        bringSheets={appointment.bringSheets}
                        bringTowels={appointment.bringTowels}
                        completed={appointment.completed}
                        keyPadCode={appointment.keyPadCode}
                        keyLocation={appointment.keyLocation}
                        addEmployee={addEmployee}
                        removeEmployee={removeEmployee}
                        assigned={isAssigned}
                    />
                </View>
            );
        }
    });

    return (
        <View style={{ ...homePageStyles.container, flexDirection: "column" }}>
            <View style={homePageStyles.backButtonSelectNewJobList}>
                <Pressable style={homePageStyles.backButtonForm} onPress={handleBackPress}>
                    <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
                        <Icon name="angle-left" size={iconSize} color="black" />
                        <View style={{ marginLeft: 15 }}>
                            <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
                        </View>
                    </View>
                </Pressable>
            </View>
            {assignedAppointments}
        </View>
    );
};

export default SelectNewJobList;
