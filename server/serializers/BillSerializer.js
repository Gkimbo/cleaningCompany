class BillSerializer {
	// Fields that are stored in cents and should be converted to dollars for display
	static centsFields = ["appointmentDue", "cancellationFee", "totalDue"];
	static allowedAttributes = ["appointmentDue", "cancellationFee", "totalDue"];

	static getValue(bill, attribute) {
		const data = bill.dataValues || bill;
		const value = data[attribute];
		// Convert cents to dollars for price fields
		if (this.centsFields.includes(attribute) && value !== null && value !== undefined) {
			return (value / 100).toFixed(2);
		}
		return value;
	}

	static serializeOne(bill) {
		if (!bill) return null;
		const serialized = {};
		for (const attribute of this.allowedAttributes) {
			serialized[attribute] = this.getValue(bill, attribute);
		}
		return serialized;
	}

	static serializeArray(billArray) {
		if (!billArray || billArray.length === 0) return [];
		return billArray.map((bill) => this.serializeOne(bill));
	}

	/**
	 * Legacy method - serializes array but returns first element
	 * @deprecated Use serializeOne() for single bills or serializeArray() for multiple
	 */
	static serializeFirst(billArray) {
		if (!billArray || billArray.length === 0) return null;
		return this.serializeOne(billArray[0]);
	}
}

module.exports = BillSerializer;
