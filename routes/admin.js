/** IMPORTS **/
const express = require("express");
const bidModel = require("../models/bidModel");
const userModel = require("../models/userModel");
const reportModel = require("../models/reportModel");
const orderModel = require("../models/orderModel");
const logModel = require("../models/logModel");
const banModel = require("../models/banModel");
const JOI = require("joi");
const isAdmin = require("../middlewares/isAdmin");
const ObjectId = require("mongoose").Types.ObjectId;

// create admin router
const adminRouter = express.Router();

adminRouter.get("/users", authValidation, isAdmin, async (req, res) => {
  let { sortBy = "name", dir = "asc", limit = 0, skip = 0, s } = req.query;
  let query = {};

  try {
    if (s) {
      if (ObjectId.isValid(s)) query = { _id: ObjectId(s) };
      else query = { $text: { $search: s } };
    }

    let count = await userModel.count(query);

    let users = await userModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .select("name email isAdmin gender phone address createdAt");

    res.status(200).json({ data: { users, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.patch("/user-role", authValidation, isAdmin, async (req, res) => {
  let user = res.locals.user;
  let email = req.body.email;

  try {
    // checking if a user exists
    let isRegistered = await userModel.findOne({ email });
    if (!isRegistered)
      return res.status(400).json({ message: "User Not Found", ok: false });

    // changing user's admin privlages and saving in db
    let updatedUser = await userModel.updateOne(
      { email },
      { isAdmin: !isRegistered.isAdmin }
    );
    if (updatedUser.modifiedCount > 0) {
      let log = await logModel.create({
        admin: user.email,
        user: isRegistered.email,
        message: !isRegistered.isAdmin
          ? `${user.email} has assigned ${isRegistered.email} as an admin.`
          : `${user.email} has revoked ${isRegistered.email} from being admin.`,
      });

      if (log)
        return res.status(200).json({
          message: "User Role is Changed",
          ok: true,
        });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.delete(
  "/ban-account",
  authValidation,
  isAdmin,
  async (req, res) => {
    let { user } = res.locals;
    let { email, message, days } = req.body;

    try {
      await banModel.create({ user: email, message, days });

      await logModel.create({
        admin: user.email,
        user: email,
        message: `${user.email} has applied a ${message} for ${email}`,
      });

      res.status(200).json({ message: "User Banned Successfully", ok: true });
    } catch (err) {
      if (err.code === 11000)
        res.status(400).json({ message: "User Already Banned", ok: false });
      else res.status(400).json({ message: err.message, ok: false });
    }
  }
);

adminRouter.get("/bids", authValidation, isAdmin, async (req, res) => {
  let { sortBy = "name", dir = "asc", limit = 0, skip = 0, s } = req.query;
  let query = {};

  try {
    if (s) {
      if (ObjectId.isValid(s)) {
        query = {
          $or: [
            { _id: ObjectId(s) },
            { item: ObjectId(s) },
            { user: ObjectId(s) },
          ],
        };
      } else {
        let userID = await emailToUserID(s);
        if (userID) query = { user: userID };
        else query = { $text: { $search: s } };
      }
    }

    let count = await bidModel.count(query);

    let bids = await bidModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .select("-bidsHistory -__v")
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.status(200).json({ data: { bids, count }, ok: true });
  } catch (err) {
    console.log(err);
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.delete("/bid/:bidID", authValidation, async (req, res) => {
  let { bidID } = req.params;

  try {
    let deletedBid = await bidModel.deleteOne({ _id: bidID });

    if (deletedBid.deletedCount > 0)
      res.status(200).json({ message: "Bid Removed Successfully", ok: true });
    else res.status(400).json({ message: "Bid Removal Failed", ok: false });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.get("/orders", authValidation, isAdmin, async (req, res) => {
  let { sortBy = "createdAt", dir = -1, limit = 0, skip = 0, s } = req.query;
  let query = {};

  try {
    if (s) {
      if (ObjectId.isValid(s))
        query = {
          $or: [
            { _id: ObjectId(s) },
            { bid: ObjectId(s) },
            { bidder: ObjectId(s) },
            { auctioneer: ObjectId(s) },
          ],
        };
      else query = { $text: { $search: s } };
    }

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

    res.status(200).json({ data: { orders, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.delete(
  "/order/:orderID",
  authValidation,
  isAdmin,
  async (req, res) => {
    let { orderID } = req.params;

    try {
      let deletedOrder = await orderModel.deleteOne({ _id: orderID });

      if (deletedOrder.deletedCount > 0) {
        res
          .status(200)
          .json({ message: "Order Removed Successfully", ok: true });
      } else
        res.status(400).json({ message: "Order Removal Failed", ok: false });
    } catch (err) {
      res.status(400).json({ message: err.message, ok: false });
    }
  }
);

adminRouter.patch(
  "/edit/:orderID",
  authValidation,
  isAdmin,
  async (req, res) => {
    let { orderID } = req.params;
    let { status } = req.body;

    try {
      if (!status)
        return res
          .status(200)
          .json({ message: "New status is required", ok: false });

      let order = await orderModel.updateOne({ _id: orderID }, { status });

      if (order.modifiedCount > 0)
        return res
          .status(200)
          .json({ message: "Edited Successfully", ok: true });
    } catch (err) {
      res.status(400).json({ message: err.message, ok: false });
    }
  }
);

adminRouter.get("/reports", authValidation, isAdmin, async (req, res) => {
  let { sortBy = "name", dir = "asc", limit = 0, skip = 0, s } = req.query;
  let query = {};

  try {
    if (s) {
      if (ObjectId.isValid(s))
        query = {
          $or: [
            { _id: ObjectId(s) },
            { reporter: ObjectId(s) },
            { recipient: ObjectId(s) },
            { for: ObjectId(s) },
          ],
        };
      else query = { $text: { $search: s } };
    }

    let count = await reportModel.count(query);

    let reports = await reportModel
      .find(query)
      .sort([[sortBy, dir]])
      .limit(limit)
      .skip(skip)
      .populate("reporter recipient");

    res.status(200).json({ data: { reports, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.patch(
  "/feedback/:reportID",
  authValidation,
  isAdmin,
  async (req, res) => {
    let user = res.locals.user;
    const { reportID } = req.params;
    const { status, action, recipient, message, bidID } = req.body;

    if (!reportID) {
      return res.status(400).json({
        message: "ReportID is Required",
        ok: false,
      });
    }

    if (!status) {
      return res.status(400).json({
        message: "status Is Required",
        ok: false,
      });
    }

    try {
      if (status === "took the appropriate action") {
        if (!action)
          res.status(400).json({
            message: "An action is required",
            ok: false,
          });

        banUser({
          email: recipient,
          message,
          days:
            action.toLowerCase() === "ban user for a week and remove bid"
              ? 7
              : 0,
        });

        await bidModel.deleteOne({ _id: bidID });
      }

      await logModel.create({
        admin: user.email,
        user: recipient,
        message: `${user.email} has applied a ${action} for ${recipient}`,
      });

      let feedback = await reportModel.updateOne(
        {
          _id: reportID,
        },
        { status }
      );

      if (feedback.modifiedCount > 0) {
        return res.status(200).json({
          message: "report updated successfully",
          ok: true,
        });
      }
    } catch (err) {
      res.status(400).json({ message: err.message, ok: false });
    }
  }
);

adminRouter.delete("/delete", authValidation, isAdmin, async (req, res) => {
  const reportID = req.body.reportID;

  if (!reportID) {
    return res.status(400).json({
      message: "report Id Is Required",
      ok: false,
    });
  }

  try {
    let deletedreport = await reportModel.deleteOne({
      _id: reportID,
    });

    if (deletedreport.deletedCount > 0) {
      return res.status(200).json({
        message: "report Deleted successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.get("/notifications", authValidation, isAdmin, async (req, res) => {
  let { limit = 0, skip = 0 } = req.query;

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
    return res.status(200).json({
      data: {
        notifications: paginatedNotifications,
        count,
      },
      ok: true,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
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

adminRouter.post("/broadcast", authValidation, isAdmin, async (req, res) => {
  let { title, message, redirect } = req.body;

  try {
    let isValid = ntSchema.validate({ title, message, redirect });
    if (isValid.error)
      return res
        .status(200)
        .json({ message: isValid.error.details[0].message, ok: false });

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

    return res.status(200).json({
      message: "Broadcasted Successfully",
      ok: true,
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

adminRouter.get("/counts", authValidation, isAdmin, async (req, res) => {
  Promise.all([
    userModel.count(),
    bidModel.count(),
    orderModel.count(),
    reportModel.count(),
  ])
    .then(([users, bids, orders, reports]) => {
      return res.status(200).json({
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
      res.status(400).json({ message: err.message, ok: false });
    });
});

adminRouter.get("/logs", authValidation, isAdmin, async (req, res) => {
  let { limit = 0, skip = 0, s } = req.query;
  let query = {};

  try {
    if (s) {
      if (ObjectId.isValid(s)) query = { _id: ObjectId(s) };
      else query = { $text: { $search: s } };
    }

    let count = await logModel.count(query);
    let logs = await logModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    res.status(200).json({ data: { logs, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

const banUser = async ({ email, message, days = 0 }) => {
  let xUser = await banModel.create({ user: email, message, days });
  if (xUser) return 1;
};

const emailToUserID = async (s) => {
  const E_REGEX = /\S+@\S+\.\S+/;
  if (E_REGEX.test(s)) {
    let user = await userModel.findOne({ email: s }).select("_id");
    if (user) return user._id;
  }
  return s;
};

// export admin router
module.exports = adminRouter;
