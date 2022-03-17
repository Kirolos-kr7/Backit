const express = require("express");
const mongoose = require('mongoose');
const itemRoute = require('./routes/item');

const app = express();

// connect to mongodb & listen for requests
const dbURI = 'mongodb+srv://bidit:bidit8@cluster0.ybuco.mongodb.net/Bidit?retryWrites=true&w=majority';

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(result => console.log("db connected"))
  .catch(err => console.log(err));

app.get("/", (req, res) => {
  res.send({ message: "Running" });
});

app.listen(8080, () => {
  console.log("Listenting on Port 8080");
});



