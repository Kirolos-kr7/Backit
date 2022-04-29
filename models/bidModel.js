const mongoose = require("mongoose"); // connect to db
const Schema = mongoose.Schema; //build schema

//the form of the schema
const bidSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    minPrice: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    bidsHistory: {
      type: Array,
      default: [],
    },
  },
  { timestamps: true }
);

const bidModel = mongoose.model("Bid", bidSchema);
module.exports = bidModel;
