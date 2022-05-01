const dayjs = require("dayjs");
const express = require("express");
const JOI = require("joi"); //use joi to easier form
const bidModel = require("../models/bidModel"); //import to bidModel
const { calcStatus } = require("../utils/socketConnection");

const bidRouter = express.Router();

const bidSchema = JOI.object({
  startDate: JOI.date().required(),
  endDate: JOI.date().required(),
  minPrice: JOI.number().required(),
  status: JOI.string().required(),
  bidsHistory: JOI.array().allow(null),
  user: JOI.string().required(),
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
    let newBid = await bidModel.create(bid);

    if (newBid) {
      return res.send({
        data: newBid,
        message: "Added bid successfully",
        ok: true,
      });
    }
  } catch (err) {
    console.log(err);
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
    console.log(err);
  }
});

//view all bids
bidRouter.get("/all", async (req, res) => {
  try {
    let bids = await bidModel
      .find()
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    let BWS = bidsWithStatus(bids);

    res.send({ data: BWS, ok: true });
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

    let BWS = bidsWithStatus(bids);

    res.send({ data: BWS, ok: true });
  } catch (err) {
    console.log(err);
  }
});

bidRouter.get("/purchases", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let bids = await bidModel
      .find({ "bidsHistory.userID": user.id })
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    let BWS = bidsWithStatus(bids);

    res.send({ data: BWS, ok: true });
  } catch (err) {
    console.log(err);
  }
});

//get bids by category ## ERRORRRRR
// Needs to be completed
bidRouter.get("/:cat", async (req, res) => {
  const cat = req.params.cat;

  try {
    let bids = await bidModel
      .find({})
      .populate({
        path: "item",
        match: { type: cat },
        select: "name type description images",
      })
      .populate("user", "name email profilePicture");

    let BWS = bidsWithStatus(bids);

    res.send({ data: BWS, ok: true });
  } catch (err) {
    console.log(err);
  }
});

const bidsWithStatus = (bids) => {
  let xBids = [];

  bids.forEach((bid) => {
    let newBid = {
      status: calcStatus(bid),
      item: bid.item,
      user: bid.user,
      _id: bid._id,
      minPrice: bid.minPrice,
      startDate: bid.startDate,
      endDate: bid.endDate,
      bidsHistory: bid.bidsHistory,
      createdAt: bid.createdAt,
      updatedAt: bid.updatedAt,
      __v: bid.__v,
    };
    xBids.push(newBid);
  });

  return xBids;
};

module.exports = bidRouter;
