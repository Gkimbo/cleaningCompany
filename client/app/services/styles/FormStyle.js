import { Dimensions, StyleSheet } from "react-native";

const { height, width } = Dimensions.get("screen");
const widthScreen = width * 0.9; // make it responsive

const UserFormStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "rgba(240, 248, 255, 0.6)", // translucent blue background
    borderRadius: 20,
    backdropFilter: "blur(10px)", // iOS effect (ignored on Android, but good fallback)
  },

  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0a2540",
    textAlign: "center",
    marginBottom: 25,
  },

  smallTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a3c6e",
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    height: 48,
    width: widthScreen,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderColor: "rgba(0, 102, 204, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#0a2540",
    marginBottom: 10,
    shadowColor: "#0077ff",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  codeInput: {
    height: 48,
    width: widthScreen,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderColor: "rgba(0, 102, 204, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#0a2540",
    marginBottom: 10,
  },

  radioButtonContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  button: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
    backgroundColor: "rgba(0, 122, 255, 0.8)",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 25,
    width: widthScreen,
    alignSelf: "center",
    textShadowColor: "rgba(255, 255, 255, 0.3)",
    textShadowRadius: 8,
    overflow: "hidden",
    shadowColor: "#0077ff",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },

  inputSurround: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 102, 204, 0.25)",
    width: widthScreen,
  },

  error: {
    color: "#ff4d4f",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    backgroundColor: "rgba(255, 77, 79, 0.1)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 79, 0.2)",
  },
});

export default UserFormStyles;
