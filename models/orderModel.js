const { Schema, model, Types } = require("mongoose");

const orderSchema = new Schema(
  {
    bidID: { type: Types.ObjectId, ref: "Bid", required: true },
    status: {
      type: String,
      required: true,
      default: "pending",
      lowercase: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      default: "NF",
      lowercase: true,
    },
    arrivalTime: {
      type: Date,
    },
    price: {
      type: Number,
      required: true,
    },
    shipping: {
      type: Number,
      required: true,
      default: 0,
    },
    address: {
      type: String,
      required: true,
      default: "",
    },
  },
  { timestamps: true }
);

const orderModel = model("Order", orderSchema);
module.exports = orderModel;
