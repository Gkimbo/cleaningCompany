import { Dimensions, StyleSheet } from "react-native";
const { width } = Dimensions.get("window");

const homePageStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "flex-start",
    marginTop:
      width > 600
        ? "10%"
        : width > 540
          ? "15%"
          : width > 440
            ? "20%"
            : width > 340
              ? "25%"
              : "30%",
    paddingHorizontal: 16,
    backgroundColor: "#f0f4f8",
  },

  // Titles
  title: {
    alignSelf: "center",
    fontSize: width < 400 ? 16 : width < 800 ? 20 : 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1e3a8a",
  },
  smallTitle: {
    alignSelf: "center",
    fontSize: width < 400 ? 14 : width < 800 ? 18 : 20,
    fontWeight: "600",
    marginBottom: 12,
    color: "#1e40af",
  },

  // Home tiles
  homeTileContainer: {
    alignSelf: "center",
    marginVertical: 14,
    paddingVertical: 28, // increased vertical padding for longer tiles
    paddingHorizontal: 20,
    backgroundColor: "rgba(58, 141, 255, 0.15)",
    borderRadius: 22,
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    width:
      width > 1000 ? "48%" : width > 700 ? "78%" : width > 500 ? "88%" : "95%",
    borderWidth: 1,
    borderColor: "rgba(58, 141, 255, 0.3)",
    minHeight: 260, // 👈 ensures a longer tile, even with less content
    justifyContent: "space-between",
  },
  
  homeTileTitle: {
    fontSize: width < 400 ? 16 : width < 800 ? 20 : 22,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 6,
  },
  homeTileAddress: {
    fontSize: width < 400 ? 12 : width < 800 ? 14 : 16,
    color: "#334155",
    marginBottom: 8,
  },

  // Add Home button
  AddHomeButton: {
    alignSelf: "center",
    backgroundColor: "rgba(58, 141, 255, 0.3)", // glass effect
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    marginVertical: 16,
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  AddHomeButtonText: {
    fontSize: width < 400 ? 12 : width < 800 ? 16 : 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.15)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Back button
  backButtonForm: {
    backgroundColor: "rgba(58, 141, 255, 0.25)",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(58, 141, 255, 0.4)",
    minWidth: width > 800 ? 200 : width > 500 ? 160 : 140,
  },
  backButtonContainerList: {
    width: width > 800 ? "10%" : width > 600 ? "15%" : "25%",
    marginLeft: "10%",
    marginVertical: 12,
  },

  // Text inside buttons
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: width < 400 ? 14 : width < 800 ? 16 : 18,
    textAlign: "center",
  },

  bookButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: "rgba(58, 141, 255, 0.15)", // same glassy blue tone
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(58, 141, 255, 0.35)", // subtle blue border
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  appointmentCard: {
    alignSelf: "center",
    marginVertical: 10,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.85)", // frosted glass look
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(58, 141, 255, 0.35)", // soft blue border
    shadowColor: "#3a8dff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    width: "94%",
  },
  
  appointmentCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  
  appointmentDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  
  appointmentPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#3a8dff",
  },
  
  appointmentStatus: {
    fontSize: 14,
    color: "#1e3a8a",
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
  
  appointmentStatusComplete: {
    fontSize: 14,
    color: "#16a34a",
    textAlign: "center",
    fontWeight: "600",
  },
  
  appointmentContact: {
    fontSize: 13,
    color: "#334155",
    marginBottom: 6,
  },
  
  
});

export default homePageStyles;
