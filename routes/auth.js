const express = require("express");
const userModel = require("../models/userModel");
const JOI = require("joi");
const bcrypt = require("bcrypt");

const registerSchema = JOI.object({
  name: JOI.string().min(2).max(32).required(),
  phone: JOI.string().min(4).required(),
  email: JOI.string().email().required(),
  address: JOI.string().min(2).required(),
  password: JOI.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
  confirmPassword: JOI.ref("password"),
  profilePicture: JOI.string().allow(null, ""),
  gender: JOI.string().min(4).required(),
  premium: JOI.object().allow(null, {}),
});

const loginSchema = JOI.object({
  email: JOI.string().email().required(),
  password: JOI.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
});

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
    await registerSchema.validateAsync(user);
  } catch (err) {
    return res.send({ message: err.details[0].message, ok: false });
  }

  try {
    bcrypt.hash(user.password, 10, async (err, hash) => {
      user.password = hash;
      await userModel.create(user);
      return res.send({ message: "User Registered Successfully", ok: true });
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
    await loginSchema.validateAsync(user);
  } catch (err) {
    return res.send({ message: err.details[0].message, ok: false });
  }

  try {
    let thisUser = await userModel
      .findOne({ email: user.email })
      .select("password");

    if (!thisUser)
      return res.send({ message: "User Email Not Found", ok: false });

    bcrypt.compare(user.password, thisUser.password, async (err, result) => {
      if (result)
        return res.send({ message: "User Logged In Successfully", ok: true });
      else return res.send({ message: "User Password Incorrect", ok: false });
    });
  } catch (err) {
    return res.send({ message: err, ok: false });
  }
});

module.exports = authRouter;
