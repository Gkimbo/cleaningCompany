import { useTheme } from "@react-navigation/native";
import {
	KeyboardAvoidingView,
	ScrollView,
	Text,
	Pressable,
	View,
	Platform,
} from "react-native";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";

import LandingPageStyles from "../../services/styles/LandingPageStyle";
import SignInForm from "./forms/SignInForm";

const SignIn = ({ state, dispatch }) => {
	const { colors } = useTheme();
	const navigate = useNavigate();

	const handlePress = () => {
		navigate("/sign-up");
	};

	return (
		<KeyboardAvoidingView
			style={LandingPageStyles.authContainer}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
		>
			<ScrollView
				contentContainerStyle={LandingPageStyles.authScrollContent}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Animatable.View
					style={LandingPageStyles.authCard}
					animation="fadeInUp"
					duration={600}
				>
					<Text style={LandingPageStyles.authTitle}>Welcome Back</Text>
					<Text style={LandingPageStyles.authSubtitle}>
						Sign in to your account
					</Text>

					<SignInForm state={state} dispatch={dispatch} />

					<View style={LandingPageStyles.authFooter}>
						<Text style={LandingPageStyles.authFooterText}>
							Don't have an account?
						</Text>
						<Pressable onPress={handlePress}>
							<View style={LandingPageStyles.authLinkButton}>
								<Text style={LandingPageStyles.authLinkText}>Sign Up</Text>
								<Icon
									name="arrow-right"
									size={14}
									color="#0d9488"
									style={{ marginLeft: 6 }}
								/>
							</View>
						</Pressable>
					</View>
				</Animatable.View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

export default SignIn;
