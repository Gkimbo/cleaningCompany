import React, { useState, useEffect, useContext, useMemo } from "react";
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
import { API_BASE } from "../../../services/config";

const baseURL = API_BASE.replace("/api/v1", "");

const generateRoomSections = (home) => {
  const sections = [
    { key: "kitchen", name: "Kitchen" },
    { key: "living-room", name: "Living Room" },
  ];

  const numBeds = parseInt(home?.numBeds) || 1;
  const numBaths = Math.ceil(parseFloat(home?.numBaths)) || 1;

  for (let i = 1; i <= numBeds; i++) {
    sections.push({ key: `bedroom-${i}`, name: numBeds === 1 ? "Bedroom" : `Bedroom ${i}` });
  }
  for (let i = 1; i <= numBaths; i++) {
    sections.push({ key: `bathroom-${i}`, name: numBaths === 1 ? "Bathroom" : `Bathroom ${i}` });
  }

  return sections;
};

const JobPhotoCapture = ({
  appointmentId,
  photoType,
  home,
  onPhotosUpdated,
  onComplete,
}) => {
  const { currentUser } = useContext(UserContext);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [activeRoom, setActiveRoom] = useState(null);

  const roomSections = useMemo(() => generateRoomSections(home), [home]);

  useEffect(() => {
    loadExistingPhotos();
  }, [appointmentId, photoType]);

  useEffect(() => {
    // Initially expand rooms that need photos
    const initialExpanded = {};
    roomSections.forEach((section) => {
      initialExpanded[section.key] = true;
    });
    setExpandedSections(initialExpanded);
  }, [roomSections]);

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

  const getPhotosByRoom = (roomName) => {
    return photos.filter((photo) => photo.room === roomName);
  };

  const getRoomsWithPhotos = () => {
    const roomsWithPhotos = new Set();
    photos.forEach((photo) => {
      if (photo.room) {
        roomsWithPhotos.add(photo.room);
      }
    });
    return roomsWithPhotos;
  };

  const getValidationStatus = () => {
    const roomsWithPhotos = getRoomsWithPhotos();
    const completedRooms = roomSections.filter((section) =>
      roomsWithPhotos.has(section.name)
    );
    return {
      completed: completedRooms.length,
      total: roomSections.length,
      isValid: completedRooms.length === roomSections.length,
      missingRooms: roomSections
        .filter((section) => !roomsWithPhotos.has(section.name))
        .map((section) => section.name),
    };
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

  const takePhoto = async (roomName) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setActiveRoom(roomName);

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0], roomName);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setActiveRoom(null);
    }
  };

  const pickFromLibrary = async (roomName) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setActiveRoom(roomName);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadPhoto(result.assets[0], roomName);
      }
    } catch (error) {
      console.error("Error picking photo:", error);
      Alert.alert("Error", "Failed to select photo. Please try again.");
    } finally {
      setActiveRoom(null);
    }
  };

  const uploadPhoto = async (imageAsset, roomName) => {
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
          room: roomName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await loadExistingPhotos();
        if (onPhotosUpdated) onPhotosUpdated();
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

  const toggleSection = (sectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleContinue = () => {
    const validation = getValidationStatus();

    if (!validation.isValid) {
      Alert.alert(
        "Photos Required",
        `Please take at least one photo for each room before continuing.\n\nMissing photos for:\n${validation.missingRooms.join("\n")}`
      );
      return;
    }
    if (onComplete) onComplete();
  };

  const validation = getValidationStatus();
  const progressPercent = (validation.completed / validation.total) * 100;

  const renderRoomSection = (section) => {
    const roomPhotos = getPhotosByRoom(section.name);
    const hasPhotos = roomPhotos.length > 0;
    const isExpanded = expandedSections[section.key];
    const isUploadingToRoom = activeRoom === section.name && uploading;

    return (
      <View key={section.key} style={styles.roomSection}>
        <TouchableOpacity
          style={[
            styles.roomSectionHeader,
            hasPhotos && styles.roomSectionHeaderComplete,
            !hasPhotos && styles.roomSectionHeaderIncomplete,
          ]}
          onPress={() => toggleSection(section.key)}
        >
          <View style={styles.roomSectionTitleRow}>
            <Text style={styles.roomSectionStatus}>
              {hasPhotos ? "✓" : "⚠"}
            </Text>
            <Text style={styles.roomSectionTitle}>{section.name}</Text>
            <View style={styles.photoCountBadge}>
              <Text style={styles.photoCountText}>
                {roomPhotos.length} {roomPhotos.length === 1 ? "photo" : "photos"}
              </Text>
            </View>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? "▼" : "▶"}</Text>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.roomSectionContent}>
            <View style={styles.roomPhotoGrid}>
              {roomPhotos.map((photo) => (
                <View key={photo.id} style={styles.roomPhotoCard}>
                  <Image
                    source={{ uri: photo.photoData }}
                    style={styles.roomPhotoThumbnail}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deletePhoto(photo.id)}
                  >
                    <Text style={styles.deleteButtonText}>X</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={[
                  styles.addPhotoButton,
                  isUploadingToRoom && styles.buttonDisabled,
                ]}
                onPress={() => takePhoto(section.name)}
                disabled={uploading}
              >
                {isUploadingToRoom ? (
                  <ActivityIndicator size="small" color="#0d9488" />
                ) : (
                  <>
                    <Text style={styles.addPhotoIcon}>📷</Text>
                    <Text style={styles.addPhotoText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addPhotoButton,
                  styles.libraryAddButton,
                  isUploadingToRoom && styles.buttonDisabled,
                ]}
                onPress={() => pickFromLibrary(section.name)}
                disabled={uploading}
              >
                <Text style={styles.addPhotoIcon}>🖼️</Text>
                <Text style={styles.addPhotoText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {!hasPhotos && (
              <Text style={styles.roomRequiredText}>
                At least 1 photo required
              </Text>
            )}
          </View>
        )}
      </View>
    );
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

      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {validation.completed} of {validation.total} rooms photographed
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
      </View>

      <ScrollView style={styles.roomsScrollView} showsVerticalScrollIndicator={false}>
        {roomSections.map(renderRoomSection)}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.continueButton,
          !validation.isValid && styles.continueButtonDisabled,
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
