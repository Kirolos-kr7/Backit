/* Destructuring the Schema and model from the mongoose package. */
const { Schema, model } = require("mongoose");

/* Creating a schema for the token. */
const tokenSchema = new Schema({
  user: { type: String, required: true },
  createdAt: { type: Date, expires: 7200, default: Date.now },
});

/* Creating a model for the token schema. */
const tokenModel = model("Tokens", tokenSchema);
module.exports = tokenModel;
