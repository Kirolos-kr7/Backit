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


bidRouter.delete('/:id', (req, res) => {
  const id = req.params.id;
  bidModel.findByIdAndDelete(id)
    .then(result => {
      res.json({ redirect: '/bids' });
    })
    .catch(err => {
      console.log(err);
       bidModel.delete(bid);
    })
});



module.exports = bidRouter;
