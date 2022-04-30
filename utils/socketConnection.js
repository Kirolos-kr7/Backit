const bidModel = require("../models/bidModel");
const dayjs = require("dayjs");
const { sendNotification } = require("./notification");

const initSocket = (socket) => {
  console.log("a user connected");
  socket.on("pageLoaded", async (bidID) => {
    try {
      let bid = await bidModel
        .findById(bidID)
        .populate("item", "name type description images")
        .populate("user", "name email profilePicture");

      bid.status = calcStatus(await bid);
      if (bid) socket.emit("bidFound", bid);
      else socket.emit("bidNotFound");
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("joinBid", async (data) => {
    let { newPrice, user, bidID } = data;
    console.log({ newPrice, user, bidID });

    try {
      let bid = await bidModel.findOne({ _id: bidID });

      let highestBid = getHighestBid(await bid);

      console.log(highestBid.price);
      if (highestBid.price <= newPrice)
        return socket.emit(
          "bidError",
          "Price you enter it must be more than current price"
        );

      bid.status = calcStatus(bid);

      if (bid.status !== "active")
        return socket.emit("bidError", "Sorry, Bid is not active");

      /*
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
      
    }*/
    } catch (err) {
      console.log(err);
      res.send({ message: err, ok: false });
    }
  });
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

const getHighestBid = (bid) => {
  if (bid.bidsHistory.length < 1) return { user: null, price: bid.minPrice };

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

module.exports = { initSocket, calcStatus, getHighestBid };
