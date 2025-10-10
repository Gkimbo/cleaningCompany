import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const RatingsStyles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 16,
        
      },
      centeredContent: {
        alignItems: "center",
        justifyContent: "center",
        marginTop: 30,
      },
      tile: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        alignItems: "center",
        justifyContent: "center",
      },
      starRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 8,
      },
      headerText: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
        textAlign: "center",
      },
      ratingText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
        textAlign: "center",
      },
      descriptionText: {
        textAlign: "center",
        color: "#666",
        fontSize: 14,
        lineHeight: 20,
      },
      messageText: {
        textAlign: "center",
        color: "#666",
        fontSize: 14,
      },
      tapText: {
        fontSize: 12,
        color: "#007BFF",
        fontWeight: "bold",
        textAlign: "center",
      },
})

export default RatingsStyles