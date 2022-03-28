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

// itemRouter.delete("/:id", (req, res) => {
//   const id = req.params.id;
//   itemModel
//     .findByIdAndDelete(id)
//     .then((result) => {
//       res.json({ redirect: "/items" });
//     })
//     .catch((err) => {
//       console.log(err);
//       itemModel.delete(item);
//     });
// });

module.exports = itemRouter;
