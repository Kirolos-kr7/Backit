const { Schema, Types, model } = require("mongoose"); // connect to db

/* Creating a schema for the report model. */
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

/* Creating a text index on all fields in the schema. */
reportSchema.index({ "$**": "text" });

/* Creating a model called Report and using the reportSchema to create it. */
const reportModel = model("Report", reportSchema);
module.exports = reportModel;
