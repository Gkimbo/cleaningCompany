import React, { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigate } from "react-router-native";
import Appointment from "../../services/fetchRequests/AppointmentClass";
import homePageStyles from "../../services/styles/HomePageStyles";
import EachAppointment from "./EachAppointment";

const HomeAppointmentTile = ({
  id,
  nickName,
  address,
  city,
  state,
  zipcode,
  contact,
  allAppointments,
  setChangesSubmitted,
}) => {
  const [appointments, setAppointments] = useState([]);
  const [changeNotification, setChangeNotification] = useState({
    message: "",
    appointment: "",
  });

  const navigate = useNavigate();
  const { width } = Dimensions.get("window");

  useEffect(() => {
    setAppointments(allAppointments);
  }, [allAppointments]);

  const handleSheetsToggle = async (value, appointmentId) => {
    try {
      const updatedAppointments = appointments.map((appointment) => {
        if (appointment.id === appointmentId) {
          const priceChange = value === "yes" ? 25 : -25;
          if (value === appointment.bringSheets) return appointment;
          return { ...appointment, bringSheets: value, price: Number(appointment.price) + priceChange };
        }
        return appointment;
      });

      const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
      if (value !== appointmentToUpdate.bringSheets) {
        await Appointment.updateSheetsAppointments(value, appointmentId);
        setChangeNotification({
          message: "Sheets updated. Price adjusted.",
          appointment: appointmentId,
        });
      } else setChangeNotification({ message: "", appointment: "" });

      setAppointments(updatedAppointments);
    } catch (error) {
      console.error("Error updating sheetsProvided:", error);
    }
  };

  const handleTowelToggle = async (value, appointmentId) => {
    try {
      const updatedAppointments = appointments.map((appointment) => {
        if (appointment.id === appointmentId) {
          const priceChange = value === "yes" ? 25 : -25;
          if (value === appointment.bringTowels) return appointment;
          return { ...appointment, bringTowels: value, price: Number(appointment.price) + priceChange };
        }
        return appointment;
      });

      const appointmentToUpdate = appointments.find((a) => a.id === appointmentId);
      if (value !== appointmentToUpdate.bringTowels) {
        await Appointment.updateTowelsAppointments(value, appointmentId);
        setChangeNotification({
          message: "Towels updated. Price adjusted.",
          appointment: appointmentId,
        });
      } else setChangeNotification({ message: "", appointment: "" });

      setAppointments(updatedAppointments);
    } catch (error) {
      console.error("Error updating towelsProvided:", error);
    }
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split("-").map(Number);
    const newDate = new Date(year, month - 1, day);
    return newDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const isWithinOneWeek = (dateString) => {
    const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
    const appointmentDate = new Date(dateString).getTime();
    const currentDate = new Date().getTime();
    return appointmentDate - currentDate < oneWeekInMilliseconds;
  };

  const filteredAppointments = appointments
    .filter((appointment) => appointment.homeId === id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const allAppointmentsFiltered = filteredAppointments.map((appointment, index) => {
    const isDisabled = isWithinOneWeek(appointment.date);
    return (
      <EachAppointment
        key={appointment.id ?? appointment.date}
        id={appointment.id}
        index={index}
        date={appointment.date}
        price={appointment.price}
        bringSheets={appointment.bringSheets}
        bringTowels={appointment.bringTowels}
        keyPadCode={appointment.keyPadCode}
        keyLocation={appointment.keyLocation}
        isDisabled={isDisabled}
        formatDate={formatDate}
        handleTowelToggle={handleTowelToggle}
        handleSheetsToggle={handleSheetsToggle}
        setChangesSubmitted={setChangesSubmitted}
        changeNotification={changeNotification}
        setChangeNotification={setChangeNotification}
        contact={contact}
        paid={appointment.paid}
        completed={appointment.completed}
        timeToBeCompleted={appointment.timeToBeCompleted}
      />
    );
  });

  const handleOnPress = () => {
    navigate(`/details/${id}`);
  };

  return (
    <View
      style={{
        ...homePageStyles.homeTileContainer,
        padding: 16,
        marginVertical: 10,
        backgroundColor: "#ffffff",
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      {/* Header */}
      <Text style={homePageStyles.homeTileTitle}>{nickName}</Text>
      <Text style={{ ...homePageStyles.homeTileAddress, marginVertical: 2 }}>{address}</Text>
      <Text style={{ ...homePageStyles.homeTileAddress, marginBottom: 8 }}>
        {`${city}, ${state} ${zipcode}`}
      </Text>

      {/* Book Button */}
      <Pressable onPress={handleOnPress}>
        <View
          style={{
            ...homePageStyles.bookButton,
            marginBottom: 12,
            backgroundColor: "#3a8dff",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>
            Book or cancel a cleaning
          </Text>
        </View>
      </Pressable>

      {/* Scrollable Appointments */}
      <ScrollView
        style={{
          maxHeight: 220,
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
          marginTop: 4,
          paddingTop: 8,
        }}
        contentContainerStyle={{ paddingBottom: 8 }}
        nestedScrollEnabled
      >
        {allAppointmentsFiltered.length > 0 ? (
          allAppointmentsFiltered
        ) : (
          <Text style={{ color: "#64748b", textAlign: "center", marginTop: 10 }}>
            No appointments scheduled yet.
          </Text>
        )}
      </ScrollView>

      {/* Bottom Button */}
      <Pressable onPress={handleOnPress}>
        <View
          style={{
            ...homePageStyles.bookButton,
            marginTop: 12,
            backgroundColor: "#3a8dff",
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 16,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600", textAlign: "center" }}>
            Book or cancel a cleaning for this home
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

export default HomeAppointmentTile;
