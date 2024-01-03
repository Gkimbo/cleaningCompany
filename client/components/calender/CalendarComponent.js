import React, { useState } from "react";
import { View, Text, Button } from "react-native";
import { Calendar } from "react-native-calendars";
import calenderStyles from "../../services/styles/CalenderSyles";

const CalendarComponent = ({ onDatesSelected }) => {
	const [selectedDates, setSelectedDates] = useState({});
	const [currentMonth, setCurrentMonth] = useState(new Date());

	const handleDateSelect = (date) => {
		const updatedDates = { ...selectedDates };

		if (updatedDates[date.dateString]) {
			// Date is already selected, unselect it
			delete updatedDates[date.dateString];
		} else {
			// Date is not selected, add it to the selection with a price
			updatedDates[date.dateString] = {
				selected: true,
				color: "green",
				price: 19.99, // Add your price here
			};
		}

		setSelectedDates(updatedDates);
	};

	const handleSubmit = () => {
		// Pass the array of selected dates to the parent component
		const selectedDateArray = Object.keys(selectedDates);
		console.log(selectedDates);
		onDatesSelected(selectedDateArray);
	};

	const handleMonthChange = (date) => {
		setCurrentMonth(new Date(date.year, date.month - 1));
	};

	// const renderDay = (date, item) => {
	// 	console.log("DAY");
	// 	return (
	// 		<View>
	// 			<Text>{date.day}</Text>
	// 			{item && item.price && (
	// 				<Text style={{ color: "green" }}> ${item.price.toFixed(2)}</Text>
	// 			)}
	// 		</View>
	// 	);
	// };

	return (
		<>
			<View style={calenderStyles.container}>
				<Text style={calenderStyles.title}>Select Dates</Text>
				<Calendar
					// renderDay={renderDay}
					current={currentMonth.toISOString().split("T")[0]}
					onDayPress={handleDateSelect}
					markedDates={selectedDates}
					onMonthChange={handleMonthChange}
				/>
				<Button
					title="Submit"
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
