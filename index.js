const express = require("express");
const mongoose = require("mongoose");
const itemRouter = require("./routes/item");
const bidRouter = require("./routes/bid");
const authRouter = require("./routes/auth");

const app = express();
app.use(express.json());

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

app.get("/", (req, res) => {
  res.send("Running");
});

app.listen(8080, () => {
  console.log("Listenting on Port 8080");
});
