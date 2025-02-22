import React, { useState, useEffect } from "react";
import { Pressable, View, Text, ScrollView, Dimensions } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles"
import ReviewTile from "./ReviewTile";
import Review from "../../services/fetchRequests/ReviewClass";

// const tempTestData = [
//   {
//     id: 1,
//     userId: 13,
//     reviewerId: 12,
//     appointmentId: 2,
//     rating: 3.5,
//     comment: "Was very thourgh but missed a few areas.",
//     createdAt: "2025-02-10T13:55:35.940Z"
//   },
//   {
//     id: 2,
//     userId: 13,
//     reviewerId: 7,
//     appointmentId: 4,
//     rating: 4,
//     comment: "Great Job!",
//     createdAt: "2025-02-16T13:55:35.940Z"
//   },
// ];

const AllReviewsList = ({ state, dispatch }) => {
  const [allReviews, setAllReviews] = useState([]);
  const [backRedirect, setBackRedirect] = useState(false);
  const [userId, setUserId] = useState(null);
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 12 : width < 800 ? 16 : 20;
  const navigate = useNavigate();

  const fetchReviews = async () => {
    if (state.currentUser.token) {
      const response = await Review.getReviews(state.currentUser.token);
        setAllReviews(response.reviews);
    }
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


  useEffect(() => {
    fetchReviews();
    if (backRedirect) {
      navigate("/");
      setBackRedirect(false);
    }
  }, [backRedirect]);

  const handleBackPress = () => {
    setBackRedirect(true);
  };

  const sortedReviews = allReviews.sort((a, b) => {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const displayReviews = sortedReviews.map((review) => {
    return (
      <View key={review.id}>
        <ReviewTile
          id={review.id}
          userId={review.userId}
          reviewerId={review.reviewerId}
          appointmentId={review.appointmentId}
          rating={review.rating}
          comment={review.comment}
          createdAt={review.createdAt}
        />
      </View>
    );
  });

  return (
    <View
      style={{
        ...homePageStyles.container,
        flexDirection: "column",
        marginTop: 0
      }}
    >
         <View style={{ alignItems: "center", paddingHorizontal: 16 , marginBottom: "20%"}}>
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
          
            <View style={{ flexDirection: "row", marginBottom: 4 }}>
              {renderStars()}
            </View>

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
        </View>
      <View style={homePageStyles.backButtonAllReviewsList}>
        <Pressable
          style={homePageStyles.backButtonForm}
          onPress={handleBackPress}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 10,
            }}
          >
            <Icon name="angle-left" size={iconSize} color="black" />
            <View style={{ marginLeft: 15 }}>
              <Text style={topBarStyles.buttonTextSchedule}>Back</Text>
            </View>
          </View>
        </Pressable>
      </View>
      {displayReviews}
    </View>
  );
};

export default AllReviewsList;
