const mongoose = require("mongoose"); // connect to db
const Schema = mongoose.Schema; //build schema

//the form of the schema
const bidSchema = new Schema(
  {
    itemID: {
      type: String,
      //required: true,
    },
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
    uID: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      lowercase: true,
    }
  },
  { timestamps: true }
);

const bidModel = mongoose.model("Bid", bidSchema);
module.exports = bidModel;