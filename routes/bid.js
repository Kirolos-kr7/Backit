const express = require("express");
const bidModel = require("../models/bidModel");

const bidRouter = express.Router();

bidRouter.get("/add", async (req, res) => {
  // let { name, type, description, images } = req.body;

  let bid = {
    name: "mario",
    price: "0",
    start_date: "Oct 18, 2022",
    end_date: "Oct 20, 2022",
  };

  try {
    await bidModel.create(bid);

    res.send({ message: "Creat bid successfully", ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

module.exports = bidRouter;
