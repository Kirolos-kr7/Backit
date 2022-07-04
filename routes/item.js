/** IMPORTS **/
const express = require("express");
const ObjectId = require("mongoose").Types.ObjectId;
const itemModel = require("../models/itemModel");
const bidModel = require("../models/bidModel");
const authValidation = require("../middlewares/authValidation");
const JOI = require("joi");
const { v1: uuid } = require("uuid");
const ImageKit = require("imagekit");

/** INITIALIZATIONS **/
/* Creating a new instance of the ImageKit class. */
var imagekit = new ImageKit({
  publicKey: "public_QyIWVOnkYPjl4YXn3PGe3ymGrt4=",
  privateKey: "private_7WVBoOozqMA1E+OUmuJFzGi5KJ0=",
  urlEndpoint: "https://ik.imagekit.io/bidit",
});

// create item router
const itemRouter = express.Router();

//identify the requests of every thing
const itemSchema = JOI.object({
  name: JOI.string().min(3).max(128).required(),
  type: JOI.string().min(3).max(32).required(),
  description: JOI.string().min(3).max(512).required(),
  images: JOI.array(),
  uID: JOI.string(),
});

// add item
itemRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { images } = req.body;

  /* This is a validation to check if the user has uploaded at least one image. */
  if (images.length === 0)
    return res
      .status(400)
      .json({ message: "Atleast one image is required", ok: false });

  /* Creating an object with the name, type, description and uID. */
  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    uID: user.id,
  };

  /* Validating item. */
  try {
    await itemSchema.validateAsync(item);
  } catch (err) {
    return res.status(400).json({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    /* Creating a new item in the database. */
    let newItem = await itemModel.create(item);

    /* This is a forEach loop that is used to upload the images to the imagekit server. */
    if (newItem) {
      images.forEach(async (image, index) => {
        let uniqueID = uuid();

        let result = await imagekit.upload({
          file: image,
          fileName: uniqueID,
        });

        await itemModel.updateOne(
          { _id: newItem.id },
          { $push: { images: result.name } }
        );

        if (index === images.length - 1) {
          await itemModel.findById(newItem.id).then((result) => {
            return res.status(200).json({
              message: "Item Added Successfully",
              data: result,
              ok: true,
            });
          });
        }
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

//delete item
itemRouter.delete("/delete/:itemID", authValidation, async (req, res) => {
  const { itemID } = req.params;

  /* This is a validation to check if the itemID is valid or not. */
  if (!ObjectId.isValid(itemID)) {
    return res.status(404).json({
      message: "Item not found",
      ok: false,
    });
  }

  try {
    let availableBids = await bidModel.find({ item: itemID }).select("status");

    let isNotSoonBids = availableBids.some((bid) => bid.status !== "soon");
    if (isNotSoonBids)
      return res
        .status(400)
        .json({ message: "You Cannot Delete this item", ok: false });

    availableBids.forEach(async (bid) => {
      await bidModel.deleteOne({ _id: bid._id });
    });

    let deletedItem = await itemModel.deleteOne({
      _id: itemID,
    });

    if (deletedItem.deletedCount > 0)
      return res.status(200).json({
        message: "Item Deleted successfully",
        ok: true,
      });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

// Edit item
itemRouter.patch("/edit/:itemID", authValidation, async (req, res) => {
  let { itemID } = req.params;
  let { images, newImages } = req.body;

  if (newImages && images.length === 0)
    return res
      .status(400)
      .json({ message: "Atleast one image is required", ok: false });

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
  };

  try {
    await itemSchema.validateAsync(item);
  } catch (err) {
    return res.status(400).json({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    if (newImages && images.length > 0) {
      await itemModel
        .updateOne(
          { _id: itemID },
          {
            name: item.name,
            type: item.type,
            description: item.description,
            images: [],
          }
        )
        .then(() => {
          images.forEach(async (image, index) => {
            let uniqueID = uuid();

            let result = await imagekit.upload({
              file: image,
              fileName: uniqueID,
            });

            await itemModel.updateOne(
              { _id: itemID },
              { $push: { images: result.name } }
            );

            if (index === images.length - 1) {
              await itemModel.findById(itemID).then((result) => {
                return res.status(200).json({
                  message: "Item Edited Successfully",
                  data: result,
                  ok: true,
                });
              });
            }
          });
        });
    } else {
      let response = await itemModel.updateOne({ _id: itemID }, item);

      if (response.modifiedCount > 0) {
        let editedItem = await itemModel.findById(itemID);

        if (editedItem)
          return res.status(200).json({
            message: "Item Edited Successfully",
            data: editedItem,
            ok: true,
          });
      }
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

itemRouter.get("/all", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { limit, skip } = req.query;

  try {
    let count = await itemModel.count({ uID: user.id });

    let items = await itemModel
      .find({ uID: user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ data: { items, count }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

module.exports = itemRouter;
