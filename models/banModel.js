/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model } = require("mongoose");

/* Creating a new Schema for the bans collection. */
const banSchema = new Schema(
  {
    user: { type: String, required: true, unique: true },
    message: { type: String, required: true },
    days: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

/* Creating a new model for the bans collection. */
const banModel = model("Bans", banSchema);
module.exports = banModel;
