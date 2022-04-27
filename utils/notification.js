const userModel = require("../models/userModel");

const sendNotification = async ({ userID, title, message }) => {
  try {
    let user = await userModel.findById(userID);

    await user.notifications.push({
      title,
      message,
    });

    await user.save();
  } catch (err) {
    console.log(err);
  }
};

module.exports = { sendNotification };
