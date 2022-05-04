const dayjs = require("dayjs");
const express = require("express");
const JOI = require("joi"); //use joi to easier form
const { Types } = require("mongoose");
const analyticsModel = require("../models/analyticsModel");
const bidModel = require("../models/bidModel"); //import to bidModel
const { sendNotification } = require("../utils/notification");
const spawn = require("child_process").spawn;

const bidRouter = express.Router();

const bidSchema = JOI.object({
  startDate: JOI.date().required(),
  endDate: JOI.date().required(),
  minPrice: JOI.number().required(),
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

  let now = dayjs();
  let startDate = dayjs(bid.startDate);
  let diffStart = startDate.diff(now, "ms");

  let endDate = dayjs(bid.endDate);
  let diffEnd = endDate.diff(now, "ms");

  if (diffStart < 0)
    return res.send({ message: "Invalid Start Date", ok: false });

  if (diffEnd < 0) return res.send({ message: "Invalid End Date", ok: false });

  try {
    await bidSchema.validateAsync(bid);
  } catch (err) {
    return res.send({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    let newBid = await bidModel.create(bid);

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
      let bid = await bidModel.findById(bidID);
      if (!bid && (bid.status === "canceled" || bid.status === "expired"))
        return;

      await bidModel.updateOne({ _id: bidID }, { status });

      console.log(status);

      if (status === "expired") {
        if (bid.bidsHistory.length > 0) {
          console.log("There is Bids");
          let highestBid = getHighestBid(bid);

          sendNotification({
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

          sendNotification({
            userID: highestBid.user,
            title: {
              ar: "مبروك. لقد ربحت المزاد",
              en: "You just won the bid!",
            },
            message: {
              ar: "تفقد نتيجة المزاد الذي ربحته",
              en: "Checkout the bid you won! ",
            },
            redirect: `/bid/${bidID}`,
          });
        } else {
          console.log("No Bids");
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
    console.log(result);
    if (result != "N/F") {
      let bidIds = result.split(" ");
      let similarBids = await bidModel.find().where("_id").in(bidIds);
      return res.send({ data: similarBids, ok: true });
    } else {
      return res.send({ message: "No Data Found", ok: false });
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.log(data.toString());
  });
});

bidRouter.get("/smilar/:bidID", async (req, res) => {
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
      let similarBids = await bidModel.find().where("_id").in(bidIds);
      return res.send({ data: similarBids, ok: true });
    } else {
      return res.send({ message: "No Data Found", ok: false });
    }
  });
});

bidRouter.get("/recently", authValidation, async (req, res) => {
  let user = res.locals.user;

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
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: bids, ok: true });
  } catch (err) {
    console.log(err);
  }
});

//view all bids
bidRouter.get("/all", async (req, res) => {
  let limit = req.query.limit || 0;
  let sortBy = req.query.sortBy || "createdAt";
  let dir = req.query.dir || -1;

  try {
    let bids = await bidModel
      .find()
      .sort([[sortBy, dir]])
      .limit(limit)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: bids, ok: true });
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

bidRouter.get("/catrgory/:cat", async (req, res) => {
  const { cat } = req.params;

  try {
    let bids = await bidModel
      .find({})
      .populate({
        path: "item",
        match: { type: cat },
        select: "name type description images",
      })
      .populate("user", "name email profilePicture");

    bids.forEach((bid, index) => {
      if (bid.item === null) {
        bids.splice(index, 1);
      }
    });

    res.send({ data: bids, ok: true });
  } catch (err) {
    console.log(err);
  }
});

module.exports = { bidRouter, reviveServer };
