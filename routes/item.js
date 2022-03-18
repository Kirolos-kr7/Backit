const express = require("express");
const itemModel = require("../models/itemModel");

const itemRouter = express.Router();

itemRouter.get("/add", async (req, res) => {
  // let { name, type, description, images } = req.body;

  let item = {
    name: "mario",
    type: "human",
    description: "human with a donkey head",
    images: null,
  };

  try {
    await itemModel.create(item);

    res.send({ message: "Added item successfully", ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

itemRouter.delete("/:", async(req, res) => {
  const id = req.params.id;
  Blog.findByIdAndDelete(id)
    .then(result => {
      res.json({ redirect: '/items' });
    })
    .catch(err => {
      console.log(err);
    });
    try {
      await bidModel.delete(item);
  
      res.send({ message: "Delete item successfully", ok: true });
    } catch (err) {
      res.send({ message: err, ok: false });
    }
});


module.exports = itemRouter;
