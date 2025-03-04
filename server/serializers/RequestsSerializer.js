class RequestSerializer {
  static serializeOne(request) {
    const allowedAttributes = ["id", "employeeId", "appointmentId", "status"];

    const newRequest = {};
    for (const attribute of allowedAttributes) {
      newRequest[attribute] = request.dataValues[attribute];
    }
    return newRequest;
  }
}

module.exports = RequestSerializer;
