/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model } = require("mongoose");

/* This is creating a new schema for the item model. */
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

/* Creating a new model called "Item" and using the itemSchema as the schema for the model. */
const itemModel = model("Item", itemSchema);
module.exports = itemModel;
