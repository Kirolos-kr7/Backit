/* A middleware function that logs the request method and url to the console. */
hitIdentifier = async (req, res, next) => {
  console.log(req.method.toUpperCase() + " | " + req.url);
  next();
};

module.exports = hitIdentifier;
