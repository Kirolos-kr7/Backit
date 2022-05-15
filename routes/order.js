const express = require("express");
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewaresco
const JOI = require("joi"); //use joi to easier form
const dayjs = require("dayjs");
const orderModel = require("../models/orderModel");

const orderRouter = express.Router();
const orderSchema = JOI.object({
  status: JOI.string().required(),
  paymentMethod: JOI.string().required(),
  arrivalTime: JOI.date().required(),
  shipping: JOI.number().required(),
  address: JOI.string().required(),
});

orderRouter.patch("/activate/:orderID", authValidation, async (req, res) => {
  let { orderID } = req.params;

  let order = {
    paymentMethod: req.body.paymentMethod,
    arrivalAddress: req.body.address,
    status: "active",
    arrivalTime: dayjs().add(4, "d"),
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

  try {
    let order = await orderModel.find({
      $or: [{ bidder: user.id }, { auctioneer: user.id }],
    });

    return res.send({ data: order, ok: true });
  } catch (err) {
    console.log(err);
  }
});

module.exports = orderRouter;
