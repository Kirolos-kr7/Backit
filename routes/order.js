const express = require("express");
const authValidation = require("../middlewares/authValidation");
const JOI = require("joi");
const dayjs = require("dayjs");
const orderModel = require("../models/orderModel");
const { sendNotification } = require("../utils/notification");
const ObjectId = require("mongoose").Types.ObjectId;

const orderRouter = express.Router();

/* A validation schema for the order object. */
const orderSchema = JOI.object({
  status: JOI.string().required(),
  paymentMethod: JOI.string().required(),
  arrivalTime: JOI.date().required(),
  arrivalAddress: JOI.string().required(),
  shipping: JOI.number().required(),
});

orderRouter.patch("/activate/:orderID", authValidation, async (req, res) => {
  let { orderID } = req.params;

  /* Checking if the orderID is valid or not. */
  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Order Not Found", ok: false });

  /* Creating an object with the properties of the order. */
  let order = {
    paymentMethod: req.body.paymentMethod,
    arrivalAddress: req.body.arrivalAddress,
    arrivalTime: dayjs().add(4, "d").$d,
    status: "active",
    shipping: 10,
  };

  /* Validating the order object. */
  try {
    await orderSchema.validateAsync(order);
  } catch (err) {
    return res.status(400).json({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    /* Updating the order with the new data. */
    let thisOrder = await orderModel.updateOne({ _id: orderID }, order);

    /* Checking if the order was modified or not. */
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

  /* Checking if the orderID is valid or not. */
  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Order Not Found", ok: false });

  try {
    /* Finding the order by the id. */
    let order = await orderModel.findById(orderID);

    /* Checking if the user is the auctioneer or not. */
    if (user.id !== order.auctioneer.toString())
      return res.status(403).json({ message: "Forbidden", ok: false });

    /* Checking if the order status is pending or not. */
    if (order.status !== "pending")
      return res
        .status(400)
        .json({ message: "Order Cannot be canceled", ok: false });

    /* Updating the order status to canceled. */
    let updatedOrder = await orderModel.updateOne(
      { _id: orderID },
      { status: "canceled" }
    );

    /* Checking if the order was modified or not. */
    if (updatedOrder.modifiedCount > 0)
      /* Sending a notification to the bidder that the auctioneer has canceled the order. */
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

    /* Sending a notification to the auctioneer. */
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

  /* Checking if the orderID is valid or not. */
  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Order Not Found", ok: false });

  try {
    /* Finding the order by the id and populating the bid field. */
    let order = await orderModel.findById(orderID).populate("bid");

    /* Checking if the user is the bidder or not. */
    if (user.id !== order.bidder.toString())
      return res.status(403).json({ message: "Forbidden", ok: false });

    /* Checking if the order status is pending or not. */
    if (order.status !== "pending")
      return res
        .status(400)
        .json({ message: "Order Cannot be canceled", ok: false });

    /* Updating the order status to canceled. */
    await orderModel.updateOne({ _id: orderID }, { status: "canceled" });

    /* Sending a notification to the bidder that the auctioneer has canceled the order. */
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

    /* Sending a response to the client. */
    res.status(200).json({ message: "Order Canceled Successfully", ok: true });

    let nextBid = {};
    let bidsHistory = order.bid.bidsHistory.reverse();

    /* Finding all the canceled orders for the current bid. */
    let canceledOrdersForCurrentBid = await orderModel
      .find({
        bid: order.bid,
        status: "canceled",
      })
      .select("bidder price");

    /* Mapping the bidder id to a string. */
    let rejectedUsers = canceledOrdersForCurrentBid.map((order) =>
      order.bidder.toString()
    );

    /* Filtering the bidsHistory array to get the users that are not in the rejectedUsers array. */
    let eligableUsers = bidsHistory.filter(
      (bid) => !rejectedUsers.includes(bid.user)
    );

    nextBid = eligableUsers[0];

    /* Sending a notification to the auctioneer that the bidder canceled the order and there is no
    replacement. */
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

    /* Creating an object with the properties of the order. */
    let nextOrder = {
      bid: order.bid,
      auctioneer: order.auctioneer,
      bidder: nextBid.user,
      price: nextBid.price,
      pickupTime: dayjs().add(2, "d"),
      pickupAddress: order.pickupAddress,
    };

    /* Creating an object with the properties of the order. */
    let newOrder = await orderModel.create(nextOrder);

    /* Sending a notification to the auctioneer that the bidder canceled the order and there is a replacement. */
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

    /* Sending a notification to the bidder that he won the bid. */
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
    /* Counting the number of orders that the user has. */
    let count = await orderModel.count({
      $or: [{ bidder: user.id }, { auctioneer: user.id }],
    });

    /* A query to get all the orders that the user has. */
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

    /* Returning the orders and the count of the orders. */
    return res.status(200).json({ data: { orders, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

orderRouter.get("/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;

  /* Checking if the orderID is valid or not. */
  if (!ObjectId.isValid(orderID))
    return res.status(404).json({ message: "Incorrect order id", ok: false });

  try {
    /* Finding the order by the id and populating the bid field. */
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

    /* Checking if the order exists or not. If it exists, it will return the order. */
    if (order) return res.status(200).json({ data: order, ok: true });
    return res
      .status(400)
      .json({ message: "No order with this id", ok: false });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

module.exports = orderRouter;
