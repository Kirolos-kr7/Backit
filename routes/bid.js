const dayjs = require("dayjs");
const express = require("express");
const JOI = require("joi");
const analyticsModel = require("../models/analyticsModel");
const bidModel = require("../models/bidModel");
const orderModel = require("../models/orderModel");
const { sendNotification } = require("../utils/notification");
const spawn = require("child_process").spawn;
const ObjectId = require("mongoose").Types.ObjectId;

const bidRouter = express.Router();

const bidSchema = JOI.object({
  startDate: JOI.date(),
  endDate: JOI.date(),
  minPrice: JOI.number().min(1).required(),
  status: JOI.string(),
  bidsHistory: JOI.array().allow(null),
  user: JOI.string().required(),
  item: JOI.string().required(),
});

bidRouter.post("/add", authValidation, async (req, res) => {
  let { user } = res.locals;

  let bid = {
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    minPrice: req.body.minPrice,
    user: user.id,
    item: req.body.item,
  };

  try {
    await bidSchema.validateAsync(bid);
  } catch (err) {
    return res.status(400).json({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    let now = dayjs();
    let startDate = dayjs(bid.startDate);
    let endDate = dayjs(bid.endDate);
    let diffStartDays = startDate.diff(now, "d");
    let diffEndDays = endDate.diff(now, "d");

    if (diffStartDays > diffEndDays)
      return res.status(400).json({
        message: "Start date must be before End date",
        ok: false,
      });

    if (diffStartDays > 3 || diffStartDays < 0)
      return res.status(400).json({
        message: "Start date must be between now and three days from now",
        ok: false,
      });

    if (diffEndDays > 21 || diffEndDays < 0)
      return res.status(400).json({
        message: "End date must be between start date and 21 days from now",
        ok: false,
      });

    let newBid = await bidModel.create(bid);

    let diffStart = startDate.diff(now, "ms");
    let diffEnd = endDate.diff(now, "ms");

    if (newBid) {
      changeBidStatus("active", diffStart, newBid._id);
      changeBidStatus("expired", diffEnd, newBid._id);

      return res.status(200).json({ data: newBid, ok: true });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

const changeBidStatus = async (status, diff, bidID) => {
  setTimeout(async () => {
    try {
      let bid = await bidModel.findById(bidID).populate("user");
      if (!bid && (bid.status === "canceled" || bid.status === "expired"))
        return;

      await bidModel.updateOne({ _id: bidID }, { status });

      if (status === "expired") {
        if (bid.bidsHistory.length > 0) {
          let highestBid = getHighestBid(bid);

          await sendNotification({
            userID: bid.user,
            title: {
              ar: "لقد انتهى المزاد الخاص بك!",
              en: "Your bid just ended!",
            },
            message: {
              ar: "تفقد نتيجة مزادك",
              en: "Checkout your bid result",
            },
            redirect: `/bid/${bidID}`,
          });

          let newOrder = await orderModel.create({
            bid: bidID,
            auctioneer: bid.user._id,
            bidder: highestBid.user,
            price: highestBid.price,
            pickupTime: dayjs().add(2, "d"),
            pickupAddress: bid.user.address,
          });

          if (newOrder) {
            await sendNotification({
              userID: highestBid.user,
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
          }
        } else {
          sendNotification({
            userID: bid.user,
            title: {
              ar: "للأسف. لم ينضم احد الى مزادك.",
              en: "Oops. no one joined your bid.",
            },
            message: {
              ar: "لقد انتهى المزاد الخاص بك! ولم ينضم له احد.",
              en: "Your bid just ended and no one joined.",
            },
            redirect: `/bid/${bidID}`,
          });
        }
      }
    } catch (err) {
      console.log(err);
    }
  }, diff);
};

const getHighestBid = (bid) => {
  let highestBid = { user: null, price: bid.minPrice };

  bid.bidsHistory.forEach((x) => {
    if (x.price > highestBid.price) {
      highestBid = x;
    }
  });

  return highestBid;
};

const reviveServer = async () => {
  try {
    let soonBids = await bidModel
      .find({})
      .select("status startDate endDate")
      .where("status")
      .equals("soon");

    let activeBids = await bidModel
      .find({})
      .select("status endDate")
      .where("status")
      .equals("active");

    if (soonBids.length > 0) {
      soonBids.forEach((bid) => {
        let now = dayjs();
        let startDate = dayjs(bid.startDate);
        let diffStart = startDate.diff(now, "ms");

        let endDate = dayjs(bid.endDate);
        let diffEnd = endDate.diff(now, "ms");

        changeBidStatus("active", diffStart, bid._id);
        changeBidStatus("expired", diffEnd, bid._id);
      });
    }

    if (activeBids.length > 0) {
      activeBids.forEach((bid) => {
        let now = dayjs();

        let endDate = dayjs(bid.endDate);
        let diffEnd = endDate.diff(now, "ms");

        changeBidStatus("expired", diffEnd, bid._id);
      });
    }

    console.log("Server Successfully Restored");
  } catch (err) {
    console.log(err);
  }
};

//delete bid
bidRouter.delete("/delete/:bidID", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { bidID } = req.params;

  if (!ObjectId.isValid(bidID))
    return res.status(404).json({ message: "Incorrect bid id", ok: false });

  try {
    let bid = await bidModel.findById(bidID).select("user status");

    if (JSON.stringify(user.id) !== JSON.stringify(bid.user))
      return res.status(401).json({
        message: "Unauthorized",
        ok: true,
      });

    if (bid.status === "soon") {
      await bidModel.deleteOne({
        _id: bidID,
      });

      return res.status(200).json({
        message: "Bid Deleted successfully",
        ok: true,
      });
    } else if (bid.status === "active") {
      await bidModel.updateOne({ _id: bidID }, { status: "canceled" });
      return res.status(200).json({
        message: "Bid Canceled successfully",
        ok: true,
      });
    } else {
      return res.status(400).json({
        message: "Bid Already " + bid.status,
        ok: true,
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

bidRouter.get("/recommended", authValidation, async (req, res) => {
  let { user } = res.locals;
  let jsonAnalytics = null;

  try {
    let analytics = await analyticsModel.find().select({ _id: 0 });
    jsonAnalytics = JSON.stringify(analytics);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message, ok: false });
  }

  const pythonProcess = spawn("python", [
    "./recommendation_engine/you_might_like.py",
    jsonAnalytics,
    user.id,
  ]);

  pythonProcess.stdout.on("data", async (data) => {
    try {
      let result = data.toString().trim();
      let bidIds = result.split(" ");

      if (result != "N/F" && bidIds.length > 0) {
        let recommendedBids = await bidModel
          .find({ _id: { $in: bidIds }, user: { $ne: user.id } })
          .limit(4)
          .populate("item");

        return res.status(200).json({ data: recommendedBids, ok: true });
      } else {
        return res.status(400).json({ message: "No Data Found", ok: false });
      }
    } catch (err) {
      console.log(err);
      return res.status(400).json({ message: err.message, ok: false });
    }
  });

  pythonProcess.stderr.on("data", (err) => {
    console.log(err);
  });
});

bidRouter.get("/similar/:bidID", async (req, res) => {
  let { bidID } = req.params;
  let jsonAnalytics = null;

  try {
    if (!ObjectId.isValid(bidID))
      return res.status(404).json({ message: "Bid Not Found", ok: false });

    let analytics = await analyticsModel.find().select({ _id: 0 });
    jsonAnalytics = JSON.stringify(analytics);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ message: err.message, ok: false });
  }

  const pythonProcess = spawn("python", [
    "./recommendation_engine/similar_bids.py",
    jsonAnalytics,
    bidID,
  ]);

  pythonProcess.stdout.on("data", async (data) => {
    try {
      let result = data.toString().trim();
      let bidIds = result.split(" ");

      if (result != "N/F" && bidIds.length > 0) {
        let similarBids = await bidModel
          .find({ _id: { $in: bidIds } })
          .populate("item");
        return res.status(200).json({ data: similarBids, ok: true });
      } else
        return res.status(400).json({ message: "No Data Found", ok: false });
    } catch (err) {
      console.log(err);
      return res.status(400).json({ message: err, ok: false });
    }
  });
});

bidRouter.get("/recently", authValidation, async (req, res) => {
  let { user } = res.locals;

  try {
    let anx = await analyticsModel
      .find({ bidderID: user.id })
      .sort([["createdAt", -1]])
      .limit(4)
      .select("bidID");

    let recentBids = [];

    anx.forEach((item) => {
      recentBids.push(ObjectId(item.bidID));
    });

    let bids = await bidModel
      .find({
        _id: {
          $in: recentBids,
        },
      })
      .populate("item", "name type images");

    res.status(200).json({ data: bids, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

//view all bids
bidRouter.get("/all", async (req, res) => {
  let { limit = 0, skip = 0, sortBy = "endDate", dir = -1 } = req.query;

  try {
    let count = await bidModel.count();

    let bids = await bidModel
      .find()
      .sort([[sortBy, dir]])
      .skip(skip)
      .limit(limit)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.status(200).json({ data: { count, bids }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

//view all bids for special user
bidRouter.get("/sales", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { limit = 0, skip = 0 } = req.query;

  try {
    let count = await bidModel.count({ user: user.id });

    let bids = await bidModel
      .find({ user: user.id })
      .limit(limit)
      .skip(skip)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.status(200).json({ data: { bids, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

bidRouter.get("/purchases", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { limit = 0, skip = 0 } = req.query;

  try {
    let count = await bidModel.count({ "bidsHistory.user": user.id });

    let bids = await bidModel
      .find({ "bidsHistory.user": user.id })
      .limit(limit)
      .skip(skip)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.status(200).json({ data: { bids, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

bidRouter.get("/category/:cat", async (req, res) => {
  const { cat } = req.params;
  let { limit = 0, skip = 0 } = req.query;

  try {
    let filteredBids = [];
    let bids = await bidModel
      .find({})
      .populate({
        path: "item",
        match: { type: cat },
        select: "name type description images",
      })
      .populate("user", "name email profilePicture");

    bids.forEach((bid, index) => {
      if (bid.item !== null) {
        filteredBids.push(bid);
      }

      if (index === bids.length - 1) {
        let bidCount = filteredBids.length;
        let paginatedBids = [];
        paginatedBids = filteredBids.slice(
          skip,
          parseInt(skip) + parseInt(limit)
        );

        return res.status(200).json({
          data: { bids: paginatedBids, count: bidCount },
          ok: true,
        });
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

bidRouter.get("/search/:s", async (req, res) => {
  const { s } = req.params;

  try {
    let filteredBids = [];
    let bids = await bidModel
      .find({})
      .populate({
        path: "item",
        match: {
          $or: [
            {
              name: {
                $regex: s,
                $options: "i",
              },
            },
            {
              description: {
                $regex: s,
                $options: "i",
              },
            },
            {
              type: {
                $regex: s,
                $options: "i",
              },
            },
          ],
        },
        select: "-_id name images",
      })
      .select("_id");

    bids.forEach((bid, index) => {
      if (bid.item !== null) {
        filteredBids.push(bid);
      }

      if (index === bids.length - 1)
        return res.status(200).json({ data: filteredBids, ok: true });
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

module.exports = { bidRouter, reviveServer };
