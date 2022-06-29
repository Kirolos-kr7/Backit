const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const itemRouter = require("./routes/item");
const { bidRouter, reviveServer } = require("./routes/bid");
const authRouter = require("./routes/auth");
const reportRouter = require("./routes/report");
const adminRouter = require("./routes/admin");
const { Server } = require("socket.io");
const { initSocket } = require("./utils/socketConnection");
const hitIdentifier = require("./middlewares/hitIdentifier");

require("dotenv").config();

const app = express();
const http = require("http");
const orderRouter = require("./routes/order");
const httpServer = http.createServer(app);
reviveServer();

app.use(express.json({ limit: "25mb" }));
app.use(cors());

// connect to mongodb & listen for requests
const dbURI =
  "mongodb+srv://bidit:bidit8@cluster0.ybuco.mongodb.net/Bidit?retryWrites=true&w=majority";

mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => console.log("DB is Live"))
  .catch((err) => console.log(err));

//enter the tables
app.use(hitIdentifier);
app.use("/auth", authRouter);
app.use("/item", itemRouter);
app.use("/bid", bidRouter);
app.use("/order", orderRouter);
app.use("/report", reportRouter);
app.use("/admin", adminRouter);

app.get("/", (req, res) => {
  res.status(200).send("Running");
});

const io = new Server(httpServer, {
  cors: {
    origin: true,
  },
});

io.on("connection", (socket) => {
  initSocket(socket);
});

let port = process.env.PORT || 8080;

httpServer.listen(port, () => {
  console.log("Listenting on Port " + port);
});
