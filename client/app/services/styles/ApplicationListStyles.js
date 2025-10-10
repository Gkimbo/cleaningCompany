import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const ApplicationListStyles = StyleSheet.create({
    container: {
        marginTop: "30%",
      },
      header: {
        fontSize: 22,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 15,
      },
      card: {
        backgroundColor: "#f8f9fa",
        padding: 15,
        marginVertical: 8,
        borderRadius: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      name: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 5,
      },
      label: {
        fontSize: 14,
        fontWeight: "600",
        marginTop: 4,
      },
      value: {
        fontWeight: "400",
      },
      message: {
        marginTop: 4,
        fontStyle: "italic",
        color: "#555",
      },
      noData: {
        textAlign: "center",
        fontSize: 16,
        color: "#888",
      },
})

export default ApplicationListStyles