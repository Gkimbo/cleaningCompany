import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text
} from "react-native";
import { useNavigate } from "react-router-native";

const NewCleanerInformationPage = () => {
  const [applyRedirect, setApplyRedirect] = useState(false);
  const navigate = useNavigate();

  const handleApplyPress = () => {
    setApplyRedirect(true);
  };

  useEffect(() => {
    if (applyRedirect) {
      navigate("/application-form");
      setApplyRedirect(false);
    }
  }, [applyRedirect]);

  return (
    <ScrollView contentContainerStyle={styles.container}>

      <Pressable style={styles.button} onPress={handleApplyPress}>
        <Text style={styles.buttonText}>APPLY NOW</Text>
      </Pressable>

      <Text style={styles.heading}>Welcome, Future Cleaner!</Text>
      <Text style={styles.paragraph}>
        Thank you for your interest in joining our team! As a cleaner with our
        company, you’ll be part of a modern cleaning platform that connects
        homeowners with trusted professionals like you. Here's everything you
        need to know about what it's like to work with us.
      </Text>

      <Text style={styles.subheading}>Why Join Us?</Text>
      <Text style={styles.listItem}>
        • <Text style={styles.bold}>Flexible Schedule:</Text> Work when it suits you. You can set your own availability and take on cleaning jobs that fit your schedule.
      </Text>
      <Text style={styles.listItem}>
        • <Text style={styles.bold}>Competitive Pay:</Text> Earn money for every cleaning job you complete. Our cleaners earn top rates for their hard work and dedication.
      </Text>
      <Text style={styles.listItem}>
        • <Text style={styles.bold}>Work Independently:</Text> Be your own boss! Accept jobs directly through our platform without needing to report to a traditional office.
      </Text>
      <Text style={styles.listItem}>
        • <Text style={styles.bold}>Reliable Support:</Text> Our support team is here to assist you with any questions or challenges you may encounter while on the job.
      </Text>

      <Text style={styles.subheading}>What You'll Do</Text>
      <Text style={styles.paragraph}>
        As a cleaner, you’ll provide exceptional cleaning services to homes and
        apartments. This includes:
      </Text>
      <Text style={styles.listItem}>• Dusting all surfaces, vacuuming floor, walls and cieling, and mopping floors</Text>
      <Text style={styles.listItem}>• Cleaning bathrooms, kitchens, and living areas</Text>
      <Text style={styles.listItem}>• Making beds with fresh sheets and tidying spaces</Text>
      <Text style={styles.listItem}>• Following special instructions from clients</Text>

      <Text style={styles.subheading}>Who We're Looking For</Text>
      <Text style={styles.paragraph}>
        We’re seeking reliable, hardworking, and detail-oriented individuals who
        are passionate about providing high-quality cleaning services.
      </Text>
      <Text style={styles.listItem}>• Experience is a plus, but not required – we’ll provide guidance to help you succeed.</Text>
      <Text style={styles.listItem}>• You should be punctual, professional, and trustworthy.</Text>
      <Text style={styles.listItem}>• A friendly attitude and excellent customer service skills are essential.</Text>

      <Text style={styles.subheading}>How It Works</Text>
      <Text style={styles.paragraph}>
        Once you join our platform, you'll have access to a user-friendly app to:
      </Text>
      <Text style={styles.listItem}>• View available cleaning jobs near you</Text>
      <Text style={styles.listItem}>• Accept or decline jobs based on your schedule</Text>
      <Text style={styles.listItem}>• Track your earnings and performance</Text>
      <Text style={styles.listItem}>• Communicate with clients and our support team</Text>

      <Text style={styles.subheading}>Perks of the Job</Text>
      <Text style={styles.paragraph}>Working with us has its perks:</Text>
      <Text style={styles.listItem}>• Weekly payouts to ensure you get paid promptly</Text>
      <Text style={styles.listItem}>• Opportunities to earn bonuses for excellent service</Text>
      <Text style={styles.listItem}>• Becoming part of a growing community of cleaning professionals</Text>

      <Text style={styles.subheading}>Ready to Get Started?</Text>
      <Text style={styles.paragraph}>
        Becoming a cleaner with us is easy. Simply fill out the application, and
        our team will guide you through the onboarding process. Soon, you'll be
        making homes sparkle while earning great income on your terms.
      </Text>

      <Text style={styles.paragraph}>
        If you have any questions, feel free to reach out to our support team.
        We’re here to help you every step of the way. We look forward to
        welcoming you to our community!
      </Text>

      <Pressable style={styles.button} onPress={handleApplyPress}>
        <Text style={styles.buttonText}>APPLY NOW</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 5,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginBottom: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subheading: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 10,
  },
  paragraph: {
    fontSize: 16,
    marginBottom: 10,
    color: "#555",
  },
  listItem: {
    fontSize: 16,
    marginBottom: 5,
    color: "#555",
  },
  bold: {
    fontWeight: "bold",
  },
});

export default NewCleanerInformationPage;
