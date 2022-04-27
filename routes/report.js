const express = require("express");
const reportModel = require("../models/reportModel"); //import to reportModel
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewares
const { v4: uuidv4 } = require("uuid"); // build unique id
const JOI = require("joi"); //use joi to easier form
const userModel = require("../models/userModel");

const reportRouter = express.Router();

//identify the requests of every thing
const reportSchema = JOI.object({
  reporterID: JOI.string(),
  type: JOI.string().min(3).max(32).required(),
  description: JOI.string().min(3).required(),
  recipientID: JOI.string(),
  status: JOI.string(),
});

// add report
reportRouter.post("/add", authValidation, async (req, res) => {
  let user = res.locals.user;

  let report = {
    reporterID: user.id,
    type: req.body.type,
    description: req.body.description,
    recipientID: req.body.recipientID,
  };

  try {
    await reportSchema.validateAsync(report);
  } catch (err) {
    return res.send({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    let newreport = await reportModel.create(report);

    if (newreport)
      return res.send({
        message: "report Added Successfully",
        data: newreport,
        ok: true,
      });
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

//delete report
reportRouter.delete("/delete", authValidation, async (req, res) => {
  let user = res.locals.user;
  const reportID = req.body.reportID;
  if (user.isAdmin) {
    if (!reportID) {
      return res.send({
        message: "report Id Is Required",
        ok: false,
      });
    }

    try {
      let deletedreport = await reportModel.deleteOne({
        _id: reportID,
      });

      if (deletedreport.deletedCount > 0) {
        return res.send({
          message: "report Deleted successfully",
          ok: true,
        });
      }
    } catch (err) {
      res.send({ message: err, ok: false });
    }
  } else {
    // if not admin
    res.send({ message: "Access Denied", ok: false });
  }
});

reportRouter.patch("/feedback", authValidation, async (req, res) => {
  let user = res.locals.user;
  const reportID = req.body.reportID;
  const status = req.body.status;
  if (user.isAdmin) {
    if (!reportID) {
      return res.send({
        message: "report Id Is Required",
        ok: false,
      });
    }

    if (!status) {
      return res.send({
        message: "status Is Required",
        ok: false,
      });
    }

    try {
      let feedback = await reportModel.updateOne(
        {
          _id: reportID,
        },
        { status }
      );

      if (feedback.modifiedCount > 0) {
        return res.send({
          message: "report updated successfully",
          ok: true,
        });
      }
    } catch (err) {
      res.send({ message: err, ok: false });
    }
  } else {
    // if not admin
    res.send({ message: "Access Denied", ok: false });
  }
});
// to let the admin to see all the report's info
reportRouter.get("/all", authValidation, async (req, res) => {
  let user = res.locals.user;
  if (user.isAdmin) {
    try {
      let reports = await reportModel.find();

      if (reports) {
        return res.send({
          data: reports,
          ok: true,
        });
      } else {
        return res.send({
          message: "No report Found",
          ok: true,
        });
      }
    } catch (err) {
      res.send({ message: err, ok: false });
    }
  } else {
    // if not admin
    res.send({ message: "Access Denied", ok: false });
  }
});
// to let the user to see all his reports
reportRouter.get("/user", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let reports = await reportModel.find({ reporterID: user.id });

    if (reports) {
      return res.send({
        data: reports,
        ok: true,
      });
    } else {
      return res.send({
        message: "No report Found",
        ok: true,
      });
    }
  } catch (err) {
    res.send({ message: err, ok: false });
  }
});

module.exports = reportRouter;
