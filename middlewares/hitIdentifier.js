hitIdentifier = async (req, res, next) => {
  console.log(req.method.toUpperCase() + " | " + req.url);
  next();
};

module.exports = hitIdentifier;
