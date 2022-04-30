const bidModel = require("../models/bidModel");
const dayjs = require("dayjs");
const { sendNotification } = require("./notification");

const initSocket = (socket) => {
  console.log("a user connected");
  socket.on("pageLoaded", async (bidID) => {
    try {
      if (bidID.length !== 24) return socket.emit("bidNotFound");

      let bid = await bidModel
        .findById(bidID)
        .populate("item", "name type description images")
        .populate("user", "name email profilePicture");

      if (!bid) socket.emit("bidNotFound");
      else {
        bid.status = calcStatus(await bid);
        socket.emit("bidFound", bid);
      }
    } catch (err) {
      console.log(err);
    }
  });
  socket.on("joinBid", async (data) => {
    let { newPrice, user, bidID } = data;

    try {
      let bid = await bidModel.findOne({ _id: bidID });

      let highestBid = getHighestBid(await bid);

      console.log(newPrice);
      if (highestBid.price >= newPrice)
        return socket.emit(
          "bidError",
          "Price you enter it must be more than current price"
        );

      bid.status = calcStatus(bid);

      if (bid.status !== "active")
        return socket.emit("bidError", "Sorry, Bid is not active");

      let updatedBid = await bidModel.updateOne(
        { _id: bidID },
        { $push: { bidsHistory: { user: user.id, price: newPrice } } }
      );

      if (updatedBid.modifiedCount > 0) {
        fetchBid(bidID, socket);

        if (highestBid.user) {
          sendNotification({
            userID: highestBid.user,
            title: "Someone raised the game!",
            message: `You've been beaten. Put your new price to stay on top`,
            redirect: `/bid/${bidID}`,
          });
        }
      }
    } catch (err) {
      console.log(err);
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

  if (bid.bidsHistory[0].price > highestBidPrice) return bid.bidsHistory[0];
  else return highestBidPrice;
};

const fetchBid = async (bidID, socket) => {
  try {
    let bid = await bidModel
      .findById(bidID)
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    if (!bid) socket.emit("bidNotFound");
    else {
      bid.status = calcStatus(await bid);
      socket.emit("bidFound", bid);
    }
  } catch (err) {
    console.log(err);
  }
};

module.exports = { initSocket, calcStatus, getHighestBid };
