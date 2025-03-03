import React, { useState } from "react";
import { Pressable, Text, View, LayoutAnimation, Dimensions, Animated } from "react-native";
import { useNavigate } from "react-router-native";
import { StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import RatingsStyles from "../../../services/styles/RatingsStyles";

const EmployeeTile = ({
  id,
  username,
  reviews,
  approveRequest,
  denyRequest,
}) => {
  const { width } = Dimensions.get("window");
  const iconSize = width < 400 ? 16 : width < 800 ? 20 : 24;
  const animatedScale = new Animated.Value(1);
  const navigate = useNavigate();

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
    }).start(() => navigate(`/all-cleaner-reviews/${id}`));
  };

  const getAverageRating = () => {
    if (reviews.length === 0) return 0;
    const totalRating = reviews.reduce((sum, review) => sum + review.review, 0);
    return totalRating / reviews.length;
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
console.log(reviews)
  return (
    <View style={styles.homeTileContainer}>
      <Text style={styles.appointmentPrice}>{username}</Text>
      <View style={RatingsStyles.container}>
        {reviews.length === 0 ? (
          <View style={RatingsStyles.centeredContent}>
            <View style={RatingsStyles.starRow}>
              {[...Array(5)].map((_, index) => (
                <Icon key={index} name="star" size={iconSize} color="#cccccc" />
              ))}
            </View>
            <Text style={RatingsStyles.messageText}>
              Cleaner does not have any reviews yet.
            </Text>
          </View>
        ) : (
          <View style={RatingsStyles.centeredContent}>
            <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
              <Animated.View
                style={[
                  RatingsStyles.tile,
                  { transform: [{ scale: animatedScale }] },
                ]}
              >
                <Text style={RatingsStyles.headerText}>Average Rating</Text>
                <View style={RatingsStyles.starRow}>{renderStars()}</View>
                <Text style={RatingsStyles.ratingText}>
                  {averageRating.toFixed(1)} / 5.0 ({reviews.length} Reviews)
                </Text>
                <Text style={RatingsStyles.descriptionText}>
                  This rating is based on feedback from past cleanings.
                </Text>
                <Text style={RatingsStyles.tapText}>
                  Tap to see all reviews for this cleaner
                </Text>
              </Animated.View>
            </Pressable>
          </View>
        )}
      </View>
      <Pressable
        style={[styles.button, { backgroundColor: "green" }]}
        onPress={() => approveRequest(cleanerId, id)}
      >
        <Text style={styles.buttonText}>Approve Cleaner!</Text>
      </Pressable>
      <Pressable
        style={[styles.button, { backgroundColor: "#E74C3C" }]}
        onPress={() => denyRequest(cleanerId, id)}
      >
        <Text style={styles.buttonText}>Deny Cleaner!</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  homeTileContainer: {
    backgroundColor: "#ffffff",
    padding: 20,
    marginVertical: 12,
    borderRadius: 12,
    shadowColor: "#2C3E50",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  appointmentDate: {
    fontSize: 18,
    fontWeight: "700",
    color: "#34495E",
    marginBottom: 8,
    textAlign: "center",
  },
  appointmentPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#7F8C8D",
    textAlign: "center",
  },
  distanceContainer: {
    marginVertical: 12,
  },
  distanceText: {
    fontSize: 12,
    color: "#7F8C8D",
    marginBottom: 4,
  },
  distanceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2C3E50",
  },
  distanceKm: {
    fontSize: 14,
    color: "#7F8C8D",
  },
  addressInfo: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 6,
  },
  unknownDistance: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
  },
  appointmentDetails: {
    fontSize: 16,
    fontWeight: "600",
    color: "#34495E",
    marginTop: 6,
  },
  largeHomeMessage: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#E74C3C",
    marginTop: 12,
  },
  smallHomeMessage: {
    fontSize: 14,
    color: "#7F8C8D",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});

export default EmployeeTile;
