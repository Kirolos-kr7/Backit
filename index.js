const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send({ message: "Running" });
});

app.listen(8080, () => {
  console.log("Listenting on Port 8080");
});
