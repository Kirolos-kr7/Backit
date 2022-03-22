const express = require("express");
const itemModel = require("../models/itemModel");

const itemRouter = express.Router();

itemRouter.get("/add", async (req, res) => {
  // let { name, type, description, images } = req.body;

  let item = {
    name: "mario",
    type: "human",
    description: "tall human",
    images: null,
  };

  try {
    await itemModel.create(item);

    res.send({ message: "Added item successfully", ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

itemRouter.delete('/:id', (req, res) => {
  const id = req.params.id;
  itemModel.findByIdAndDelete(id)
    .then(result => {
      res.json({ redirect: '/items' });
    })
    .catch(err => {
      console.log(err);
       itemModel.delete(item);
    })
});


module.exports = itemRouter;
