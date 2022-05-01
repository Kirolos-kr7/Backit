const express = require("express");
const itemModel = require("../models/itemModel"); //import to itemModel
const bidModel = require("../models/bidModel"); //import to bidModel
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewares
const { v4: uuidv4 } = require("uuid"); // build unique id
const JOI = require("joi"); //use joi to easier form

const itemRouter = express.Router();

//identify the requests of every thing
const itemSchema = JOI.object({
  name: JOI.string().min(3).max(32).required(),
  type: JOI.string().min(3).max(32).required(),
  description: JOI.string().min(3).max(256).required(),
  images: JOI.array().allow(null),
  uID: JOI.string(),
});

// add item
itemRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    images: req.body.images,
    uID: user.id,
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
    let newItem = await itemModel.create(item);

    if (newItem)
      return res.send({
        message: "Item Added Successfully",
        data: newItem,
        ok: true,
      });
  } catch (err) {
    console.log(err);
  }
});

//delete item
itemRouter.delete("/delete", authValidation, async (req, res) => {
  let user = res.locals.user;
  const itemID = req.body.id;

  if (!itemID) {
    return res.send({
      message: "Item Id Is Required",
      ok: false,
    });
  }

  try {
    let deletedItem = await itemModel.deleteOne({
      _id: itemID,
    });

    if (deletedItem.deletedCount > 0) {
      await bidModel.deleteMany({ item: itemID });

      return res.send({
        message: "Item Deleted successfully",
        ok: true,
      });
    }
  } catch (err) {
    console.log(err);
  }
});

// Edit item
itemRouter.patch("/edit", authValidation, async (req, res) => {
  let itemID = req.body.itemID;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    images: req.body.images,
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
    let response = await itemModel.updateOne({ _id: itemID }, item);

    if (response.modifiedCount > 0) {
      let editedItem = await itemModel.findById(itemID);

      if (editedItem)
        return res.send({
          message: "Item Edited Successfully",
          data: editedItem,
          ok: true,
        });
    }
  } catch (err) {
    console.log(err);
  }
});

itemRouter.get("/all", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let allItems = await itemModel.find({ uID: user.id });

    res.send({ data: allItems, ok: true });
  } catch (err) {
    console.log(err);
  }
});

module.exports = itemRouter;
