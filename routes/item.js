const express = require("express");
const itemModel = require("../models/itemModel"); //import to itemModel
const userModel = require("../models/userModel"); //import to userModel
const bidModel = require("../models/bidModel");
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewares  
const { v4: uuidv4 } = require("uuid"); // build unique id
const JOI = require("joi"); //use joi to easier form
const req = require("express/lib/request");
const res = require("express/lib/response");

const itemRouter = express.Router();

//identify the requests of every thing
const itemSchema = JOI.object({
  name: JOI.string().min(3).max(32).required(),
  type: JOI.string().min(3).max(32).required(),
  description: JOI.string().min(3).max(256).required(),
  images: JOI.array().allow(null),
  id: JOI.string().required(),
});

itemRouter.get("/all", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let { inventory } = await userModel
      .findOne({
        _id: user.id,
      })
      .select("inventory");

    res.send({ data: inventory, ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

// Edit item
itemRouter.patch("/edit", authValidation, async (req, res) => {
  let user = res.locals.user;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    images: req.body.images,
    id: req.body.id,
  };

  try {
    await itemSchema.validateAsync(item);
  } catch (err) {
    return res.send({
      message: err.details[0].message,
      ok: false,
    });
  }
  try {
    let { inventory } = await userModel.findOne({
      _id: user.id,
    });

    inventory.forEach((existingItem, i) => {
      if (item.id == existingItem.id) {
        inventory[i] = item;
      }
    });

    let response = await userModel.updateOne(
      {
        _id: user.id,
      },
      { inventory }
    );

    if (response.modifiedCount > 0) {
      return res.send({
        data: item,
        message: "edit item successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

// add item
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
    await itemSchema.validateAsync(item);
  } catch (err) {
    return res.send({
      message: err.details[0].message,
      ok: false,
    });
  }

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

//delete item
itemRouter.delete("/delete", authValidation, async (req, res) => {
  const itemID = req.body.id;
  let user = res.locals.user;

  if (!itemID) {
    return res.send({
      message: "Item Id Is Invalid",
      ok: false,
    });
  }

  try {
    
    let { inventory } = await userModel.findOne({
      _id: user.id,
    });

    let newInventory = inventory.filter((item) => {
      if (item.id != itemID) return item;
    });

    if (inventory.length == newInventory.length) {
      return res.send({
        message: "Item Not Found",
        ok: false,
      });
    }

    let response = await userModel.updateOne(
      {
        _id: user.id,
      },
      { inventory: newInventory }
    );

    if (response.modifiedCount > 0) {

      let bidResponse  = await bidModel.deleteOne({
        itemID: itemID,
      });

        return res.send({
          message: "Delete item successfully",
          ok: true,
        });
      
      
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

module.exports = itemRouter;
