import { useTheme } from "@react-navigation/native";
import {
	Image,
	KeyboardAvoidingView,
	ScrollView,
	Text,
	Pressable,
	View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import Icon from "react-native-vector-icons/FontAwesome";
import { useNavigate } from "react-router-native";

import formStyles from "../../services/styles/FormStyle";
import LandingPageStyles from "../../services/styles/LandingPageStyle";
import SignInForm from "./forms/SignInForm";

// const logoImage = require("../../assets/landing-photo.png");

const SignIn = ({ state, dispatch }) => {
	const { colors } = useTheme();
	const navigate = useNavigate();

	const handlePress = () => {
		navigate("/sign-up");
	};

	return (
		<KeyboardAvoidingView
			style={LandingPageStyles.container}
			behavior="padding"
		>
			{/* <Image source={logoImage} style={LandingPageStyles.logo} /> */}
			<View style={LandingPageStyles.header}>
				<Animatable.View
					style={[
						LandingPageStyles.footer,
						{
							backgroundColor: colors.background,
						},
					]}
					animation="fadeInUpBig"
				>
					<Text
						style={[
							LandingPageStyles.title,
							{
								color: colors.text,
							},
						]}
					>
						Sign In Here!
					</Text>
					<ScrollView contentContainerStyle={formStyles.container}>
						<SignInForm state={state} dispatch={dispatch} />
						<Text
							style={LandingPageStyles.text}
						>{`Don't have and account?`}</Text>
						<Pressable onPress={handlePress}>
							<View style={LandingPageStyles.buttonContainer}>
								<Text style={LandingPageStyles.textSign}>Sign Up Here</Text>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										marginLeft: 10,
									}}
								>
									<Icon
										name="arrow-right"
										size={20}
										color="black"
										style={{ marginRight: 10 }}
									/>
								</View>
							</View>
						</Pressable>
					</ScrollView>
				</Animatable.View>
			</View>
		</KeyboardAvoidingView>
	);
};

export default SignIn;
