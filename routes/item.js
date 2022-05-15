const express = require("express");
const itemModel = require("../models/itemModel"); //import to itemModel
const bidModel = require("../models/bidModel"); //import to bidModel
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewares
const JOI = require("joi"); //use joi to easier form
const { v1: uuid } = require("uuid");

var ImageKit = require("imagekit");

var imagekit = new ImageKit({
  publicKey: "public_QyIWVOnkYPjl4YXn3PGe3ymGrt4=",
  privateKey: "private_7WVBoOozqMA1E+OUmuJFzGi5KJ0=",
  urlEndpoint: "https://ik.imagekit.io/bidit",
});

const itemRouter = express.Router();

//identify the requests of every thing
const itemSchema = JOI.object({
  name: JOI.string().min(3).max(64).required(),
  type: JOI.string().min(3).max(32).required(),
  description: JOI.string().min(3).max(256).required(),
  images: JOI.array().allow(null),
  uID: JOI.string(),
});

// add item
itemRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { images } = req.body;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
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
            return res.send({
              message: "Item Added Successfully",
              data: result,
              ok: true,
            });
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

//delete item
itemRouter.delete("/delete/:itemID", authValidation, async (req, res) => {
  let user = res.locals.user;
  const { itemID } = req.params;

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
  let { images, newImages, id: itemID } = req.body;

  let item = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
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
                return res.send({
                  message: "Item Edited Successfully",
                  data: result,
                  ok: true,
                });
              });
            }
          });
        });
    } else {
      if (images.length === 0) item.images = [];
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
    }
  } catch (err) {
    console.log(err);
  }
});

itemRouter.get("/all", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let allItems = await itemModel
      .find({ uID: user.id })
      .sort({ crearedAt: -1 });

    res.send({ data: allItems, ok: true });
  } catch (err) {
    console.log(err);
  }
});

module.exports = itemRouter;
