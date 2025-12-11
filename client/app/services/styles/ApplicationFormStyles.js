import { Dimensions, StyleSheet } from "react-native";

const { height } = Dimensions.get("screen");

const widthScreen = height * 0.3;

const ApplicationFormStyles = StyleSheet.create({
  container: {
    marginTop: "20%",
    padding: 20,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#555",
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 15,
    borderRadius: 4,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  thankYouContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  thankYouMessage: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
  },
  errorContainer: {
    backgroundColor: "#f8d7da",
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
  },
  errorText: {
    color: "#721c24",
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: "rgba(30, 144, 255, 0.8)",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 5,
    marginBottom: 10,
  },
  uploadButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  idPreview: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    marginVertical: 10,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 6,
    borderRadius: 6,
  },
  
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#000",
    marginRight: 10,
    backgroundColor: "#fff",
  },
  
  checkboxChecked: {
    backgroundColor: "#22c55e", // ✅ visibly checked
    borderColor: "#22c55e",
  },
  
  checkboxLabel: {
    color: "#000",
    fontSize: 14,
    fontWeight: "500",
  },
  
});
export default ApplicationFormStyles;
