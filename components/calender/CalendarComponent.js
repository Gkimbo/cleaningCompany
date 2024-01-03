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
			// Date is not selected, add it to the selection
			updatedDates[date.dateString] = { selected: true, color: "green" };
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

	return (
		<>
			<View style={calenderStyles.container}>
				<Text style={calenderStyles.title}>Select Dates</Text>
				<Calendar
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
