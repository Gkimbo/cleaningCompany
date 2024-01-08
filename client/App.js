import React, { useEffect, useReducer, useState } from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
import { NativeRouter, Route, Routes } from "react-router-native";
import reducer from "./services/reducerFunction";
import getCurrentUser from "./services/fetchRequests/getCurrentUser";
import { AuthProvider } from "./services/AuthContext";

import HomePage from "./components/HomePage";
import TopBar from "./components/navBar/TopBar";
import SignIn from "./components/userAuthentication/SignIn";
import SignUp from "./components/userAuthentication/SignUp";
import CalendarComponent from "./components/calender/CalendarComponent";
import HomeList from "./components/appointments/HomeList";
import appStyles from "./services/styles/AppStyle";
import AddHomeForm from "./components/addUserInformation/AddHomeForm";
import DetailsComponent from "./components/appointments/DetailsComponent";

export default function App() {
	const [isLoading, setIsLoading] = useState(true);
	const [lastLoginTimestamp, setLastLoginTimestamp] = useState("0");
	const [state, dispatch] = useReducer(reducer, {
		currentUser: { token: null },
		homes: [],
	});
	const onDatesSelected = (event) => {
		event.preventDefault();
		console.log(event);
	};

	const fetchCurrentUser = async () => {
		try {
			const user = await getCurrentUser();
			console.log(user);
			dispatch({ type: "CURRENT_USER", payload: user.token });
			setLastLoginTimestamp(user.user.lastLogin);
		} catch (err) {
			dispatch({ type: "CURRENT_USER", payload: null });
		}
	};

	useEffect(() => {
		fetchCurrentUser();
		setTimeout(() => {
			setIsLoading(false);
		}, 2000);
	}, []);

	if (isLoading) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	return (
		<AuthProvider>
			<NativeRouter>
				<SafeAreaView style={{ ...appStyles.container, paddingBottom: 60 }}>
					<TopBar dispatch={dispatch} state={state} />
					<Routes>
						<Route
							path="/"
							element={<HomePage dispatch={dispatch} state={state} />}
						/>
						<Route
							path="/calender"
							element={<CalendarComponent onDatesSelected={onDatesSelected} />}
						/>
						<Route
							path="/sign-in"
							element={<SignIn state={state} dispatch={dispatch} />}
						/>
						<Route
							path="/sign-up"
							element={<SignUp state={state} dispatch={dispatch} />}
						/>
						<Route path="/list-of-homes" element={<HomeList state={state} />} />
						<Route path="/add-home" element={<AddHomeForm />} />
						<Route
							path="/details/:id"
							element={<DetailsComponent state={state} />}
						/>
					</Routes>
				</SafeAreaView>
			</NativeRouter>
		</AuthProvider>
	);
}
