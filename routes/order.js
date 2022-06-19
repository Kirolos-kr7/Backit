const express = require("express");
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewaresco
const JOI = require("joi"); //use joi to easier form
const dayjs = require("dayjs");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");

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
    return res.send({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    let thisOrder = await orderModel.updateOne({ _id: orderID }, order);

    if (thisOrder.modifiedCount > 0)
      return res.send({ message: "Order Activated Successfully", ok: true });
  } catch (err) {
    console.log(err);
  }
});

orderRouter.get("/user", authValidation, async (req, res) => {
  let { user } = res.locals;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

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

    return res.send({ data: { orders, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

orderRouter.get("/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;

  if (orderID.length !== 24)
    return res.send({ message: "Incorrect order id", ok: false });

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

    if (order) return res.send({ data: order, ok: true });
    return res.send({ message: "No order with this id", ok: false });
  } catch (err) {
    console.log(err);
  }
});

module.exports = orderRouter;
