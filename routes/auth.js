const express = require("express");
const userModel = require("../models/userModel");
const bcrypt = require("bcrypt");
const validator = require("validator");
const jwt = require("jsonwebtoken");

const authRouter = express.Router();

authRouter.post("/register", async (req, res) => {
  let user = {
    name: req.body.name,
    phone: req.body.phone,
    email: req.body.email,
    address: req.body.address,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    profilePicture: req.body.profilePicture,
    gender: req.body.gender,
    premium: req.body.premium,
  };

  try {
    let isValid = await validator.isEmail(user.email);
    if (!isValid)
      return res.send({ message: "User Email is Invalid", ok: false });

    let isPasswordMatch = user.password === user.confirmPassword;
    if (!isPasswordMatch)
      return res.send({ message: "User Passwords Doesn't Match", ok: false });

    let isRegistered = await userModel.findOne({ email: user.email });
    if (isRegistered)
      return res.send({ message: "User Already Exists", ok: false });

    bcrypt.hash(user.password, 10, async (err, hash) => {
      user.password = hash;
      let thisUser = await userModel.create(user);
      thisUser.password = undefined;

      let token = createToken(thisUser);

      return res.send({
        token,
        message: "User Registered Successfully",
        ok: true,
      });
    });
  } catch (err) {
    return res.send({ message: err, ok: false });
  }
});

authRouter.post("/login", async (req, res) => {
  let user = {
    email: req.body.email,
    password: req.body.password,
  };

  try {
    let isValid = await validator.isEmail(user.email);
    if (!isValid)
      return res.send({ message: "User Email is Invalid", ok: false });

    let thisUser = await userModel.findOne({ email: user.email });

    if (!thisUser)
      return res.send({ message: "User Email Not Found", ok: false });

    bcrypt.compare(user.password, thisUser.password, async (err, result) => {
      if (result) {
        thisUser.password = undefined;
        let token = createToken(thisUser);

        return res.send({
          token,
          message: "User Logged In Successfully",
          ok: true,
        });
      } else return res.send({ message: "User Password Incorrect", ok: false });
    });
  } catch (err) {
    return res.send({ message: err, ok: false });
  }
});

const createToken = (user) => {
  let token = jwt.sign(JSON.stringify(user), process.env.JWT_SECRECT_KEY, {
    expiresIn: "3d",
  });
  return token;
};

module.exports = authRouter;
