const mongoose = require("mongoose"); // connect to db
const Schema = mongoose.Schema; //build schema

//the form of the schema
const tokenSchema = new Schema({
  user: { type: String, required: true },
  createdAt: { type: Date, expires: 7200, default: Date.now },
});

const tokenModel = mongoose.model("Tokens", tokenSchema);
module.exports = tokenModel;
