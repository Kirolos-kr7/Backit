const express = require("express");
const bidModel = require("../models/bidModel");
const userModel = require("../models/userModel");

const adminRouter = express.Router();

adminRouter.get("/users", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let users = await userModel
      .find()
      .sort([[sortBy, dir]])
      .select("name email isAdmin");

    res.send({ data: users, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/bids", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let bids = await bidModel
      .find()
      .sort([[sortBy, dir]])
      .populate("item", "name type description images")
      .populate("user", "name email profilePicture");

    res.send({ data: bids, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/reports", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { sortBy, dir } = req.query;

  if (!sortBy) sortBy = "name";
  if (!dir) dir = "asc";

  try {
    if (!user.isAdmin)
      return res.send({ message: "Access Denied!", ok: false });

    let users = await userModel
      .find()
      .sort([[sortBy, dir]])
      .select("_id type status");

    res.send({ data: users, ok: true });
  } catch (err) {
    console.log(err);
  }
});

// adminRouter.get("/orders", authValidation, async (req, res) => {
//   let user = res.locals.user;
//   let { sortBy, dir } = req.query;

//   if (!sortBy) sortBy = "name";
//   if (!dir) dir = "asc";

//   try {
//     if (!user.isAdmin)
//       return res.send({ message: "Access Denied!", ok: false });

//     let users = await userModel
//       .find()
//       .sort([[sortBy, dir]])
//       .select("name email address isAdmin");

//     res.send({ data: users, ok: true });
//   } catch (err) {
//     console.log(err);
//   }
// });

module.exports = adminRouter;
