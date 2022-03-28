const express = require("express");
const itemModel = require("../models/itemModel");
const authValidation = require("../middlewares/authValidation");
const userModel = require("../models/userModel");

const { v4: uuidv4 } = require('uuid');


const itemRouter = express.Router();

itemRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    images: req.body.images,
    id: uuidv4()
  };

  try {
    let {inventory} = await userModel.findById({
      _id: user.id
    }).select("inventory")
    inventory.push(item);


    let {inventory:newInventory} = await userModel.findByIdAndUpdate({
      _id: user.id
    },{inventory}).select("inventory")
      
      res.send({ data:newInventory, message: "Added item successfully", ok: true });
    
    
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
