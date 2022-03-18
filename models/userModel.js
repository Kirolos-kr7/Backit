const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        uid: {
          type: String,
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        email:{
            type: String,
            required: true,

        },
        phone: {
          type: Number,
          required: true,
        },
        gender: {
          type: String,
          required: true,
        },
        profilePicture: {
          type: String,
          required: true,
        },
        password: {
            type: String,
            required: true,
        },
        premium: {
            type: Object,
            required: true,

        },
        
      },
      { timestamps: true }
    );

const userModel = mongoose.model("user", userSchema);
module.exports = userModel;