const dayjs = require("dayjs");
const express = require("express");
const JOI = require("joi"); //use joi to easier form
const { Types } = require("mongoose");
const analyticsModel = require("../models/analyticsModel");
const bidModel = require("../models/bidModel"); //import to bidModel
const orderModel = require("../models/orderModel");
const { sendNotification } = require("../utils/notification");
const spawn = require("child_process").spawn;

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
    return res.send({
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
      return res.send({
        message: "Start date must be before End date",
        ok: false,
      });

    if (diffStartDays > 3 || diffStartDays < 0)
      return res.send({
        message: "Start date must be between now and three days from now",
        ok: false,
      });

    if (diffEndDays > 21 || diffEndDays < 0)
      return res.send({
        message: "End date must be between start date and 21 days from now",
        ok: false,
      });

    let newBid = await bidModel.create(bid);

    let diffStart = startDate.diff(now, "ms");
    let diffEnd = endDate.diff(now, "ms");

    if (newBid) {
      changeBidStatus("active", diffStart, newBid._id);
      changeBidStatus("expired", diffEnd, newBid._id);

      return res.send({ data: newBid, ok: true });
    }
  } catch (err) {
    console.log(err);
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
            bidID,
            auctioneer: bid.user._id,
            bidder: highestBid.user,
            price: highestBid.price,
            pickupTime: dayjs().add(2, "d"),
            pickupAddress: bid.user.address,
          });

          console.log(newOrder);

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
              redirect: `/orders/${newOrder._id}`,
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

  if (!bidID) {
    return res.send({
      message: "bid Id is required",
      ok: false,
    });
  }

  try {
    let bid = await bidModel.findById(bidID).select("user status");

    if (JSON.stringify(user.id) !== JSON.stringify(bid.user))
      return res.send({
        message: "Access Denied!",
        ok: true,
      });

    if (bid.status === "soon") {
      await bidModel.deleteOne({
        _id: bidID,
      });

      return res.send({
        message: "Bid Deleted successfully",
        ok: true,
      });
    } else if (bid.status === "active") {
      await bidModel.updateOne({ _id: bidID }, { status: "canceled" });
      return res.send({
        message: "Bid Canceled successfully",
        ok: true,
      });
    } else {
      return res.send({
        message: "Bid Already " + bid.status,
        ok: true,
      });
    }
  } catch (err) {
    console.log(err);
  }
});

bidRouter.get("/recommended", authValidation, async (req, res) => {
  let { user } = res.locals;

  let analytics = await analyticsModel.find().select({ _id: 0 });
  let jsonAnalytics = JSON.stringify(analytics);

  const pythonProcess = spawn("python", [
    "./recommendation_engine/you_might_like.py",
    jsonAnalytics,
    user.id,
  ]);

  pythonProcess.stdout.on("data", async (data) => {
    let result = data.toString().trim();

    if (result != "N/F") {
      let bidIds = result.split(" ");

      let recommendedBids = await bidModel
        .find({ _id: { $in: bidIds }, user: { $ne: user.id } })
        .limit(4)
        .populate("item");

      return res.send({ data: recommendedBids, ok: true });
    } else {
      return res.send({ message: "No Data Found", ok: false });
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.log(data.toString());
  });
});

bidRouter.get("/similar/:bidID", async (req, res) => {
  let { bidID } = req.params;

  let analytics = await analyticsModel.find().select({ _id: 0 });
  let jsonAnalytics = JSON.stringify(analytics);

  const pythonProcess = spawn("python", [
    "./recommendation_engine/similar_bids.py",
    jsonAnalytics,
    bidID,
  ]);

  pythonProcess.stdout.on("data", async (data) => {
    let result = data.toString().trim();

    if (result != "N/F") {
      let bidIds = result.split(" ");
      let similarBids = await bidModel
        .find({ _id: { $in: bidIds } })
        .populate("item");
      return res.send({ data: similarBids, ok: true });
    } else {
      return res.send({ message: "No Data Found", ok: false });
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
      recentBids.push(Types.ObjectId(item.bidID));
    });

    let bids = await bidModel
      .find({
        _id: {
          $in: recentBids,
        },
      })
      .populate("item", "name type images");

    res.send({ data: bids, ok: true });
  } catch (err) {
    console.log(err);
  }
});

//view all bids
bidRouter.get("/all", async (req, res) => {
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;
  let sortBy = req.query.sortBy || "endDate";
  let dir = req.query.dir || -1;

  try {
    let count = await bidModel.count();

    let bids = await bidModel
      .find()
      .sort([[sortBy, dir]])
      .skip(skip)
      .limit(limit)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: { count, bids }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

//view all bids for special user
bidRouter.get("/sales", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let bids = await bidModel
      .find({ user: user.id })
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: bids, ok: true });
  } catch (err) {
    console.log(err);
  }
});

bidRouter.get("/purchases", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let bids = await bidModel
      .find({ "bidsHistory.user": user.id })
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: bids, ok: true });
  } catch (err) {
    console.log(err);
  }
});

bidRouter.get("/category/:cat", async (req, res) => {
  const { cat } = req.params;

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

      if (index === bids.length - 1)
        return res.send({ data: filteredBids, ok: true });
    });
  } catch (err) {
    console.log(err);
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
        return res.send({ data: filteredBids, ok: true });
    });
  } catch (err) {
    console.log(err);
  }
});

module.exports = { bidRouter, reviveServer };
