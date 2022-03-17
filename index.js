const express = require("express");
const mongoose = require("mongoose");
const itemRouter = require("./routes/item");
const bidRouter = require("./routes/bid");

const app = express();

// connect to mongodb & listen for requests
const dbURI =
  "mongodb+srv://bidit:bidit8@cluster0.ybuco.mongodb.net/Bidit?retryWrites=true&w=majority";

mongoose
  .connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => console.log("db connected"))
  .catch((err) => console.log(err));

app.use("/item", itemRouter);
app.use("/bid", bidRouter);

app.listen(8080, () => {
  console.log("Listenting on Port 8080");
});
