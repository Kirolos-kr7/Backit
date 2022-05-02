const dayjs = require("dayjs");
const express = require("express");
const JOI = require("joi"); //use joi to easier form
const analyticsModel = require("../models/analyticsModel");
const bidModel = require("../models/bidModel"); //import to bidModel
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
      let bid = await bidModel.findById(bidID).select("status");
      if (!bid && (bid.status === "canceled" || bid.status === "expired"))
        return;

      await bidModel.updateOne({ _id: bidID }, { status });
    } catch (err) {
      console.log(err);
    }
  }, diff);
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

//view all bids
bidRouter.get("/all", async (req, res) => {
  try {
    let bids = await bidModel
      .find()
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
