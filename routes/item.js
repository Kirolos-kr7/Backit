const express = require("express");
const itemModel = require("../models/itemModel");
const userModel = require("../models/userModel");
const authValidation = require("../middlewares/authValidation");
const { v4: uuidv4 } = require("uuid");

const itemRouter = express.Router();

itemRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    images: req.body.images,
    id: uuidv4(),
  };

  try {
    let { inventory } = await userModel.findOne({
      _id: user.id,
    });

    inventory.push(item);

    let response = await userModel.updateOne(
      {
        _id: user.id,
      },
      { inventory }
    );

    if (response.modifiedCount > 0) {
      return res.send({
        data: item,
        message: "Added item successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

itemRouter.delete("/delete", authValidation,async (req, res) => {
  const itemID = req.body.id;
  let user = res.locals.user;

  try {
    let { inventory } = await userModel.findOne({
      _id: user.id,
    });

    let newInventory = inventory.filter((item)=>{
      if(item.id != itemID) return item;
    });

    let response = await userModel.updateOne(
      {
        _id: user.id,
      },
      { newInventory }
    );

    if (response.modifiedCount > 0) {
      return res.send({
        data: item,
        message: "Added item successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

module.exports = itemRouter;
