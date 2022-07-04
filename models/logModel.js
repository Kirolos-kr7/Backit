/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model } = require("mongoose");

/* Creating a schema for the database. */
const logSchema = new Schema(
  {
    admin: { type: String, required: true },
    user: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

/* Creating a text index on all fields in the schema. */
logSchema.index({ "$**": "text" });

/* Creating a model called "Logs" using the logSchema. */
const logModel = model("Logs", logSchema);
module.exports = logModel;
