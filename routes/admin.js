const express = require("express");
const bidModel = require("../models/bidModel");
const userModel = require("../models/userModel");
const { calcStatus } = require("../utils/socketConnection");

const adminRouter = express.Router();

adminRouter.get("/bids", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let bids = await bidModel
      .find()
      .sort([[sortBy, dir]])
      .populate("item", "name type description images")
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

module.exports = adminRouter;
