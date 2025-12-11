import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import React, { useRef, useState } from "react";
import { Alert, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

const ApplicationTile = ({
  id,
  firstName,
  lastName,
  email,
  phone,
  experience,
  message,
  idPhoto,
  backgroundConsent,
  deleteConfirmation,
  handleDeletePress,
  handleNoPress,
  CreateNewEmployeeForm,
  setApplicationsList,
}) => {
  const [formVisible, setFormVisible] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const animatedWidth = useRef(new Animated.Value(120)).current;
  const animatedHeight = useRef(new Animated.Value(80)).current;

  const handleAccept = () => setFormVisible(!formVisible);

  const handlePhotoPress = () => {
    const toWidth = photoExpanded ? 120 : 300;
    const toHeight = photoExpanded ? 80 : 200;

    Animated.timing(animatedWidth, {
      toValue: toWidth,
      duration: 300,
      useNativeDriver: false,
    }).start();

    Animated.timing(animatedHeight, {
      toValue: toHeight,
      duration: 300,
      useNativeDriver: false,
    }).start();

    setPhotoExpanded(!photoExpanded);
  };

  const handleLongPress = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "We need access to your photos.");
        return;
      }

      const filename = idPhoto.split("/").pop();
      const dest = FileSystem.cacheDirectory + filename;

      await FileSystem.copyAsync({ from: idPhoto, to: dest });

      const asset = await MediaLibrary.createAssetAsync(dest);
      await MediaLibrary.createAlbumAsync("Kleanr IDs", asset, false);

      Alert.alert("Saved!", "ID photo saved to your gallery.");
    } catch (error) {
      console.error("Error saving photo:", error);
      Alert.alert("Error", "Could not save photo.");
    }
  };

  return (
    <View style={styles.card}>
      {/* --- Top Action Row --- */}
      <View
        style={{
          flexDirection: deleteConfirmation[id] ? "column" : "row",
          alignItems: "center",
          justifyContent: deleteConfirmation[id] ? "center" : "space-between",
          marginBottom: deleteConfirmation[id] ? 10 : 0,
          gap: deleteConfirmation[id] ? 10 : 0,
        }}
      >
        <Pressable onPress={() => handleDeletePress(id)}>
          <Animated.View
            style={[
              styles.actionButton,
              {
                backgroundColor: deleteConfirmation[id] ? "#ff4d4f" : "#dc3545",
                width: deleteConfirmation[id] ? 160 : 35,
                height: 35,
              },
            ]}
          >
            <Text style={styles.actionButtonText}>
              {deleteConfirmation[id] ? "Delete Application" : "X"}
            </Text>
          </Animated.View>
        </Pressable>

        {deleteConfirmation[id] && (
          <Pressable onPress={() => handleNoPress(id)}>
            <View style={[styles.actionButton, styles.keepButton]}>
              <Text style={styles.actionButtonText}>Keep Application</Text>
            </View>
          </Pressable>
        )}

        {!deleteConfirmation[id] && (
          <Pressable onPress={handleAccept}>
            <View style={[styles.actionButton, styles.addButton]}>
              <Icon name="plus" size={18} color="white" />
            </View>
          </Pressable>
        )}
      </View>

      {/* --- Applicant Info --- */}
      <View style={styles.infoContainer}>
        <Text style={styles.nameText}>{`${firstName} ${lastName}`}</Text>
        <Text style={styles.infoText}>📧 {email}</Text>
        <Text style={styles.infoText}>📞 {phone}</Text>
        <Text style={styles.infoText}>💼 Experience: {experience}</Text>
        {message && <Text style={styles.infoText}>📝 Message: {message}</Text>}

        {/* ID Photo */}
        {idPhoto && (
          <View style={{ marginTop: 8 }}>
            <Text style={styles.infoText}>🆔 ID Photo:</Text>
            <Pressable onPress={handlePhotoPress} onLongPress={handleLongPress}>
              <Animated.Image
                source={{ uri: idPhoto }}
                style={[styles.idPhoto, { width: animatedWidth, height: animatedHeight }]}
                resizeMode="contain"
              />
            </Pressable>
          </View>
        )}

        {/* Background Consent */}
        <Text style={styles.infoText}>
          ✅ Background Check Consent: {backgroundConsent ? "Yes" : "No"}
        </Text>
      </View>

      {/* --- Create Employee Form --- */}
      {formVisible && (
        <View style={{ marginTop: 12 }}>
          <CreateNewEmployeeForm
            id={id}
            firstName={firstName}
            lastName={lastName}
            email={email}
            setApplicationsList={setApplicationsList}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  actionButton: {
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#3da9fc",
    width: 35,
    height: 35,
  },
  keepButton: {
    backgroundColor: "#28a745",
    width: 160,
    height: 35,
  },
  infoContainer: {
    marginTop: 10,
  },
  nameText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E1E1E",
    marginBottom: 5,
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 3,
    lineHeight: 20,
  },
  idPhoto: {
    width: 120,
    height: 80,
    marginTop: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ccc",
  },
});

export default ApplicationTile;
