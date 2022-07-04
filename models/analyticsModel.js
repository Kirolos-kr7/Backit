/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model } = require("mongoose");

/* This is creating a new schema for the analytics collection. */
const analyticsSchema = new Schema(
  {
    bidID: { type: String, required: true },
    bidderID: { type: String, required: true },
    viewed: { type: Number, default: 1 },
  },
  { timestamps: true }
);

/* Creating a new model for the analytics collection. */
const analyticsModel = model("Analytics", analyticsSchema);
module.exports = analyticsModel;
