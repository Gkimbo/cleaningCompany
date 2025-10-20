class ApplicationSerializer {
	static serializeArray(applicationArray) {
	  // Updated allowed attributes to match the new form fields
	  const allowedAttributes = [
		"id",
		"firstName",
		"lastName",
		"email",
		"phone",
		"experience",
		"message",
		"idPhoto",
		"backgroundConsent",
	  ];
  
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
  
