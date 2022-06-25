const express = require("express");
const authValidation = require("../middlewares/authValidation");
const JOI = require("joi");
const dayjs = require("dayjs");
const orderModel = require("../models/orderModel");
const { sendNotification } = require("../utils/notification");
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
    return res.status(404).json({ message: "Order Not Found", ok: false });

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

orderRouter.patch("/cancel/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;

  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Order Not Found", ok: false });

  try {
    let order = await orderModel.findById(orderID);

    if (user.id !== order.auctioneer.toString())
      return res.status(403).json({ message: "Forbidden", ok: false });

    if (order.status !== "pending")
      return res
        .status(400)
        .json({ message: "Order Cannot be canceled", ok: false });

    let updatedOrder = await orderModel.updateOne(
      { _id: orderID },
      { status: "canceled" }
    );

    if (updatedOrder.modifiedCount > 0)
      sendNotification({
        userID: order.bidder,
        title: {
          ar: "قام مالك المزاد بألغاء الطلب",
          en: "Auctioneer canceled the order",
        },
        message: {
          ar: "قام مالك المزاد الذي فزت بألغاء الطلب.",
          en: "The auctioneer for the bid you've won has canceled the order.",
        },
        redirect: `/account/order/${order._id}`,
      });

    sendNotification({
      userID: order.auctioneer,
      title: {
        ar: "تم الغاء الطلب بنجاح",
        en: "Order Canceled Successfully",
      },
      message: {
        ar: "لقد قمنا بالغاء الطلب بناءاً على طلبك.",
        en: "We've canceled the order as you've requested.",
      },
      redirect: `/account/order/${order._id}`,
    });

    return res
      .status(200)
      .json({ message: "Order Canceled Successfully", ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

orderRouter.patch("/retract/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;

  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Order Not Found", ok: false });

  try {
    let order = await orderModel.findById(orderID).populate("bid");

    if (user.id !== order.bidder.toString())
      return res.status(403).json({ message: "Forbidden", ok: false });

    if (order.status !== "pending")
      return res
        .status(400)
        .json({ message: "Order Cannot be canceled", ok: false });

    await orderModel.updateOne({ _id: orderID }, { status: "canceled" });

    sendNotification({
      userID: order.bidder,
      title: {
        ar: "تم الغاء الطلب بنجاح",
        en: "Order Canceled Successfully",
      },
      message: {
        ar: "لقد قمنا بالغاء الطلب بناءاً على طلبك.",
        en: "We've canceled the order as you've requested.",
      },
      redirect: `/account/order/${order._id}`,
    });

    res.status(200).json({ message: "Order Canceled Successfully", ok: true });

    let nextBid = {};
    let bidsHistory = order.bid.bidsHistory.reverse();

    let canceledOrdersForCurrentBid = await orderModel
      .find({
        bid: order.bid,
        status: "canceled",
      })
      .select("bidder price");

    let rejectedUsers = canceledOrdersForCurrentBid.map((order) =>
      order.bidder.toString()
    );

    let eligableUsers = bidsHistory.filter(
      (bid) => !rejectedUsers.includes(bid.user)
    );

    nextBid = eligableUsers[0];
    console.log(nextBid);

    if (!nextBid) {
      sendNotification({
        userID: order.auctioneer,
        title: {
          ar: "للأسف. تم الغاء الطلب عن طريق المزايد.",
          en: "Oops. order was canceled by bidder.",
        },
        message: {
          ar: "للأسف. المزايد الغى الطلب ولم نتمكن من ايجاد بديل. يمكنك بدء المزاد من جديد.",
          en: "Oops. bidder canceled the order and we didn't find a replacement. You can repost the bid again.",
        },
      });
      return;
    }

    let nextOrder = {
      bid: order.bid,
      auctioneer: order.auctioneer,
      bidder: nextBid.user,
      price: nextBid.price,
      pickupTime: dayjs().add(2, "d"),
      pickupAddress: order.pickupAddress,
    };

    let newOrder = await orderModel.create(nextOrder);

    sendNotification({
      userID: order.auctioneer,
      title: {
        ar: "المزايد الغى الطلب ولكننا وجدنا بديل",
        en: "The bidder canceled the order but we found a replacement",
      },
      message: {
        ar: "المزايد الغى الطلب ولكننا تمكننا من ايجاد بديل. تفقد الطلب الجديد.",
        en: "The bidder canceled the order but we managed to find a replacement. checkit out.",
      },
      redirect: `/account/order/${newOrder._id}`,
    });

    await sendNotification({
      userID: nextBid.user,
      title: {
        ar: "مبروك. لقد ربحت المزاد",
        en: "You just won the bid!",
      },
      message: {
        ar: "اذهب لتفعيل الطلب الخاص بك",
        en: "Go activate your order",
      },
      redirect: `/account/order/${newOrder._id}`,
    });
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
      .sort({ createdAt: -1 })
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
