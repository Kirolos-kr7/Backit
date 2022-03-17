const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const itemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: {
      type: Array,
      // required: true,
    },
    uid: {
      type: String,
      // required: true,
    },
  },
  { timestamps: true }
);

const itemModel = mongoose.model("Item", itemSchema);
module.exports = itemModel;
