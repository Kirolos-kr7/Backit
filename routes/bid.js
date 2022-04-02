const express = require("express");
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
  itemID: JOI.string().required(),
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
    itemID: req.body.itemID,
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
    let newBid = new bidModel(bid);
    let addedBid = await newBid.save();

    if (addedBid) {
      return res.send({
        data: addedBid,
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
      message: "bid Id Is required",
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
bidRouter.get("/all_bids", async (req, res) => {
  let bidStatus = req.body.bidStatus;

  if (
    bidStatus !== "active" &&
    bidStatus !== "soon" &&
    bidStatus !== "expired" &&
    bidStatus !== "canceled"
  )
    return res.send({ message: "Invalid bid status", ok: false });

  try {
    let bids = await bidModel.find({ status: bidStatus });

    let allBids = await getAllItems(bids);

    res.send({ data: allBids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//view all bids for special user
bidRouter.get("/sales", authValidation, async (req, res) => {
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
    let bids = await bidModel.find({ uID: user.id, status: bidStatus });

    let salesBids = await getAllItems(bids);

    res.send({ data: salesBids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//view special bid
bidRouter.get("/view", async (req, res) => {
  const id = req.body.bidID;
  try {
    let bid = await bidModel.findOne({ _id: id });
    let item = await getItem(bid);

    res.send({ data: { bid, item }, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

bidRouter.get("/join", authValidation, async (req, res) => {
  let user = res.locals.user;
  let bidID = req.body.bidID;
  let bidPrice = req.body.bidPrice;

  try {
    let bid = await bidModel.findOne(
      { _id: bidID },
      { $push: { bidsHistory: { userID: user.id, price: bidPrice } } }
    );

    res.send(bid);

    res.send({ data: { bid, item }, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

const getItem = async (bid) => {
  let uID = bid.uID;
  let itemID = bid.itemID;
  let requiredItem = null;

  let { inventory } = await userModel.findOne({
    _id: uID,
  });

  inventory.forEach((item) => {
    if (item.id == itemID) {
      requiredItem = item;
    }
  });

  return requiredItem;
};

const getAllItems = async (bids) => {
  let bidWithItem = [];

  for (let i = 0; i < bids.length; i++) {
    let bid = bids[i];
    let item = await getItem(bid);
    bidWithItem.push({ bid, item });
  }

  return bidWithItem;
};

module.exports = bidRouter;
