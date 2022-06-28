const userModel = require("../models/userModel");

const sendNotification = async ({ userID, title, message, redirect }) => {
  try {
    let user = await userModel.findById(userID);

    await user.notifications.push({
      title,
      message,
      redirect,
    });

    await user.save();
  } catch (err) {
    return res.status(400).json({ message: err.message, ok: false });
  }
};

module.exports = { sendNotification };
