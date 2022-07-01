const bidModel = require("../models/bidModel");
const { sendNotification } = require("./notification");
const analyticsModel = require("../models/analyticsModel");
const ObjectId = require("mongoose").Types.ObjectId;

const initSocket = (socket) => {
  socket.on("pageLoaded", async (bidID, bidderID) => {
    try {
      socket.join(bidID);

      if (!ObjectId.isValid(bidID)) return socket.emit("bidNotFound");

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
        if (anx) await analyticsModel.deleteOne({ bidID, bidderID });
        await analyticsModel.create({ bidID, bidderID });
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
  let highestBid = { user: null, price: bid.minPrice };

  bid.bidsHistory.forEach((x) => {
    if (x.price > highestBid.price) {
      highestBid = x;
    }
  });

  return highestBid;
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
