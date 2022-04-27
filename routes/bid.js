const dayjs = require("dayjs");
const express = require("express");
const { sendNotification } = require("../utils/notification"); //connect to userModel
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
  try {
    let bids = await bidModel
      .find()
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    for (let i = 0; i < bids.length; i++) {
      bids[i].status = calcStatus(bids[i]);
    }

    res.send({ data: bids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
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

    for (let i = 0; i < bids.length; i++) {
      bids[i].status = calcStatus(bids[i]);
    }

    res.send({ data: bids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

bidRouter.get("/purchases", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let bids = await bidModel
      .find({ "bidsHistory.userID": user.id })
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    for (let i = 0; i < bids.length; i++) {
      bids[i].status = calcStatus(bids[i]);
    }

    res.send({ data: bids, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//view special bid
bidRouter.get("/view/:bidID", async (req, res) => {
  const bidID = req.params.bidID;

  try {
    let bid = await bidModel
      .findById(bidID)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    bid.status = calcStatus(await bid);

    res.send({ data: bid, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

// Needs to be tested
bidRouter.patch("/join/:bidID", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { bidID } = req.params;
  let { bidPrice } = req.body;

  try {
    let bid = await bidModel.findOne({ _id: bidID });

    let highestBid = getHighestBid(await bid);

    if (highestBid.price <= bidPrice)
      return res.send({ message: "احنا هنستعبط ولا ايه" });

    bid.status = calcStatus(bid);

    if (bid.status !== "active")
      return res.send({ message: "Sorry, Bid is not active", ok: false });

    let updatedBid = await bidModel.updateOne(
      { _id: bidID },
      { $push: { bidsHistory: { user: user.id, price: bidPrice } } }
    );

    if (updatedBid.modifiedCount > 0) {
      sendNotification({
        userID: highestBid.userID,
        title: "Someone raised the game!",
        message: `You've been beaten. Put your new price to stay on top`,
        redirect: `/bid/${bidID}`,
      });

      res.send({ message: "You Joined the bid", ok: true });
    }
  } catch (err) {
    console.log(err);
    res.send({ message: err, ok: false });
  }
});

//view bid by category
bidRouter.get("/:cat", async (req, res) => {
  const cat = req.params.cat;

  try {
    let bids = [];
    await bidModel
      .find({})
      .populate({
        path: "item",
        match: { type: cat },
        select: "name type description images",
      })
      .populate("user", "name email profilePicture")
      .then((response) => {
        for (let i = 0; i < response.length; i++) {
          if (response[i].item !== null) {
            response[i].status = calcStatus(response[i]);
            bids.push(response[i]);
          }
        }
      })
      .then(() => {
        res.send({ data: bids, ok: true });
      });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

const getHighestBid = (bid) => {
  let highestBidPrice = bid.minPrice;
  let highestBid = {};

  bid.bidsHistory.forEach((bid) => {
    if (bid.price > highestBidPrice) {
      highestBidPrice = bid.price;
      highestBid = bid;
    }
  });

  return highestBid;
};

const calcStatus = (bid) => {
  let startDate = dayjs(bid.startDate);
  let endDate = dayjs(bid.endDate);
  let now = dayjs();

  let diffBefore = startDate.diff(now);
  let diffAfter = endDate.diff(now);

  if (diffBefore > 0) return "soon";
  if (diffAfter < 0) return "expired";
  return "active";
};

module.exports = bidRouter;
