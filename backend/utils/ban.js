const getBanMessage = (student) =>
  student.banReason
    ? `Your account has been banned. Reason: ${student.banReason}`
    : "Your account has been banned. Please contact the administrator.";

module.exports = { getBanMessage };
