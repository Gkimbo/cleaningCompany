import { Dimensions, StyleSheet } from "react-native";

const { height, width } = Dimensions.get("screen");
const widthScreen = height * 0.3;

const UserFormStyles = StyleSheet.create({
  // === Containers ===
  container: {
    marginTop: 50,
    marginHorizontal: 15,
  },

  container2: {
	marginBottom: 140,
  },

  formSurround: {
    paddingLeft: "20%",
    paddingRight: "20%",
  },

  // === Inputs & Fields ===
  inputSurround: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 102, 204, 0.25)",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    padding: 8,
    marginBottom: 20,
    shadowColor: "#007aff",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginLeft:
      width > 1000 ? "25%" : width > 700 ? "20%" : width > 500 ? "10%" : "0.5%",
    marginRight:
      width > 1000 ? "25%" : width > 700 ? "20%" : width > 500 ? "10%" : "0.5%",
  },

  input: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#0a2540",
    shadowColor: "#007aff",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
    marginLeft:
      width > 1000 ? "20%" : width > 700 ? "15%" : width > 500 ? "10%" : "0.5%",
    marginRight:
      width > 1000 ? "20%" : width > 700 ? "15%" : width > 500 ? "10%" : "0.5%",
  },

  codeInput: {
    alignSelf: "center",
    borderWidth: 0,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 16,
    marginLeft: "19%",
    marginRight: "19%",
    width:
      width > 1000 ? "20%" : width > 700 ? "30%" : width > 500 ? "40%" : "80%",
    shadowColor: "#007aff",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  modeInput: {
    marginBottom: 30,
  },

  checkbox: {
    marginBottom: 16,
  },

  commuteContainer: {
    marginTop: 16,
  },

  // === Text & Titles ===
  title: {
    fontSize: width > 1000 ? 26 : width > 700 ? 22 : width > 500 ? 20 : 16,
    fontWeight: "700",
    marginBottom: 18,
    textAlign: "center",
    color: "#0a2540",
  },

  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
    color: "#1a3c6e",
  },

  smallTitle: {
    marginBottom: 6,
    textAlign: "center",
    color: "#007aff",
    fontWeight: "600",
    fontSize: width > 1000 ? 20 : width > 700 ? 18 : width > 500 ? 15 : 12,
  },

  // === Numeric Input (Miles etc.) ===
  milesContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  unitInput: {
    flex: 1,
    marginLeft: 8,
  },

  // === Buttons ===
  button: {
    alignSelf: "center",
    textAlign: "center",
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "rgba(0, 122, 255, 0.85)",
    width:
      width > 1000 ? "20%" : width > 700 ? "20%" : width > 500 ? "40%" : "80%",
    shadowColor: "#007aff",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },

  // === Status Messages ===
  error: {
    color: "#ff4d4f",
    fontSize: width > 500 ? 15 : 12,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 10,
    textAlign: "center",
    backgroundColor: "rgba(255, 77, 79, 0.1)",
    paddingVertical: 8,
    borderRadius: 8,
  },

  changeNotification: {
    color: "#28A745",
    fontSize: width > 500 ? 15 : 12,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 10,
    textAlign: "center",
    backgroundColor: "rgba(40,167,69,0.1)",
    paddingVertical: 8,
    borderRadius: 8,
  },

  // === Radio Buttons & Pickers ===
  radioButtonContainer: {
    alignSelf: "center",
    flexDirection: "row",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 122, 255, 0.3)",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    marginBottom: 20,
    marginLeft: "19%",
    marginRight: "19%",
    width:
      width > 1000 ? "25%" : width > 700 ? "30%" : width > 500 ? "40%" : "80%",
    shadowColor: "#007aff",
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  pickerContainer: {
    marginBottom: 20,
  },
});

export default UserFormStyles;
