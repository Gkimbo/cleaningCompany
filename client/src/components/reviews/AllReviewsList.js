import React, { useState, useEffect, useMemo } from "react";
import { Pressable, View, Text, Dimensions, Picker } from "react-native";
import { useNavigate } from "react-router-native";
import homePageStyles from "../../services/styles/HomePageStyles";
import Icon from "react-native-vector-icons/FontAwesome";
import topBarStyles from "../../services/styles/TopBarStyles";
import ReviewTile from "./ReviewTile";
import Review from "../../services/fetchRequests/ReviewClass";

const AllReviewsList = ({ state, dispatch }) => {
  const [allReviews, setAllReviews] = useState([]);
  const [backRedirect, setBackRedirect] = useState(false);
  const [sortOption, setSortOption] = useState("dateNewest");
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
      (sum, review) => sum + review.review,
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

  const sortedReviews = useMemo(() => {
    let sorted = [...allReviews];

    if (sortOption === "dateNewest") {
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortOption === "dateOldest") {
      sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortOption === "highestRating") {
      sorted.sort((a, b) => b.review - a.review);
    } else if (sortOption === "lowestRating") {
      sorted.sort((a, b) => a.review - b.review);
    }

    return sorted;
  }, [allReviews, sortOption]);

  const displayReviews = sortedReviews.map((review) => {
    return (
      <View key={review.id}>
        <ReviewTile
          id={review.id}
          userId={review.userId}
          reviewerId={review.reviewerId}
          appointmentId={review.appointmentId}
          rating={review.review}
          comment={review.reviewComment}
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
        marginTop: "30%",
      }}
    >
      <View
        style={{
          alignItems: "center",
          paddingHorizontal: 16,
          marginBottom: "10%",
        }}
      >
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
      <View
        style={{
          margin: 5,
          borderWidth: 1,
          borderRadius: 5,
          borderColor: "#ccc",
        }}
      >
        <Picker
          selectedValue={sortOption}
          onValueChange={(itemValue) => setSortOption(itemValue)}
        >
          <Picker.Item label="Sort by: Date (Newest)" value="dateNewest" />
          <Picker.Item label="Sort by: Date (Oldest)" value="dateOldest" />
          <Picker.Item
            label="Sort by: Rating (Low to High)"
            value="lowestRating"
          />
          <Picker.Item
            label="Sort by: Rating (High to Low)"
            value="highestRating"
          />
        </Picker>
      </View>
      {displayReviews}
    </View>
  );
};

export default AllReviewsList;
