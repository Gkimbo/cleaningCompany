class ApplicationSerializer {
	static serializeArray(applicationArray) {
		const allowedAttributes = ["id","availability", "email", "experience", "firstName", "lastName", "message", "phone"];
		const serializedApplications = applicationArray.map((application) => {
			const newApplication = {};
			for (const attribute of allowedAttributes) {
				newApplication[attribute] = application.dataValues[attribute];
			}
			return newApplication;
		});
		return serializedApplications;
	}
}

module.exports = ApplicationSerializer;
