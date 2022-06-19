const { Schema, Types, model } = require("mongoose"); // connect to db

//the form of the schema
const reportSchema = new Schema(
  {
    reporter: { type: Types.ObjectId, ref: "User", required: true },
    recipient: { type: Types.ObjectId, ref: "User", required: true },
    for: { type: Types.ObjectId, ref: "Bid", required: true },
    type: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: "pending",
      lowercase: true,
    },
  },
  { timestamps: true }
);

const reportModel = model("Report", reportSchema);
module.exports = reportModel;
