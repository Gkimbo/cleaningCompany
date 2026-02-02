import React, { useState } from "react";
import { Pressable, Text, ActivityIndicator, Alert, View } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import MessageService from "../../services/fetchRequests/MessageClass";

const GetHelpButton = ({ token, style }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!token) {
      Alert.alert("Error", "Please sign in to contact support.");
      return;
    }

    setLoading(true);

    try {
      const response = await MessageService.createSupportConversation(token);

      if (response.error) {
        Alert.alert("Error", response.error);
      } else if (response.conversation && response.conversation.id) {
        navigate(`/messages/${response.conversation.id}`);
      } else {
        console.error("Unexpected response:", response);
        Alert.alert("Error", "Unable to start support conversation. Please try again.");
      }
    } catch (error) {
      console.error("Error starting support conversation:", error);
      Alert.alert("Error", "Failed to connect with support. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={loading}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1e3a8a",
          paddingVertical: 14,
          paddingHorizontal: 24,
          borderRadius: 25,
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 5,
          elevation: 4,
        },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        loading && { opacity: 0.7 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Icon name="life-ring" size={18} color="#ffffff" />
          <Text
            style={{
              marginLeft: 10,
              fontSize: 16,
              fontWeight: "600",
              color: "#ffffff",
            }}
          >
            Get Help
          </Text>
        </View>
      )}
    </Pressable>
  );
};

export default GetHelpButton;
