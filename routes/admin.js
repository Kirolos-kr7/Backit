const express = require("express");
const bidModel = require("../models/bidModel");
const userModel = require("../models/userModel");
const JOI = require("joi");
const reportModel = require("../models/reportModel");
const orderModel = require("../models/orderModel");
const logModel = require("../models/logModel");
const banModel = require("../models/banModel");
const ObjectId = require("mongoose").Types.ObjectId;

const adminRouter = express.Router();

adminRouter.get("/users", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let count = await userModel.count();

    let users = await userModel
      .find()
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .select("name email isAdmin gender phone address createdAt");

    res.send({ data: { users, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/searchUsers/:q", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;
  let q = req.params.q;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let query;

    if (q.length === 24) query = { _id: ObjectId(q) };
    else query = { $text: { $search: q } };

    let count = await userModel.count(query);

    let users = await userModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .select("name email isAdmin gender phone address createdAt");

    console.log(users);

    res.send({ data: { users, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.delete("/user-account", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { email, message, days } = req.body;

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let xUser = await banModel.create({ user: email, message, days });

    await logModel.create({
      admin: user.email,
      user: email,
      message: `${user.email} has applied a ${message} for ${email}`,
    });

    if (xUser) {
      res.send({ message: "User Banned Successfully", ok: true });
    } else res.send({ message: "User Ban Failed", ok: false });
  } catch (err) {
    if (err.code === 11000) res.json({ message: "User Already Banned" });
    else res.json({ message: err.message });
  }
});

adminRouter.get("/bids", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let count = await bidModel.count();

    let bids = await bidModel
      .find()
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .select("-bidsHistory -__v")
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: { bids, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/searchBids/:q", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;
  let q = req.params.q;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let query;

    if (q.length === 24)
      query = {
        $or: [
          { _id: ObjectId(q) },
          { item: ObjectId(q) },
          { user: ObjectId(q) },
        ],
      };
    else query = { $text: { $search: q } };

    let count = await bidModel.count(query);

    let bids = await bidModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .select("-bidsHistory -__v")
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: { bids, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.delete("/bid/:bidID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { bidID } = req.params;

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let deletedBid = await bidModel.deleteOne({ _id: bidID });
    if (deletedBid.deletedCount > 0) {
      res.send({ message: "Bid Removed Successfully", ok: true });
    } else res.send({ message: "Bid Removal Failed", ok: false });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/reports", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let count = await reportModel.count();

    let reports = await reportModel
      .find()
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .populate("reporter recipient");

    res.send({ data: { reports, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/searchReports/:q", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;
  let q = req.params.q;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let query;

    if (q.length === 24)
      query = {
        $or: [
          { _id: ObjectId(q) },
          { reporter: ObjectId(q) },
          { recipient: ObjectId(q) },
          { for: ObjectId(q) },
        ],
      };
    else query = { $text: { $search: q } };

    let count = await reportModel.count(query);

    let reports = await reportModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .populate("reporter recipient");

    res.send({ data: { reports, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/notifications", authValidation, async (req, res) => {
  let user = res.locals.user;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  // checking if a user is admin
  if (!user.isAdmin) return res.send({ message: "Access Denied", ok: false });

  try {
    // get main user
    let { notifications } = await userModel
      .findOne({ email: "bidit.platform@gmail.com" })
      .select("notifications");

    let count = notifications.length;

    // sorting user notification from newer to older
    notifications.sort((a, b) => {
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);

      if (aDate < bDate) return 1;
      if (aDate > bDate) return -1;

      return 0;
    });

    let paginatedNotifications = notifications.slice(
      skip,
      parseInt(limit) + parseInt(skip)
    );

    // sending sorted notifications
    return res.send({
      data: {
        notifications: paginatedNotifications,
        count,
      },
      ok: true,
    });
  } catch (err) {
    console.log(err);
  }
});

let ntSchema = JOI.object({
  title: JOI.object({
    en: JOI.string().required(),
    ar: JOI.string().required(),
  }),
  message: JOI.object({
    en: JOI.string().required(),
    ar: JOI.string().required(),
  }),
  redirect: JOI.string().allow(null, ""),
});

adminRouter.post("/broadcast", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { title, message, redirect } = req.body;

  // checking if a user is admin
  if (!user.isAdmin) return res.send({ message: "Access Denied", ok: false });

  try {
    let isValid = ntSchema.validate({ title, message, redirect });
    if (isValid.error)
      return res.send({ message: isValid.error.details[0].message, ok: false });

    // getting all user
    let users = await userModel.find();

    // sending notification for each user in db
    for (let i = 0; i < users.length; i++) {
      users[i].notifications.push({
        title,
        message,
        redirect,
      });

      await users[i].save();
    }

    return res.send({
      message: "Broadcasted Successfully",
      ok: true,
    });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/orders", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let count = await orderModel.count();

    let orders = await orderModel
      .find()
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .populate("bidder auctioneer")
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

    res.send({ data: { orders, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/searchOrders/:q", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;
  let q = req.params.q;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let query;

    if (q.length === 24)
      query = {
        $or: [
          { _id: ObjectId(q) },
          { bid: ObjectId(q) },
          { bidder: ObjectId(q) },
          { auctioneer: ObjectId(q) },
        ],
      };
    else query = { $text: { $search: q } };

    let count = await orderModel.count(query);

    let orders = await orderModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .populate("bidder auctioneer")
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

    res.send({ data: { orders, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.delete("/order/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let deletedOrder = await orderModel.deleteOne({ _id: orderID });
    if (deletedOrder.deletedCount > 0) {
      res.send({ message: "Order Removed Successfully", ok: true });
    } else res.send({ message: "Order Removal Failed", ok: false });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.patch("/edit/:orderID", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { orderID } = req.params;
  let { status } = req.body;

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    if (!status)
      return res.send({ message: "New status is required", ok: false });

    let order = await orderModel.updateOne({ _id: orderID }, { status });

    if (order.modifiedCount > 0)
      return res.send({ message: "Edited Successfully", ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/counts", authValidation, async (req, res) => {
  let { user } = res.locals;

  if (!user.isAdmin) return res.send({ message: "Access Denied!", ok: false });

  Promise.all([
    userModel.count(),
    bidModel.count(),
    orderModel.count(),
    reportModel.count(),
  ])
    .then(([users, bids, orders, reports]) => {
      return res.send({
        data: {
          userCount: users,
          bidCount: bids,
          orderCount: orders,
          reportCount: reports,
        },
        ok: true,
      });
    })
    .catch((err) => {
      console.log(err);
      return res.send({ message: err, ok: false });
    });
});

adminRouter.get("/logs", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { q } = req.query;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let query;

    if (q.trim() === "") query = {};
    else if (q.length === 24) query = { _id: ObjectId(q) };
    else query = { $text: { $search: q } };

    let count = await logModel.count(query);
    let logs = await logModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    res.send({ data: { logs, count }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

module.exports = adminRouter;
