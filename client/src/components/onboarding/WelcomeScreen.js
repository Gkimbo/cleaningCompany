import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigate } from "react-router-native";
import styles from "./OnboardingStyles";

const WelcomeScreen = () => {
  const navigate = useNavigate();

  const features = [
    { icon: "🏠", text: "Add your homes with just a few taps" },
    { icon: "📅", text: "Book cleaning appointments instantly" },
    { icon: "✨", text: "Professional cleaners, verified & insured" },
    { icon: "💳", text: "Secure payments, no hidden fees" },
  ];

  return (
    <SafeAreaView style={styles.welcomeContainer}>
      <Text style={styles.welcomeTitle}>Welcome to CleanHome</Text>
      <Text style={styles.welcomeSubtitle}>
        Professional home cleaning made simple. Book trusted cleaners in minutes.
      </Text>

      <View style={styles.featureList}>
        {features.map((feature, index) => (
          <View key={index} style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>{feature.icon}</Text>
            </View>
            <Text style={styles.featureText}>{feature.text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.welcomeButton}
        onPress={() => navigate("/get-started")}
      >
        <Text style={styles.welcomeButtonText}>Get Started</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.welcomeSecondaryButton}
        onPress={() => navigate("/sign-in")}
      >
        <Text style={styles.welcomeSecondaryButtonText}>
          Already have an account? Sign In
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
