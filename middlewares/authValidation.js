const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");

authValidation = async (req, res, next) => {
  let authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(403);
  let token = authHeader.split(" ")[1];
  if (!token) return res.sendStatus(403);

  jwt.verify(token, process.env.JWT_SECRECT_KEY, {}, async (err, dec) => {
    if (err) return res.send({ message: err.message, ok: false });
    res.locals.user = dec;
  });

  next();
};

module.exports = authValidation;
