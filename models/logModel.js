const mongoose = require("mongoose"); // connect to db
const Schema = mongoose.Schema; //build schema
const ObjectId = mongoose.Types.ObjectId; //build schema

//the form of the schema
const logSchema = new Schema(
  {
    admin: { type: String, required: true },
    user: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

logSchema.index({ "$**": "text" });

const logModel = mongoose.model("Logs", logSchema);
module.exports = logModel;
