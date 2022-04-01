const express = require("express");
const JOI = require("joi"); //use joi to easier form
const bidModel = require("../models/bidModel");
const bidModel= require("../models/bidModel");
const userModel = require("../models/userModel");

const bidRouter = express.Router();
const bidSchema = JOI.object({
 
  startDate: JOI.date().required(),
  endDate: JOI.date().required(),
  minPrice: JOI.required(),
  status: JOI.string().required(),
  bidsHistory: JOI.array().allow(null),
  uID: JOI.string().required(),
  bidID: JOI.string().required(),
});


bidRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let bid = {
    startDate: req.body.startDate,
    endDate: req.body,endDate,
    minPrice: req.body.minPrice,
    status: req.body.status,
    bidsHistory: req.body.bidsHistory,
    bidID: req.body.bidID,
    uID: req.body.uID
  };

  try {
    await bidSchema.validateAsync(bid);
  } catch (err) {
    return res.send({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    

    if (response.modifiedCount > 0) {
      return res.send({
        data: bid,
        message: "Added bid successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//delete bid
/*bidRouter.delete("/delete", authValidation, async (req, res) => {
  const bidID = req.body.id;
  let user = res.locals.user;

  if (!bidID) {
    return res.send({
      message: "bid Id Is Invalid",
      ok: false,
    });
  }

  try {
    let { inventory } = await userModel.findOne({
      _id: user.id,
    });

    let newInventory = inventory.filter((bid) => {
      if (bid.id != bidID) return bid;
    });

    if (inventory.length == newInventory.length) {
      return res.send({
        message: "bid Not Found",
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
      return res.send({
        message: "Delete bid successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});
*/
//bidRouter.delete('/:id', (req, res) => {
  //const id = req.params.id;
  //bidModel.findByIdAndDelete(id)
    //.then(result => {
      //res.json({ redirect: '/bids' });
    //})
    //.catch(err => {
      //console.log(err);
       //bidModel.delete(bid);
    //})
//});



module.exports = bidRouter;
