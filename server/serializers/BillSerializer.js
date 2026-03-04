class BillSerializer {
	// Fields that are stored in cents and should be converted to dollars for display
	static centsFields = ["appointmentDue", "cancellationFee", "totalDue"];

	static getValue(bill, attribute) {
		const value = bill.dataValues[attribute];
		// Convert cents to dollars for price fields
		if (this.centsFields.includes(attribute) && value !== null && value !== undefined) {
			return (value / 100).toFixed(2);
		}
		return value;
	}

	static serializeArray(billArray) {
		const allowedAttributes = ["appointmentDue", "cancellationFee", "totalDue"];
		const serializedBill = billArray.map((bill) => {
			const newBill = {};
			for (const attribute of allowedAttributes) {
				newBill[attribute] = this.getValue(bill, attribute);
			}
			return newBill;
		});
		return serializedBill[0];
	}
}

module.exports = BillSerializer;
