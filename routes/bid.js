const express = require("express");
const JOI = require("joi"); //use joi to easier form
const bidModel = require("../models/bidModel");  //import to bidModel
const userModel = require("../models/userModel");  //import to userModel

const bidRouter = express.Router();

const bidSchema = JOI.object({
  startDate: JOI.date().required(),
  endDate: JOI.date().required(),
  minPrice: JOI.number().required(),
  status: JOI.string().required(),
  bidsHistory: JOI.array().allow(null),
  uID: JOI.string().required(),
  itemID: JOI.string().required(),
});


bidRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  
  let bid = {
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    minPrice: req.body.minPrice,
    status: req.body.status,
    bidsHistory: [],
    uID: user.id,
    itemID: req.body.itemID,
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
    let newBid = new bidModel(bid)
    let addedBid = await newBid.save()

    if(addedBid){
      return res.send({
        data: addedBid,
        message: "Added bid successfully",
        ok: true,
      });

    }
      
    
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//delete bid
bidRouter.delete("/delete", authValidation, async (req, res) => {
  let user = res.locals.user;
  let bidID = req.body.bidID;
  

  if (!bidID) {
    return res.send({
      message: "bid Id Is required",
      ok: false,
    });
  }

  try {
    let response  = await bidModel.deleteOne({
      _id: bidID,
    });
    
    if (response.deletedCount > 0) {
      return res.send({
        message: "Delete bid successfully",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});
//view all bids
bidRouter.get('/all_bids',async (req, res) => {
 
 try{
     let bids= await bidModel.find({});
     res.send({data:bids, ok: true });
 }catch(err){
    res.send({ message: err, ok: false });
 }
   
});

//view all bids for special user
bidRouter.get('/sales',authValidation, async (req, res) => {
  let user = res.locals.user;
  try{
      let bids= await bidModel.find({uID: user.id});
      res.send({data:bids, ok: true });
  }catch(err){
     res.send({ message: err, ok: false });
  }
    
 });

//view special bid
bidRouter.get('/view_bid', async (req, res) => {
  const id = req.body.bidID;
  try{
    let bid= await bidModel.findOne({_id: id});
    res.send({data:bid, ok: true });
}catch(err){
   res.send({ message: err, ok: false });
}
});


module.exports = bidRouter;
