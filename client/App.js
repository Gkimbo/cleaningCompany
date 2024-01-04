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
import appStyles from "./services/styles/AppStyle";

export default function App() {
	const [isLoading, setIsLoading] = useState(true);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [lastLoginTimestamp, setLastLoginTimestamp] = useState("0");
	const [state, dispatch] = useReducer(reducer, {
		currentUser: { token: null },
	});
	const onDatesSelected = (event) => {
		event.preventDefault();
		console.log(event);
	};

	const fetchCurrentUser = async () => {
		try {
			const user = await getCurrentUser();
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
						<Route path="/" element={<HomePage />} />
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
					</Routes>
				</SafeAreaView>
			</NativeRouter>
		</AuthProvider>
	);
}
