import React, { useState } from "react";
import { View, Text, Button, Pressable } from "react-native";
import { Calendar } from "react-native-calendars";
import calenderStyles from "../../services/styles/CalenderSyles";
import Icon from "react-native-vector-icons/FontAwesome";

const CalendarComponent = ({ onDatesSelected, numBeds, numBaths }) => {
	const [selectedDates, setSelectedDates] = useState({});
	const [currentMonth, setCurrentMonth] = useState(new Date());

	const calculatePrice = () => {
		if (Number(numBeds) === 1 && Number(numBaths) === 1) {
			return 100;
		} else if (Number(numBeds) === 1) {
			const baths = (Number(numBaths) - 1) * 50;
			return baths + 100;
		} else if (Number(numBaths) === 1) {
			const beds = (Number(numBeds) - 1) * 50;
			return beds + 100;
		} else {
			const beds = (Number(numBeds) - 1) * 50;
			const baths = (Number(numBaths) - 1) * 50;
			return beds + baths + 100;
		}
	};

	const handleDateSelect = (date) => {
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
	};

	const handleSubmit = () => {
		const selectedDateArray = Object.keys(selectedDates).map((dateString) => {
			const { price } = selectedDates[dateString];
			return { date: dateString, price };
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

	const renderDay = ({ date, state }) => {
		const selectedStyle = {
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: "#3498db",
			borderRadius: 50,
			padding: 10,
		};

		const dayStyle = {
			justifyContent: "center",
			alignItems: "center",
			padding: 10,
			opacity: isDateDisabled(date) ? 0.5 : 1,
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
						{/* <Text style={priceStyle}>${calculatePrice()}</Text> */}
					</View>
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
		</>
	);
};

export default CalendarComponent;
