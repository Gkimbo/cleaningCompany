import { Dimensions, Platform, StyleSheet } from "react-native";

const { height, width } = Dimensions.get("window");

const UserFormStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: width > 800 ? 60 : 20, // more padding on larger screens
    backgroundColor: "rgba(240, 248, 255, 0.6)",
    borderRadius: 20,
    alignSelf: "center",
    width: width > 1000 ? "60%" : width > 600 ? "85%" : "95%", // responsive form width
    maxWidth: 700, // cap width for desktop/tablet
    minHeight: height * 0.7, // fill enough vertical space
  },

  title: {
    fontSize: width < 400 ? 20 : width < 800 ? 24 : 28,
    fontWeight: "700",
    color: "#0a2540",
    textAlign: "center",
    marginBottom: 25,
  },

  smallTitle: {
    fontSize: width < 400 ? 14 : 16,
    fontWeight: "600",
    color: "#1a3c6e",
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    height: 48,
    width: "100%", // take full available space within container
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderColor: "rgba(0, 102, 204, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: width < 400 ? 14 : 16,
    color: "#0a2540",
    marginBottom: 12,
    shadowColor: "#0077ff",
    shadowOpacity: Platform.OS === "web" ? 0.15 : 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  codeInput: {
    height: 48,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderColor: "rgba(0, 102, 204, 0.3)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: width < 400 ? 14 : 16,
    color: "#0a2540",
    marginBottom: 10,
  },

  radioButtonContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginVertical: 10,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "web" ? 0.1 : 0.15,
    shadowRadius: 4,
    elevation: 2,
    alignSelf: "stretch",
    width: "100%",
  },

  button: {
    textAlign: "center",
    color: "#fff",
    fontWeight: "700",
    fontSize: width < 400 ? 16 : 18,
    backgroundColor: "rgba(0, 122, 255, 0.85)",
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 25,
    width: "100%",
    alignSelf: "center",
    textShadowColor: "rgba(255, 255, 255, 0.3)",
    textShadowRadius: 8,
    overflow: "hidden",
    shadowColor: "#0077ff",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },

  inputSurround: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 102, 204, 0.25)",
    width: "100%",
  },

  error: {
    color: "#ff4d4f",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    backgroundColor: "rgba(255, 77, 79, 0.08)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 79, 0.25)",
    alignSelf: "stretch",
    width: "100%",
  },
});

export default UserFormStyles;
