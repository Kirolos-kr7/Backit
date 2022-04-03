const mongoose = require("mongoose"); // connect to db
const Schema = mongoose.Schema; //build schema

//the form of the schema
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
    },
    uID: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const itemModel = mongoose.model("Item", itemSchema);
module.exports = itemModel;
