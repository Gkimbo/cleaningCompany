import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import homePageStyles from "../../services/styles/HomePageStyles";
import ReviewTileStyles from "../../services/styles/ReviewTileStyles";

const ReviewTile = ({
  id,
  userId,
  reviewerId,
  appointmentId,
  rating,
  comment,
  createdAt,
}) => {
  const formatDate = (createdAt) => {
    const date = new Date(createdAt);
    const options = { day: "numeric", month: "long", year: "numeric" };
    return date.toLocaleDateString("en-GB", options);
  };

  const date = createdAt ? formatDate(createdAt) : null;

  const renderStars = () => {
    const stars = [];
    const roundedRating = Math.round(rating * 2) / 2;

    for (let i = 1; i <= 5; i++) {
      if (i <= roundedRating) {
        stars.push(<Icon key={i} name="star" size={18} color="#FFD700" />);
      } else if (i - 0.5 === roundedRating) {
        stars.push(
          <Icon key={i} name="star-half-full" size={18} color="#FFD700" />
        );
      } else {
        stars.push(<Icon key={i} name="star-o" size={18} color="#cccccc" />);
      }
    }
    return stars;
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={[
          homePageStyles.appointmentListContainer,
          ReviewTileStyles.tile,
        ]}
      >
        <View style={ReviewTileStyles.header}>
          <Text style={ReviewTileStyles.reviewerText}>
            {/* Reviewer: {reviewerId} */}
          </Text>
          <Text style={ReviewTileStyles.dateText}>
            {date ? date : "Date not available"}
          </Text>
        </View>

        <View style={ReviewTileStyles.ratingContainer}>
          <View style={ReviewTileStyles.starsRow}>{renderStars()}</View>
          <Text style={ReviewTileStyles.ratingText}>
            {rating.toFixed(1)} / 5.0
          </Text>
        </View>

        <Text style={ReviewTileStyles.commentText}>{comment}</Text>

        <View style={ReviewTileStyles.footer}>
          <Text style={ReviewTileStyles.footerText}>
            {/* Appointment ID: {appointmentId} */}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default ReviewTile;
