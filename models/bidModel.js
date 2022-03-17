const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bidSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    uid: {
      type: String,
      // required: true,
    },
  },
  { timestamps: true }
);

const bidModel = mongoose.model("Bid", bidSchema);
module.exports = bidModel;