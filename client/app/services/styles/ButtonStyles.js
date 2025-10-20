import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const ButtonStyles = StyleSheet.create({
    glassButton: {
        marginTop: 10,
        backgroundColor: "rgba(255, 255, 255, 0.64)",
        borderRadius: 50,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.3)",
        shadowColor: "#00BFFF",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 4,
      },
      buttonText: {
        color: "rgba(0, 0, 0, 0.5)",
        fontWeight: "600",
        fontSize: 16,
      },
})

export default ButtonStyles