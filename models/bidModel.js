const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bidSchema = new Schema(
  {
    item: {
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
    uid: {
      type: String,
      // required: true,
    },
  },
  { timestamps: true }
);

const bidModel = mongoose.model("Bid", bidSchema);
module.exports = bidModel;