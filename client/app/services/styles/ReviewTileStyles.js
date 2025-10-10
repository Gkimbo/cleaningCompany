import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const ReviewTileStyles = StyleSheet.create({
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
})

export default ReviewTileStyles