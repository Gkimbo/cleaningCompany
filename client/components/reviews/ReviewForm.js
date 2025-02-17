import React, { useState, useEffect, useContext } from "react";
import { ScrollView, Text, Pressable, View, Slider } from "react-native";
import { useNavigate } from "react-router-native";
import { TextInput } from "react-native-paper";
import formStyles from "../../services/styles/FormStyle";
import { AuthContext } from "../../../services/AuthContext";
import Review from "../../services/fetchRequests/ReviewClass";

const ReviewForm = ({userId, reviewerId, appointmentId}) => {
    const [rating, setRating] = useState(3)
    const [comment, setComment] = useState("")
	const [redirect, setRedirect] = useState(false);
	const [errors, setErrors] = useState([]);
	const navigate = useNavigate();
	const { login } = useContext(AuthContext);


	const onSubmit = async () => {
			const data = {
				userId, 
                reviewerId, 
                appointmentId, 
                rating, 
                comment
			};
			const response = await Review.addReviewToDb(data);
			if (
				response === "An account already has this email" ||
				response === "Username already exists"
			) {
				setErrors([response]);
			} else {
				setRedirect(true);
			}
	};

	useEffect(() => {
		if (redirect) {
			navigate("/");
		}
	}, [redirect]);

	return (
		<View style={formStyles.container}>
			{errors.length > 0 && (
				<View style={formStyles.errorContainer}>
					{errors.map((error, index) => (
						<Text key={index} style={formStyles.errorText}>
							{error}
						</Text>
					))}
				</View>
			)}

			<Text style={formStyles.label}>Rating: {rating} ★</Text>
			<Slider
				style={{ width: 200, height: 40 }}
				minimumValue={1}
				maximumValue={5}
				step={0.5}
				value={rating}
				onValueChange={setRating}
			/>

			<TextInput
				mode="outlined"
				placeholder="Comments"
				style={formStyles.input}
				value={comment}
				onChangeText={setComment}
			/>

			<Pressable onPress={() => onSubmit(rating)}>
				<Text style={formStyles.button}>Submit</Text>
			</Pressable>
		</View>
	);
};

export default ReviewForm;