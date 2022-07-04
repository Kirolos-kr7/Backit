/* Importing the userModel from the models folder. */
const userModel = require("../models/userModel");

/**
 * It takes in a userID, title, message, and redirect, and then it finds the user by the userID, pushes
 * the title, message, and redirect to the user's notifications array, and then saves the user
 * and returns Nothing.
 */
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

/* Exporting the function `sendNotification` so that it can be used in other files. */
module.exports = { sendNotification };
