const express = require("express");
const bidModel = require("../models/bidModel");
const userModel = require("../models/userModel");
const JOI = require("joi");
const reportModel = require("../models/reportModel");

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

    let users = await reportModel
      .find()
      .sort([[sortBy, dir]])
      .select("_id type status");

    res.send({ data: users, ok: true });
  } catch (err) {
    console.log(err);
  }
});

adminRouter.get("/notifications", authValidation, async (req, res) => {
  let user = res.locals.user;

  // checking if a user is admin
  if (!user.isAdmin) return res.send({ message: "Access Denied", ok: false });

  try {
    // get main user
    let user = await userModel
      .findOne({ email: "bidit.platform@gmail.com" })
      .select("notifications");

    // sorting user notification from newer to older
    user.notifications.sort((a, b) => {
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);

      if (aDate < bDate) return 1;
      if (aDate > bDate) return -1;

      return 0;
    });

    // sending sorted notifications
    return res.send({
      data: user.notifications,
      ok: true,
    });
  } catch (err) {
    console.log(err);
  }
});

let ntSchema = JOI.object({
  title: JOI.object({
    en: JOI.string().required(),
    ar: JOI.string().required(),
  }),
  message: JOI.object({
    en: JOI.string().required(),
    ar: JOI.string().required(),
  }),
});

adminRouter.post("/broadcast", authValidation, async (req, res) => {
  let user = res.locals.user;
  let { title, message, redirect } = req.body;

  // checking if a user is admin
  if (!user.isAdmin) return res.send({ message: "Access Denied", ok: false });

  try {
    let isValid = ntSchema.validate({ title, message, redirect });
    if (isValid.error)
      return res.send({ message: isValid.error.details[0].message, ok: false });

    // getting all user
    let users = await userModel.find();

    // sending notification for each user in db
    for (let i = 0; i < users.length; i++) {
      users[i].notifications.push({
        title,
        message,
        redirect,
      });

      await users[i].save();
    }

    return res.send({
      message: "Broadcasted Successfully",
      ok: true,
    });
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
