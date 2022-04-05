const express = require("express");
const { string } = require("joi");
const JOI = require("joi"); //use joi to easier form
const bidModel = require("../models/bidModel"); //import to bidModel
const userModel = require("../models/userModel"); //import to userModel

const bidRouter = express.Router();

const bidSchema = JOI.object({
  startDate: JOI.date().required(),
  endDate: JOI.date().required(),
  minPrice: JOI.number().required(),
  status: JOI.string().required(),
  bidsHistory: JOI.array().allow(null),
  uID: JOI.string().required(),
  item: JOI.string().required(),
});

bidRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let bid = {
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    minPrice: req.body.minPrice,
    status: req.body.status,
    bidsHistory: [],
    uID: user.id,
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
    let newBid = await bidModel.create(bid);

    if (newBid) {
      return res.send({
        data: newBid,
        message: "Added bid successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//delete bid
bidRouter.delete("/delete", authValidation, async (req, res) => {
  let user = res.locals.user;
  let bidID = req.body.bidID;

  if (!bidID) {
    return res.send({
      message: "bid Id is required",
      ok: false,
    });
  }

  try {
    let response = await bidModel.deleteOne({
      _id: bidID,
    });

    if (response.deletedCount > 0) {
      return res.send({
        message: "Delete bid successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//view all bids
bidRouter.get("/all", async (req, res) => {
  let bidStatus = req.body.bidStatus;

  if (
    bidStatus !== "active" &&
    bidStatus !== "soon" &&
    bidStatus !== "expired" &&
    bidStatus !== "canceled"
  )
    return res.send({ message: "Invalid bid status", ok: false });

  try {
    let bids = await bidModel.find({ status: bidStatus }).populate("item");

    res.send({ data: bids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//view all bids for special user
bidRouter.get("/sales", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let bids = await bidModel.find({ uID: user.id }).populate("item");

    res.send({ data: bids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

bidRouter.get("/purchases", authValidation, async (req, res) => {
  let user = res.locals.user;
  let bidStatus = req.body.bidStatus;

  if (
    bidStatus !== "active" &&
    bidStatus !== "soon" &&
    bidStatus !== "expired" &&
    bidStatus !== "canceled"
  )
    return res.send({ message: "Invalid bid status", ok: false });

  try {
    let bids = await bidModel
      .find({ uID: user.id, status: bidStatus })
      .populate("item");

    res.send({ data: bids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//view special bid
bidRouter.get("/view", async (req, res) => {
  const bidID = req.body.bidID;

  try {
    let bid = await bidModel.findById(bidID).populate("item");

    res.send({ data: bid, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

bidRouter.get("/join", authValidation, async (req, res) => {
  let user = res.locals.user;
  let bidID = req.body.bidID;
  let bidPrice = req.body.bidPrice;

  try {
    let bid = await bidModel.findOne({ _id: bidID }).select("status");
    if (bid.status !== "active") {
      return res.send({ message: "Sorry, Bid is not active", ok: false });
    }
    let updatedBid = await bidModel.updateOne(
      { _id: bidID },
      { $push: { bidsHistory: { uID: user.id, price: bidPrice } } }
    );
    if (updatedBid.modifiedCount > 0) {
      res.send({ message: "You Joined the bid", ok: true });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

module.exports = bidRouter;
