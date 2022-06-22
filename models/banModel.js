const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//the form of the schema
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

const banModel = mongoose.model("Bans", banSchema);
module.exports = banModel;
