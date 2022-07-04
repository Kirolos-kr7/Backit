/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model, Types } = require("mongoose");

/* Creating a schema for the bid model. */
const bidSchema = new Schema(
  {
    item: { type: Types.ObjectId, ref: "Item", required: true },
    user: { type: Types.ObjectId, ref: "User", required: true },
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
    status: {
      type: String,
      default: "soon",
    },
  },
  { timestamps: true }
);

/* Creating a text index on all fields in the bidSchema. */
bidSchema.index({ "$**": "text" });

/* Creating a model called Bid from the bidSchema. */
const bidModel = model("Bid", bidSchema);
module.exports = bidModel;
