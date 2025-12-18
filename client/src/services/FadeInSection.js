import React, { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, Image, Text, View } from "react-native";

export function FadeInSection(props) {
	const [isVisible, setVisible] = useState(false);
	const fadeAnim = useRef(new Animated.Value(0)).current;
	let scrollListener;
	let scrollEndListener;
	let handleScroll;
	const fadeIn = () => {
		Animated.timing(fadeAnim, {
			toValue: 1,
			duration: 1000,
			useNativeDriver: true,
		}).start();
	};

	useEffect(() => {
		scrollListener = Animated.event(
			[{ nativeEvent: { contentOffset: { y: fadeAnim } } }],
			{ useNativeDriver: false }
		);

		scrollEndListener = () => {
			if (isVisible) {
				fadeIn();
			}
		};

		return () => {
			// Clean up event listeners
		};
	}, [fadeAnim, isVisible]);

	return (
		<ScrollView
			onScroll={scrollListener}
			onScrollEndDrag={scrollEndListener}
			scrollEventThrottle={16}
			// Add other ScrollView props if needed
		>
			<Animated.View
				style={{
					opacity: fadeAnim,
					transform: [
						{
							translateY: fadeAnim.interpolate({
								inputRange: [0, 1],
								outputRange: [20, 0],
							}),
						},
					],
				}}
			>
				{props.children}
			</Animated.View>
		</ScrollView>
	);
}
