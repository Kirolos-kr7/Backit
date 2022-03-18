const express = require("express");
const bidModel = require("../models/bidModel");

const bidRouter = express.Router();

bidRouter.get("/add", async (req, res) => {
  // let { name, type, description, images } = req.body;

  let bid = {
    item: {
      name: "mario",
      type: 'human',
      description: 'kjdfhjklflksafjadlsjlfsflkasjlksfd',
      images: null
    },
    minPrice: 0,
    startDate: "Oct 18, 2022",
    endDate: "Oct 20, 2022",
  };

  try {
    await bidModel.create(bid);

    res.send({ message: "Creat bid successfully", ok: true });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});


bidRouter.delete("/delete", async(req, res) => {
  const id = req.params.id;
  bids.findByIdAndDelete(id)
    .then(result => {
      res.json({ redirect: '/bids' });
    })
    .catch(err => {
      console.log(err);
    });
    try {
      await bidModel.delete(bid);
  
      res.send({ message: "Delete bid successfully", ok: true });
    } catch (err) {
      res.send({ message: err, ok: false });
    }
});



module.exports = bidRouter;
