const { Schema, model, Types } = require("mongoose");

const orderSchema = new Schema(
  {
    bidID: { type: Types.ObjectId, ref: "Bid", required: true },
    bidder: { type: Types.ObjectId, ref: "User", required: true },
    auctioneer: { type: Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      default: "pending",
      lowercase: true,
    },
    paymentMethod: {
      type: String,
      default: "NF",
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

const orderModel = model("Order", orderSchema);
module.exports = orderModel;
