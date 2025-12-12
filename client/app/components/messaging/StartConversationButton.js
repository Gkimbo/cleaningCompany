import React, { useState } from "react";
import { Pressable, Text, ActivityIndicator, Alert } from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import MessageService from "../../services/fetchRequests/MessageClass";

const StartConversationButton = ({ appointmentId, token, style, textStyle }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (!appointmentId || !token) {
      Alert.alert("Error", "Unable to start conversation.");
      return;
    }

    setLoading(true);

    try {
      const response = await MessageService.createAppointmentConversation(
        appointmentId,
        token
      );

      if (response.error) {
        Alert.alert("Error", response.error);
      } else if (response.conversation) {
        navigate(`/messages/${response.conversation.id}`);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      Alert.alert("Error", "Failed to start conversation. Please try again.");
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
          backgroundColor: "rgba(58, 141, 255, 0.15)",
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "rgba(58, 141, 255, 0.3)",
        },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#3a8dff" />
      ) : (
        <>
          <Icon name="comment" size={14} color="#3a8dff" />
          <Text
            style={[
              {
                marginLeft: 8,
                fontSize: 14,
                fontWeight: "600",
                color: "#3a8dff",
              },
              textStyle,
            ]}
          >
            Message
          </Text>
        </>
      )}
    </Pressable>
  );
};

export default StartConversationButton;
