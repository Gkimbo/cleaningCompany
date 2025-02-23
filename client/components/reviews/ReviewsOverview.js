import React, { useState, useEffect } from "react";
import { View, Text, Dimensions, Pressable, Animated } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import Review from "../../services/fetchRequests/ReviewClass";
import RatingsStyles from "../../services/styles/RatingsStyles";

const ReviewsOverview = ({ state, dispatch }) => {
  const [allReviews, setAllReviews] = useState([]);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 16 : width < 800 ? 20 : 24;
  const navigate = useNavigate();

  const animatedScale = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start(() => navigate(`/all-reviews`));
  };

  useEffect(() => {
    if (state.currentUser.token) {
      Review.getReviews(state.currentUser.token).then((response) => {
        setAllReviews(response.reviews);
      });
    }
  }, []);

  const getAverageRating = () => {
    if (allReviews.length === 0) return 0;
    const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0);
    return totalRating / allReviews.length;
  };

  const averageRating = getAverageRating();
  const roundedRating = Math.round(averageRating * 2) / 2;

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(<Icon key={i} name="star" size={iconSize} color="#FFD700" />);
      } else if (i - 0.5 === roundedRating) {
        stars.push(<Icon key={i} name="star-half-full" size={iconSize} color="#FFD700" />);
      } else {
        stars.push(<Icon key={i} name="star-o" size={iconSize} color="#cccccc" />);
      }
    }
    return stars;
  };

  return (
    <View style={RatingsStyles.container}>
      {allReviews.length === 0 ? (
        <View style={RatingsStyles.centeredContent}>
          <View style={RatingsStyles.starRow}>{[...Array(5)].map((_, index) => <Icon key={index} name="star" size={iconSize} color="#cccccc" />)}</View>
          <Text style={RatingsStyles.messageText}>
            You have no reviews yet. Please complete cleanings to get reviews and improve your status with cleaners.
          </Text>
        </View>
      ) : (
        <View style={RatingsStyles.centeredContent}>
          <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View style={[RatingsStyles.tile, { transform: [{ scale: animatedScale }] }]}> 
              <Text style={RatingsStyles.headerText}>Your Average Rating</Text>
              <View style={RatingsStyles.starRow}>{renderStars()}</View>
              <Text style={RatingsStyles.ratingText}>{averageRating.toFixed(1)} / 5.0 ({allReviews.length} Reviews)</Text>
              <Text style={RatingsStyles.descriptionText}>
                Your rating is based on feedback from past cleanings. A higher rating helps you build trust with homeowners and get more cleaning requests. Keep up the great work!
              </Text>
              <Text style={RatingsStyles.tapText}>Tap to see more reviews</Text>
            </Animated.View>
          </Pressable>
        </View>
      )}
    </View>
  );
};



export default ReviewsOverview;

