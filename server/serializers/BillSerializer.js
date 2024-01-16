class BillSerializer {
	static serializeArray(billArray) {
		const allowedAttributes = ["appointmentDue", "cancellationFee", "totalDue"];
		const serializedBill = billArray.map((bill) => {
			const newBill = {};
			for (const attribute of allowedAttributes) {
				newBill[attribute] = bill.dataValues[attribute];
			}
			return newBill;
		});
		return serializedBill;
	}
}

module.exports = BillSerializer;
