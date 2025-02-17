import React from "react";
import { Pressable, Text, View, Animated } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import homePageStyles from "../../services/styles/HomePageStyles";

const ReviewTile = ({
  id,
  userId,
  reviewerId,
  appointmentId,
  rating,
  comment,
  createdAt,
}) => {
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
    }).start();
    // () => navigate(`/review/${id}`)
  };

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
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ marginBottom: 12 }}
    >
      <Animated.View
        style={[
          homePageStyles.appointmentListContainer,
          styles.tile,
          { transform: [{ scale: animatedScale }] },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.reviewerText}>Reviewer: {reviewerId}</Text>
          <Text style={styles.dateText}>
            {createdAt ? createdAt : "Date not available"}
          </Text>
        </View>

        <View style={styles.ratingContainer}>
          <View style={styles.starsRow}>{renderStars()}</View>
          <Text style={styles.ratingText}>{rating.toFixed(1)} / 5.0</Text>
        </View>

        <Text style={styles.commentText}>{comment}</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Appointment ID: {appointmentId}</Text>
          <Text style={styles.tapText}>Tap to see more</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = {
  tile: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  reviewerText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
  },
  dateText: {
    fontSize: 12,
    color: "#777",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  starsRow: {
    flexDirection: "row",
  },
  commentText: {
    fontSize: 14,
    color: "#555",
    fontStyle: "italic",
    marginBottom: 10,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 6,
    marginTop: 6,
  },
  footerText: {
    fontSize: 12,
    color: "#888",
  },
  tapText: {
    fontSize: 12,
    color: "#007BFF",
    fontWeight: "bold",
  },
};

export default ReviewTile;
