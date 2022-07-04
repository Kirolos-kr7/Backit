/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model } = require("mongoose");

/* Creating a schema for the notifications model. */
const notificationSchema = new Schema(
  {
    title: {
      type: Object,
      required: [true, "Notification Title is Required"],
    },
    message: {
      type: Object,
      required: [true, "Notification Content is Required"],
    },
    redirect: {
      type: String,
      default: null,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* Creating a schema for the user model. */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "User Name is Required"],
      min: [2, "User Name should be 2 or more charchters"],
      max: [26, "User Name should be 26 or less charchters"],
    },
    email: {
      type: String,
      required: [true, "User Email is Required"],
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, "User Phone Number is Required"],
    },
    address: {
      type: String,
      min: [2, "User Address should be 2 or more charchters"],
      required: [true, "User Address is Required"],
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      required: [true, "User Gender is Required"],
      lowercase: true,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    profilePicture: {
      type: Object,
      default: null,
    },
    password: {
      type: String,
      required: [true, "User Password is Required"],
      min: [8, "User Password should be 8 or more charchters"],
      max: [32, "User Password should be 32 or less charchters"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    notifications: [notificationSchema],
  },
  { timestamps: true }
);

/* Creating a text index on all fields in the userSchema. */
userSchema.index({ "$**": "text" });

/* Creating a model called User and using the userSchema to create it. */
const userModel = model("User", userSchema);
module.exports = userModel;
