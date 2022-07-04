/* Destructuring the mongoose module. */
const { Schema, model, Types } = require("mongoose");

/* Creating a schema for the order model. */
const orderSchema = new Schema(
  {
    bid: { type: Types.ObjectId, ref: "Bid", required: true },
    bidder: { type: Types.ObjectId, ref: "User", required: true },
    auctioneer: { type: Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      default: "pending",
      lowercase: true,
    },
    paymentMethod: {
      type: String,
      default: "",
      lowercase: true,
    },
    price: {
      type: Number,
      required: true,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    pickupTime: {
      type: Date,
    },
    arrivalTime: {
      type: Date,
    },
    pickupAddress: {
      type: String,
      default: "",
    },
    arrivalAddress: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

/* Creating a text index on all fields in the schema. */
orderSchema.index({ "$**": "text" });

/* Creating a model called "Order" based on the orderSchema. */
const orderModel = model("Order", orderSchema);
module.exports = orderModel;
