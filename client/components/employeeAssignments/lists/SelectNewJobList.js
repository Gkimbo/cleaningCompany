import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import { Picker } from "@react-native-picker/picker";
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
    const [appointmentLocations, setAppointmentLocations] = useState(null);
    const [sortOption, setSortOption] = useState("distanceClosest");
    const { width } = Dimensions.get("window");
    const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAppointments = async () => {
            const response = await FetchData.get("/api/v1/users/appointments", state.currentUser.token);
            setAllAppointments(response.appointments || []);
        };
        const fetchUser = async () => {
            const response = await getCurrentUser();
            setUserId(response.user.id);
        };
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

    const sortedAppointments = [...allAppointments];

    if (sortOption === "distanceClosest" && userLocation && appointmentLocations) {
        sortedAppointments.sort((a, b) => {
            const locA = appointmentLocations[a.homeId];
            const locB = appointmentLocations[b.homeId];
            if (!locA || !locB) return 0;
            return haversineDistance(userLocation.latitude, userLocation.longitude, locA.latitude, locA.longitude) -
                   haversineDistance(userLocation.latitude, userLocation.longitude, locB.latitude, locB.longitude);
        });
    } else if (sortOption === "distanceFurthest" && userLocation && appointmentLocations) {
        sortedAppointments.sort((a, b) => {
            const locA = appointmentLocations[a.homeId];
            const locB = appointmentLocations[b.homeId];
            if (!locA || !locB) return 0;
            return haversineDistance(userLocation.latitude, userLocation.longitude, locB.latitude, locB.longitude) -
                   haversineDistance(userLocation.latitude, userLocation.longitude, locA.latitude, locA.longitude);
        });
    } else if (sortOption === "priceLow") {
        sortedAppointments.sort((a, b) => a.price - b.price);
    } else if (sortOption === "priceHigh") {
        sortedAppointments.sort((a, b) => b.price - a.price);
    }

    return (
        <View style={{ ...homePageStyles.container, flexDirection: "column" }}>
            <View style={homePageStyles.backButtonSelectNewJobList}>
                <Pressable style={homePageStyles.backButtonForm} onPress={() => setBackRedirect(true)}>
                    <View style={{ flexDirection: "row", alignItems: "center", padding: 10 }}>
                        <Icon name="angle-left" size={iconSize} color="black" />
                        <View style={{ marginLeft: 15 }}>
                            <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
                        </View>
                    </View>
                </Pressable>
            </View>

            {/* Sort Dropdown */}
            <View style={{ margin: 10, borderWidth: 1, borderRadius: 5, borderColor: "#ccc" }}>
                <Picker
                    selectedValue={sortOption}
                    onValueChange={(itemValue) => setSortOption(itemValue)}
                >
                    <Picker.Item label="Sort by: Distance (Closest)" value="distanceClosest" />
                    <Picker.Item label="Sort by: Distance (Furthest)" value="distanceFurthest" />
                    <Picker.Item label="Sort by: Price (Low to High)" value="priceLow" />
                    <Picker.Item label="Sort by: Price (High to Low)" value="priceHigh" />
                </Picker>
            </View>

            <ScrollView>
                {sortedAppointments.map((appointment) => (
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
                            addEmployee={async (employeeId, appointmentId) => {
                                await FetchData.addEmployee(employeeId, appointmentId);
                                setRefresh(true);
                            }}
                            removeEmployee={async (employeeId, appointmentId) => {
                                await FetchData.removeEmployee(employeeId, appointmentId);
                                setRefresh(true);
                            }}
                            assigned={appointment.employeesAssigned.includes(String(userId))}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
};

export default SelectNewJobList;