const jwt = require("jsonwebtoken");

/* A middleware function that is used to validate the user token. */
authValidation = async (req, res, next) => {
  let authHeader = req.headers.authorization;
  let token = authHeader.split(" ")[1];

  if (!authHeader && !token)
    return res.status(401).json({
      mesaage: "Authorization Required. No User Auth Header Included",
      ok: false,
    });

  jwt.verify(token, process.env.JWT_SECRECT_KEY, {}, async (err, dec) => {
    if (err) return res.status(400).json({ message: err.message, ok: false });
    res.locals.user = dec;
    next();
  });
};

module.exports = authValidation;
