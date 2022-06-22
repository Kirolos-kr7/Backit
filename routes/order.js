const express = require("express");
const authValidation = require("../middlewares/authValidation");
const JOI = require("joi");
const dayjs = require("dayjs");
const orderModel = require("../models/orderModel");
const ObjectId = require("mongoose").Types.ObjectId;

const orderRouter = express.Router();

const orderSchema = JOI.object({
  status: JOI.string().required(),
  paymentMethod: JOI.string().required(),
  arrivalTime: JOI.date().required(),
  arrivalAddress: JOI.string().required(),
  shipping: JOI.number().required(),
});

orderRouter.patch("/activate/:orderID", authValidation, async (req, res) => {
  let { orderID } = req.params;

  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Incorrect order id", ok: false });

  let order = {
    paymentMethod: req.body.paymentMethod,
    arrivalAddress: req.body.arrivalAddress,
    arrivalTime: dayjs().add(4, "d").$d,
    status: "active",
    shipping: 10,
  };

  try {
    await orderSchema.validateAsync(order);
  } catch (err) {
    return res.status(400).json({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    let thisOrder = await orderModel.updateOne({ _id: orderID }, order);

    if (thisOrder.modifiedCount > 0)
      return res
        .status(200)
        .json({ message: "Order Activated Successfully", ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

orderRouter.get("/user", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { limit = 0, skip = 0 } = req.query;

  try {
    let count = await orderModel.count({
      $or: [{ bidder: user.id }, { auctioneer: user.id }],
    });

    let orders = await orderModel
      .find({
        $or: [{ bidder: user.id }, { auctioneer: user.id }],
      })
      .limit(limit)
      .skip(skip)
      .populate({
        path: "bid",
        model: "Bid",
        select: "item",
        populate: {
          path: "item",
          model: "Item",
          select: "-createdAt -updatedAt -uID -__V",
        },
      });

    return res.status(200).json({ data: { orders, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

orderRouter.get("/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;

  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Incorrect order id", ok: false });

  try {
    let order = await orderModel
      .findOne({
        _id: orderID,
        $or: [{ bidder: user.id }, { auctioneer: user.id }],
      })
      .populate({
        path: "bid",
        model: "Bid",
        select: "item",
        populate: {
          path: "item",
          model: "Item",
          select: "-createdAt -updatedAt -uID -__V",
        },
      });

    if (order) return res.status(200).json({ data: order, ok: true });
    return res
      .status(400)
      .json({ message: "No order with this id", ok: false });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

module.exports = orderRouter;
