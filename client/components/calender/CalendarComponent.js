//TO-DO: allow user to turn off and on towels and sheets from the booking page
// Add 25$ fee for deleting appointment within a week and add to db

import React, { useState } from "react";
import { View, Text, Button, Pressable, Modal } from "react-native";
import { Calendar } from "react-native-calendars";
import calenderStyles from "../../services/styles/CalenderSyles";
import Icon from "react-native-vector-icons/FontAwesome";
import UserFormStyles from "../../services/styles/UserInputFormStyle";

const CalendarComponent = ({
	onDatesSelected,
	numBeds,
	numBaths,
	appointments,
	onAppointmentDelete,
	confirmationModalVisible,
	setConfirmationModalVisible,
	sheets,
	towels,
	setCancellationFee,
}) => {
	const [selectedDates, setSelectedDates] = useState({});
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [dateToDelete, setDateToDelete] = useState(null);
	const [error, setError] = useState(null);

	const calculatePrice = () => {
		let price = 0;
		if (sheets === "yes") {
			price += 25;
		}
		if (towels === "yes") {
			price += 25;
		}
		if (Number(numBeds) === 1 && Number(numBaths) === 1) {
			price = price + 100;
			return price;
		} else if (Number(numBeds) === 1) {
			const baths = (Number(numBaths) - 1) * 50;
			price += baths + 100;
			return price;
		} else if (Number(numBaths) === 1) {
			const beds = (Number(numBeds) - 1) * 50;
			price += beds + 100;
			return price;
		} else {
			const beds = (Number(numBeds) - 1) * 50;
			const baths = (Number(numBaths) - 1) * 50;
			price += beds + baths + 100;
			return price;
		}
	};

	const handleDateSelect = (date) => {
		const currentDate = new Date();
		const selectedDate = new Date(date.dateString);

		const isWithinWeek =
			selectedDate.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

		if (isWithinWeek) {
			setError("Cannot book appointments within a week of the todays date.");
		} else {
			setError(null);
			const updatedDates = { ...selectedDates };
			if (updatedDates[date.dateString]) {
				delete updatedDates[date.dateString];
			} else {
				updatedDates[date.dateString] = {
					selected: true,
					price: calculatePrice(),
				};
			}

			setSelectedDates(updatedDates);
		}
	};

	const handleSubmit = () => {
		const selectedDateArray = Object.keys(selectedDates).map((dateString) => {
			const { price } = selectedDates[dateString];
			return {
				date: dateString,
				price,
				paid: false,
				bringTowels: towels,
				bringSheets: sheets,
			};
		});

		onDatesSelected(selectedDateArray);
	};

	const handleMonthChange = (date) => {
		setCurrentMonth(new Date(date.year, date.month - 1));
	};

	const isDateDisabled = (date) => {
		const currentDate = new Date();
		return new Date(date.dateString) < currentDate;
	};

	const isDateBooked = (date) => {
		return appointments.some(
			(appointment) => appointment.date === date.dateString
		);
	};

	const priceOfBooking = (date) => {
		let price;
		appointments.forEach((day) => {
			if (day.date === date.dateString) {
				price = day.price;
			}
		});
		return price;
	};

	const handleRemoveBooking = (date) => {
		const currentDate = new Date();
		const selectedDate = new Date(date.dateString);

		const isWithinWeek =
			selectedDate.getTime() - currentDate.getTime() <= 7 * 24 * 60 * 60 * 1000;

		if (isWithinWeek) {
			setDateToDelete(date);
			setConfirmationModalVisible(true);
		} else {
			const updatedDates = { ...selectedDates };
			delete updatedDates[date.dateString];
			setSelectedDates(updatedDates);
			onAppointmentDelete(date);
		}
	};

	const handleConfirmation = (deleteAppointment) => {
		setConfirmationModalVisible(false);
		if (deleteAppointment) {
			// dispatch({
			// 	type: "ADD_BILL",
			// 	payload: 25,
			// });
			const updatedDates = { ...selectedDates };
			delete updatedDates[dateToDelete.dateString];
			setCancellationFee(25);
			setSelectedDates(updatedDates);
			onAppointmentDelete(dateToDelete, true);
		}
	};

	const renderDay = ({ date }) => {
		const selectedStyle = {
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: confirmationModalVisible
				? "grey"
				: isDateBooked(date)
					? "green"
					: "#3498db",
			borderRadius: 50,
			padding: 10,
		};

		const dayStyle = {
			justifyContent: "center",
			alignItems: "center",
			padding: 10,
			opacity: confirmationModalVisible
				? "grey"
				: isDateDisabled(date)
					? 0.5
					: 1,
		};

		const selectedPriceStyle = {
			fontSize: 12,
			color: "black",
		};

		const priceStyle = {
			fontSize: 12,
			color: "gray",
		};

		return (
			<>
				{isDateDisabled(date) ? (
					<View style={dayStyle}>
						<Text>{date.day}</Text>
					</View>
				) : isDateBooked(date) ? (
					<Pressable
						style={selectedStyle}
						onPress={() => handleRemoveBooking(date)}
					>
						<Text>{date.day}</Text>
						<Text style={selectedPriceStyle}>${priceOfBooking(date)}</Text>
					</Pressable>
				) : selectedDates[date.dateString] ? (
					<Pressable
						style={selectedStyle}
						onPress={() => handleDateSelect(date)}
					>
						<Text>{date.day}</Text>
						<Text style={selectedPriceStyle}>${calculatePrice()}</Text>
					</Pressable>
				) : (
					<Pressable style={dayStyle} onPress={() => handleDateSelect(date)}>
						<Text>{date.day}</Text>
						<Text style={priceStyle}>${calculatePrice()}</Text>
					</Pressable>
				)}
			</>
		);
	};
	return (
		<>
			<View style={calenderStyles.container}>
				{error && <Text style={UserFormStyles.error}>{error}</Text>}
				<Text style={calenderStyles.title}>Select Dates</Text>
				<Calendar
					current={currentMonth.toISOString().split("T")[0]}
					onMonthChange={handleMonthChange}
					renderArrow={(direction) => (
						<View>
							{direction === "left" ? (
								<Icon name="chevron-left" size={15} color="#3498db" />
							) : (
								<Icon name="chevron-right" size={15} color="#3498db" />
							)}
						</View>
					)}
					dayComponent={renderDay}
				/>
				<Button
					title="Book Cleanings!"
					onPress={handleSubmit}
					disabled={Object.keys(selectedDates).length === 0}
				/>
			</View>
			<View style={calenderStyles.datesContainer}>
				{Object.keys(selectedDates).length > 0 && (
					<View style={calenderStyles.selectedDatesContainer}>
						<Text style={calenderStyles.selectedDatesText}>
							Selected Dates: {Object.keys(selectedDates).join(", ")}
						</Text>
					</View>
				)}
			</View>
			<Modal
				animationType="slide"
				transparent={true}
				visible={confirmationModalVisible}
				onRequestClose={() => setConfirmationModalVisible(false)}
			>
				<View style={calenderStyles.modalContainer}>
					<View style={calenderStyles.modalContent}>
						<Text style={calenderStyles.modalText}>
							Are you sure you want to delete this appointment? A $25
							cancellation fee will be charged.
						</Text>
						<View style={calenderStyles.modalButtons}>
							<Pressable onPress={() => handleConfirmation(true)}>
								<View style={calenderStyles.deleteButton}>
									<Text style={calenderStyles.buttonText}>Delete</Text>
								</View>
							</Pressable>
							<Pressable onPress={() => handleConfirmation(false)}>
								<View style={calenderStyles.keepButton}>
									<Text style={calenderStyles.buttonText}>Keep</Text>
								</View>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>
		</>
	);
};

export default CalendarComponent;
