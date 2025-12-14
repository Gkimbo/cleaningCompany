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
import SignUpForm from "./forms/SignUpForm";

const SignUp = ({ state, dispatch }) => {
	const { colors } = useTheme();
	const navigate = useNavigate();

	const handlePress = () => {
		navigate("/sign-in");
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
					<Text style={LandingPageStyles.authTitle}>Create Account</Text>
					<Text style={LandingPageStyles.authSubtitle}>
						Sign up to get started
					</Text>

					<SignUpForm state={state} dispatch={dispatch} />

					<View style={LandingPageStyles.authFooter}>
						<Text style={LandingPageStyles.authFooterText}>
							Already have an account?
						</Text>
						<Pressable onPress={handlePress}>
							<View style={LandingPageStyles.authLinkButton}>
								<Text style={LandingPageStyles.authLinkText}>Sign In</Text>
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

export default SignUp;
