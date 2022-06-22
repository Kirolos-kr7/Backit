const express = require("express");
const reportModel = require("../models/reportModel"); //import to reportModel
const authValidation = require("../middlewares/authValidation"); //import to validation in middlewares
const { v4: uuidv4 } = require("uuid"); // build unique id
const JOI = require("joi"); //use joi to easier form
const userModel = require("../models/userModel");
const banModel = require("../models/banModel");
const bidModel = require("../models/bidModel");
const logModel = require("../models/logModel");

const reportRouter = express.Router();

//identify the requests of every thing
const reportSchema = JOI.object({
  reporter: JOI.string(),
  for: JOI.string(),
  type: JOI.string().min(3).max(32).required(),
  description: JOI.string().min(3).required(),
  recipient: JOI.string(),
  status: JOI.string(),
});

// add report
reportRouter.post("/add", authValidation, async (req, res) => {
  let { user } = res.locals;

  let report = {
    reporter: user.id,
    type: req.body.type,
    for: req.body.for,
    description: req.body.description,
    recipient: req.body.recipient,
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
    console.log(err);
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
      console.log(err);
    }
  } else {
    // if not admin
    res.send({ message: "Access Denied", ok: false });
  }
});

reportRouter.patch("/feedback/:reportID", authValidation, async (req, res) => {
  let user = res.locals.user;
  const { reportID } = req.params;
  const { status, action, recipient, message, bidID } = req.body;

  if (user.isAdmin) {
    if (!reportID) {
      return res.send({
        message: "ReportID is Required",
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
      if (status === "took the appropriate action") {
        if (!action)
          return res.send({
            message: "An action is required",
            ok: false,
          });

        banUser({
          email: recipient,
          message,
          days:
            action.toLowerCase() === "ban user for a week and remove bid"
              ? 7
              : 0,
        });

        await bidModel.deleteOne({ _id: bidID });
      }

      await logModel.create({
        admin: user.email,
        user: recipient,
        message: `${user.email} has applied a ${action} for ${recipient}`,
      });

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
      console.log(err);
    }
  } else {
    // if not admin
    res.send({ message: "Access Denied", ok: false });
  }
});

// to let the user to see all his reports
reportRouter.get("/user", authValidation, async (req, res) => {
  let { user } = res.locals;
  let limit = req.query.limit || 0;
  let skip = req.query.skip || 0;

  try {
    let count = await reportModel.count({
      reporter: user.id,
    });

    let reports = await reportModel
      .find({
        reporter: user.id,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    if (reports) {
      return res.send({
        data: { reports, count },
        ok: true,
      });
    } else {
      return res.send({
        message: "No report Found",
        ok: true,
      });
    }
  } catch (err) {
    console.log(err);
  }
});

const banUser = async ({ email, message, days = 0 }) => {
  let xUser = await banModel.create({ user: email, message, days });
  if (xUser) return 1;
};

module.exports = reportRouter;
