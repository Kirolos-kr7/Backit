const jwt = require("jsonwebtoken");

authValidation = async (req, res, next) => {
  let authHeader = req.headers.authorization;
  if (!authHeader)
    return res.send({
      mesaage: "Forbidden. No User Auth Header Included",
      ok: false,
    });

  let token = authHeader.split(" ")[1];
  if (!token)
    return res.send({
      mesaage: "Forbidden. No User Token Included",
      ok: false,
    });

  jwt.verify(token, process.env.JWT_SECRECT_KEY, {}, async (err, dec) => {
    if (err) return res.send({ message: err.message, ok: false });
    res.locals.user = dec;
    next();
  });
};

module.exports = authValidation;
