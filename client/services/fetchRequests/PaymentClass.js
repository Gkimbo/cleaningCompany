/* eslint-disable no-console */
const baseURL = "http://localhost:3000";

class PaymentClass {
	static async addPayment(amount, user) {
		const amountToPay = { amount, token: user.token };
		try {
			const response = await fetch(baseURL + "/api/v1/payments", {
				method: "post",
				body: JSON.stringify(amountToPay),
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!response.ok) {
				if (response.status === 400) {
					const responseData = await response.json();
					return responseData;
				}
				const error = new Error(`${response.status}(${response.statusText})`);
				throw error;
			}
			const responseData = await response.json();
			return true;
		} catch (err) {
			return err;
		}
	}
}

export default PaymentClass;
