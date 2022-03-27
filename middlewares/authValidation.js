const jwt = require("jsonwebtoken");

authValidation = (req, res, next) => {
  let token = null;

  if (!token)
    return res
      .sendStatus(403)
      .send({ message: "Forbidden.. Token not included" });

  let isValid = jwt.verify(token, process.env.JWT_SECRECT_KEY);
  res.locals.isValid = isValid;

  if (!isValid)
    return res
      .sendStatus(403)
      .send({ message: "Forbidden.. Token is invalid" });

  next();
};

module.exports = authValidation;
