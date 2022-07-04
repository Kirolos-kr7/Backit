const express = require("express");
const reportModel = require("../models/reportModel");
const authValidation = require("../middlewares/authValidation");
const JOI = require("joi");

const reportRouter = express.Router();

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
    return res.status(400).json({
      message: err.details[0].message,
      ok: false,
    });
  }

  try {
    let newreport = await reportModel.create(report);

    if (newreport)
      return res.status(200).json({
        message: "report Added Successfully",
        data: newreport,
        ok: true,
      });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

// to let the user to see all his reports
reportRouter.get("/user", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { limit = 0, skip = 0 } = req.query;

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
      return res.status(200).json({
        data: { reports, count },
        ok: true,
      });
    } else {
      return res.status(400).json({
        message: "No report Found",
        ok: false,
      });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

module.exports = reportRouter;
