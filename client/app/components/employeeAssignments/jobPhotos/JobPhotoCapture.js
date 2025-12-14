import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { UserContext } from "../../../context/UserContext";
import styles from "./JobPhotoCaptureStyles";

const baseURL = "http://localhost:3000";

const ROOMS = [
  "Living Room",
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Dining Room",
  "Hallway",
  "Office",
  "Other",
];

const JobPhotoCapture = ({
  appointmentId,
  photoType,
  onPhotosUpdated,
  onComplete,
}) => {
  const { currentUser } = useContext(UserContext);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  useEffect(() => {
    loadExistingPhotos();
  }, [appointmentId, photoType]);

  const loadExistingPhotos = async () => {
    try {
      const response = await fetch(
        `${baseURL}/api/v1/job-photos/${appointmentId}`,
        {
          headers: {
            Authorization: `Bearer ${currentUser.token}`,
          },
        }
      );
      const data = await response.json();

      if (response.ok) {
        const existingPhotos =
          photoType === "before" ? data.beforePhotos : data.afterPhotos;
        setPhotos(existingPhotos || []);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    }
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || libraryStatus !== "granted") {
      Alert.alert(
        "Permissions Required",
        "Camera and photo library permissions are needed to capture job photos."
      );
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const pickFromLibrary = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    }
  };

  const uploadPhoto = async (imageAsset) => {
    setUploading(true);

    try {
      const photoData = `data:image/jpeg;base64,${imageAsset.base64}`;

      const response = await fetch(`${baseURL}/api/v1/job-photos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          appointmentId,
          photoType,
          photoData,
          room: selectedRoom,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadExistingPhotos();
        if (onPhotosUpdated) onPhotosUpdated();
        setSelectedRoom(null);
      } else {
        Alert.alert("Error", data.error || "Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoId) => {
    Alert.alert("Delete Photo", "Are you sure you want to delete this photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await fetch(
              `${baseURL}/api/v1/job-photos/${photoId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${currentUser.token}`,
                },
              }
            );

            if (response.ok) {
              await loadExistingPhotos();
              if (onPhotosUpdated) onPhotosUpdated();
            } else {
              const data = await response.json();
              Alert.alert("Error", data.error || "Failed to delete photo");
            }
          } catch (error) {
            console.error("Error deleting photo:", error);
            Alert.alert("Error", "Failed to delete photo");
          }
        },
      },
    ]);
  };

  const handleContinue = () => {
    if (photos.length === 0) {
      Alert.alert(
        "Photos Required",
        `Please take at least one ${photoType} photo before continuing.`
      );
      return;
    }
    if (onComplete) onComplete();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {photoType === "before" ? "Before" : "After"} Photos
        </Text>
        <Text style={styles.subtitle}>
          {photoType === "before"
            ? "Take photos of each room before you start cleaning"
            : "Take photos of each room after you finish cleaning"}
        </Text>
      </View>

      <View style={styles.roomSelector}>
        <Text style={styles.roomLabel}>Select Room (Optional):</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.roomScrollView}
        >
          {ROOMS.map((room) => (
            <TouchableOpacity
              key={room}
              style={[
                styles.roomChip,
                selectedRoom === room && styles.roomChipSelected,
              ]}
              onPress={() =>
                setSelectedRoom(selectedRoom === room ? null : room)
              }
            >
              <Text
                style={[
                  styles.roomChipText,
                  selectedRoom === room && styles.roomChipTextSelected,
                ]}
              >
                {room}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.captureButton, uploading && styles.buttonDisabled]}
          onPress={takePhoto}
          disabled={uploading}
        >
          <Text style={styles.captureButtonText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.libraryButton, uploading && styles.buttonDisabled]}
          onPress={pickFromLibrary}
          disabled={uploading}
        >
          <Text style={styles.libraryButtonText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      {uploading && (
        <View style={styles.uploadingContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.uploadingText}>Uploading photo...</Text>
        </View>
      )}

      <View style={styles.photosContainer}>
        <Text style={styles.photosHeader}>
          Photos Taken ({photos.length})
          {photos.length === 0 && (
            <Text style={styles.requiredText}> - At least 1 required</Text>
          )}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.photosScrollView}
        >
          {photos.map((photo) => (
            <View key={photo.id} style={styles.photoCard}>
              <Image
                source={{ uri: photo.photoData }}
                style={styles.photoThumbnail}
                resizeMode="cover"
              />
              {photo.room && (
                <Text style={styles.photoRoom}>{photo.room}</Text>
              )}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deletePhoto(photo.id)}
              >
                <Text style={styles.deleteButtonText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}

          {photos.length === 0 && (
            <View style={styles.noPhotosContainer}>
              <Text style={styles.noPhotosText}>No photos yet</Text>
              <Text style={styles.noPhotosSubtext}>
                Tap "Take Photo" to get started
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={[
          styles.continueButton,
          photos.length === 0 && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
      >
        <Text style={styles.continueButtonText}>
          {photoType === "before"
            ? "Continue to Cleaning"
            : "Review & Complete Job"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default JobPhotoCapture;
