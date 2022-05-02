const mongoose = require("mongoose"); // connect to db
const Schema = mongoose.Schema; //build schema

//the form of the schema
const analyticsSchema = new Schema(
  {
    bidID: { type: String, required: true },
    bidderID: { type: String, required: true },
    viewed: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const analyticsModel = mongoose.model("Analytics", analyticsSchema);
module.exports = analyticsModel;
