const bidModel = require("../models/bidModel");
const dayjs = require("dayjs");
const { sendNotification } = require("./notification");
const analyticsModel = require("../models/analyticsModel");

const initSocket = (socket) => {
  console.log("a user connected");

  socket.on("pageLoaded", async (bidID, bidderID) => {
    try {
      socket.join(bidID);

      if (bidID.length !== 24) return socket.emit("bidNotFound");

      let bid = await bidModel
        .findById(bidID)
        .populate("item", "name type description images")
        .populate("user", "name email profilePicture");

      if (!bid) socket.emit("bidNotFound");
      else {
        socket.emit("bidFound", bid);
      }
      if (bidderID) {
        let anx = await analyticsModel.findOne({ bidID, bidderID });
        if (!anx) await analyticsModel.create({ bidID, bidderID });
      }
    } catch (err) {
      console.log(err);
    }
  });

  socket.on("joinBid", async (data) => {
    let { newPrice, userID, bidID } = data;

    try {
      let bid = await bidModel.findOne({ _id: bidID });

      let highestBid = getHighestBid(await bid);

      if (highestBid.price >= newPrice)
        return socket.emit(
          "bidError",
          "Price you enter it must be more than current price"
        );

      if (bid.status !== "active")
        return socket.emit("bidError", "Sorry, Bid is not active");

      let updatedBid = await bidModel.updateOne(
        { _id: bidID },
        { $push: { bidsHistory: { user: userID, price: newPrice } } }
      );

      if (updatedBid.modifiedCount > 0) {
        fetchBid(bidID, socket);

        if (highestBid.user) {
          sendNotification({
            userID: highestBid.user,
            title: {
              ar: "لقد قام احد برفع سعر المزاد!",
              en: "Someone raised the bid price!",
            },
            message: {
              ar: "لقد تغلب احدهم عليك. ضع سعرك الجديد لتبقى على القمة.",
              en: "You've been beaten. Put your new price to stay on top.",
            },
            redirect: `/bid/${bidID}`,
          });
        }
      }
    } catch (err) {
      console.log(err);
    }
  });
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
      socket.broadcast.to(bidID).emit("bidFound", bid);
      socket.emit("bidFound", bid);
    }
  } catch (err) {
    console.log(err);
  }
};

module.exports = { initSocket, getHighestBid };
