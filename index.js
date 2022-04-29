const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const itemRouter = require("./routes/item");
const bidRouter = require("./routes/bid");
const authRouter = require("./routes/auth");
const reportRouter = require("./routes/report");
const dayjs = require("dayjs");
const userModel = require("./models/userModel");
require("dotenv").config();

const app = express();
const http = require("http");
const httpServer = http.createServer(app);
const { Server } = require("socket.io");
const bidModel = require("./models/bidModel");

const io = new Server(httpServer, {
  cors: {
    origin: true,
  },
});


io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("pageLoaded", async (bidID) => {
    try {
      let bid = await bidModel
        .findById(bidID)
        .populate("item", "name type description images")
        .populate("user", "name email profilePicture");

      bid.status = calcStatus(await bid);
      if (bid) socket.emit("bidFound", bid);
      else socket.emit("bidNotFound")
    } catch (err) {
      console.log(err)
    }
  })
  socket.on("joinBid", async (data) => {

    let { newPrice, user, bidID } = data
    console.log({ newPrice, user, bidID })


    try {
      let bid = await bidModel.findOne({ _id: bidID });

      let highestBid = getHighestBid(await bid);

      console.log(highestBid.price)
      if (highestBid.price <= newPrice)
        return socket.emit("bidError", "Price you enter it must be more than current price");

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





  })
});
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

app.use(express.json());
app.use(cors());

// connect to mongodb & listen for requests
const dbURI =
  "mongodb+srv://bidit:bidit8@cluster0.ybuco.mongodb.net/Bidit?retryWrites=true&w=majority";

mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => console.log("DB is Live"))
  .catch((err) => console.log(err));

//enter the tables
app.use("/auth", authRouter);
app.use("/item", itemRouter);
app.use("/bid", bidRouter);
app.use("/report", reportRouter);

app.get("/", (req, res) => {
  res.send("Running");
});

let port = process.env.PORT || 8080;

httpServer.listen(port, () => {
  console.log("Listenting on Port " + port);
});
