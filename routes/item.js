const express = require("express");
const itemModel = require("../models/itemModel");
const authValidation = require("../middlewares/authValidation");
const userModel = require("../models/userModel");

const itemRouter = express.Router();

itemRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    images: req.body.images,
    uID: user.id
  };

  try {
    let inventory = userModel.findById({
      _id: user.id
    }).select("inventory")
    console.log(inventory);
    res.send({ data, message: "Added item successfully", ok: true });
    
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

itemRouter.delete("/:id", (req, res) => {
  const id = req.params.id;
  itemModel
    .findByIdAndDelete(id)
    .then((result) => {
      res.json({ redirect: "/items" });
    })
    .catch((err) => {
      console.log(err);
      itemModel.delete(item);
    });
});

module.exports = itemRouter;
