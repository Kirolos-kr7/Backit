/* A middleware function that checks if the user is an admin. */
isAdmin = async (req, res, next) => {
  let { user } = res.locals;

  if (!user.isAdmin)
    return res.status(403).json({ message: "Access Denied!", ok: false });
  else next();
};

module.exports = isAdmin;
