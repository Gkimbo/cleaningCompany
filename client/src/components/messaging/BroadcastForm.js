import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigate } from "react-router-native";
import Icon from "react-native-vector-icons/FontAwesome";
import messagingStyles from "../../services/styles/MessagingStyles";
import MessageService from "../../services/fetchRequests/MessageClass";

const BroadcastForm = ({ state }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [sending, setSending] = useState(false);

  const audienceOptions = [
    { value: "all", label: "Everyone" },
    { value: "cleaners", label: "Cleaners Only" },
    { value: "homeowners", label: "Homeowners Only" },
  ];

  const handleSend = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Please enter a message to broadcast.");
      return;
    }

    setSending(true);

    try {
      const response = await MessageService.sendBroadcast(
        content.trim(),
        targetAudience,
        title.trim() || "Company Announcement",
        state.currentUser.token
      );

      if (response.error) {
        Alert.alert("Error", response.error);
      } else {
        Alert.alert("Success", "Broadcast sent successfully!", [
          { text: "OK", onPress: () => navigate("/messages") },
        ]);
      }
    } catch (error) {
      console.error("Error sending broadcast:", error);
      Alert.alert("Error", "Failed to send broadcast. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // Only owners can access this
  if (state.account !== "owner") {
    return (
      <View style={messagingStyles.container}>
        <View style={messagingStyles.emptyContainer}>
          <Icon name="lock" size={48} color="#94a3b8" />
          <Text style={messagingStyles.emptyText}>
            Only owners can send broadcast messages.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={messagingStyles.container}>
      {/* Header */}
      <View style={messagingStyles.header}>
        <Pressable onPress={() => navigate("/messages")} style={{ padding: 8 }}>
          <Icon name="arrow-left" size={20} color="#1e3a8a" />
        </Pressable>
        <Text style={messagingStyles.headerTitle}>Send Broadcast</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={messagingStyles.broadcastContainer}>
        {/* Title Input */}
        <Text style={messagingStyles.broadcastLabel}>Title (optional)</Text>
        <TextInput
          style={messagingStyles.broadcastInput}
          placeholder="Company Announcement"
          placeholderTextColor="#94a3b8"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />

        {/* Audience Selector */}
        <Text style={messagingStyles.broadcastLabel}>Send to</Text>
        <View style={messagingStyles.audienceContainer}>
          {audienceOptions.map((option) => (
            <Pressable
              key={option.value}
              style={[
                messagingStyles.audienceOption,
                targetAudience === option.value &&
                  messagingStyles.audienceOptionSelected,
              ]}
              onPress={() => setTargetAudience(option.value)}
            >
              <Text
                style={[
                  messagingStyles.audienceOptionText,
                  targetAudience === option.value &&
                    messagingStyles.audienceOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Message Content */}
        <Text style={messagingStyles.broadcastLabel}>Message</Text>
        <TextInput
          style={[messagingStyles.broadcastInput, messagingStyles.broadcastTextArea]}
          placeholder="Enter your broadcast message..."
          placeholderTextColor="#94a3b8"
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={2000}
          numberOfLines={6}
        />

        {/* Character count */}
        <Text
          style={{
            fontSize: 12,
            color: "#94a3b8",
            textAlign: "right",
            marginTop: 4,
          }}
        >
          {content.length}/2000
        </Text>

        {/* Send Button */}
        <Pressable
          style={[
            messagingStyles.broadcastButton,
            sending && { opacity: 0.7 },
          ]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={messagingStyles.broadcastButtonText}>
              <Icon name="bullhorn" size={16} color="#ffffff" /> Send Broadcast
            </Text>
          )}
        </Pressable>

        {/* Info text */}
        <Text
          style={{
            fontSize: 13,
            color: "#64748b",
            textAlign: "center",
            marginTop: 16,
            paddingHorizontal: 16,
          }}
        >
          This message will be sent to{" "}
          {targetAudience === "all"
            ? "all users"
            : targetAudience === "cleaners"
              ? "all cleaners"
              : "all homeowners"}{" "}
          and they will receive an email notification.
        </Text>
      </ScrollView>
    </View>
  );
};

export default BroadcastForm;
