import React, { useState, useEffect } from "react";
import { View, Text, Dimensions, Pressable } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import Review from "../../services/fetchRequests/ReviewClass";

const tempTestData = [
  {
    userId: 13,
    reviewerId: 12,
    appointmentId: 2,
    rating: 3.5,
    comment: "Was very thourgh but missed a few areas.",
  },
  {
    userId: 13,
    reviewerId: 7,
    appointmentId: 4,
    rating: 4,
    comment: "Great Job!",
  },
];

const ReviewsOverview = ({ state, dispatch }) => {
  const [allReviews, setAllReviews] = useState(tempTestData);
  const [redirect, setRedirect] = useState(false);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 16 : width < 800 ? 20 : 24;
  const navigate = useNavigate();

  useEffect(() => {
    if (state.currentUser.token) {
      Review.getReviews(state.currentUser.token).then((response) => {
        console.log(response);
        // setAllReviews(response.reviews);
      });
    }
    if (redirect) {
      navigate("/all-reviews");
      setRedirect(false);
    }
  }, [redirect]);

  const handlePress = () => {
    setRedirect(true);
  };

  const getAverageRating = () => {
    if (allReviews.length === 0) return 0;
    const totalRating = allReviews.reduce(
      (sum, review) => sum + review.rating,
      0
    );
    return totalRating / allReviews.length;
  };

  const averageRating = getAverageRating();
  const roundedRating = Math.round(averageRating * 2) / 2;

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(
          <Icon key={i} name="star" size={iconSize} color="#FFD700" />
        );
      } else if (i - 0.5 === roundedRating) {
        stars.push(
          <Icon key={i} name="star-half-full" size={iconSize} color="#FFD700" />
        );
      } else {
        stars.push(
          <Icon key={i} name="star-o" size={iconSize} color="#cccccc" />
        );
      }
    }
    return stars;
  };

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {allReviews.length === 0 ? (
        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {[...Array(5)].map((_, index) => (
              <Icon key={index} name="star" size={iconSize} color="#cccccc" />
            ))}
          </View>
          <Text style={{ textAlign: "center", color: "#666", fontSize: 14 }}>
            You have no reviews yet. Please complete cleanings to get reviews
            and improve your status with cleaners.
          </Text>
        </View>
      ) : (
        <View style={{ alignItems: "center", paddingHorizontal: 16 }}>
          {/* Section Title */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "bold",
              color: "#333",
              marginBottom: 4,
            }}
          >
            Your Average Rating
          </Text>

          <Pressable onPress={handlePress}>
            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              {renderStars()}
            </View>
          </Pressable>

          <Text
            style={{
              fontSize: 16,
              fontWeight: "bold",
              color: "#333",
              marginBottom: 4,
            }}
          >
            {averageRating.toFixed(1)} / 5.0 ({allReviews.length} Reviews)
          </Text>

          <Text
            style={{
              textAlign: "center",
              color: "#666",
              fontSize: 14,
              lineHeight: 20,
            }}
          >
            Your rating is based on feedback from past cleanings. A higher
            rating helps you build trust with homeowners and get more cleaning
            requests. Keep up the great work!
          </Text>
        </View>
      )}
    </View>
  );
};

export default ReviewsOverview;
