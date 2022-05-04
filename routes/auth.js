const express = require("express");
const userModel = require("../models/userModel"); //connect to userModel
const { sendNotification } = require("../utils/notification"); //connect to userModel
const bcrypt = require("bcrypt"); //connect to bcrypt
const jwt = require("jsonwebtoken"); //connect to jwt
const authValidation = require("../middlewares/authValidation"); //connect to validation middlware
const authRouter = express.Router();
const JOI = require("joi");

const registerSchema = JOI.object({
  name: JOI.string().min(2).max(32).required(),
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net", "co"] } })
    .required(),
  password: JOI.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
  confirmPassword: JOI.ref("password"),
  address: JOI.string().min(2).required(),
  gender: JOI.string().min(4).required(),
  isAdmin: JOI.boolean(),
  phone: JOI.string().min(6).required(),
  profilePicture: JOI.string().allow(null, ""),
  premium: JOI.object().allow(null, {}),
});

//login
const loginSchema = JOI.object({
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net", "co"] } })
    .required(),
  password: JOI.string().pattern(new RegExp("^[a-zA-Z0-9]{3,30}$")).required(),
});

//register
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
  };

  try {
    let isValid = registerSchema.validate(user);
    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    let isRegistered = await userModel.findOne({ email: user.email });
    if (isRegistered)
      return res.send({ message: "User Already Exists", ok: false });

    bcrypt.hash(user.password, 10, async (err, hash) => {
      user.password = hash;
      let thisUser = await userModel.create(user);
      thisUser.password = undefined;
      thisUser.notifications = undefined;

      sendNotification({
        userID: thisUser._id,
        title: {
          ar: "مرحباٌ بك في Bidit!",
          en: "Welcome to Bidit!",
        },
        message: {
          ar: `مرحباٌ بك يا ${thisUser.name} على منصتنا نحن سعداء بوجودك.`,
          en: `Hello ${thisUser.name} We are deligted to have you aboard.`,
        },
      });

      let token = await createToken(thisUser);
      return res.send({
        data: { user: thisUser, token },
        message: "User Registered Successfully",
        ok: true,
      });
    });
  } catch (err) {
    console.log(err);
  }
});

//login
authRouter.post("/login", async (req, res) => {
  let user = {
    email: req.body.email,
    password: req.body.password,
  };

  try {
    let isValid = loginSchema.validate(user);
    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    let thisUser = await userModel.findOne({ email: user.email });

    if (!thisUser)
      return res.send({ message: "User Email Not Found", ok: false });

    bcrypt.compare(user.password, thisUser.password, async (err, result) => {
      if (result) {
        thisUser.password = undefined;
        thisUser.notifications = undefined;

        let token = await createToken(thisUser);
        return res.send({
          data: { user: thisUser, token },
          message: "User Logged In Successfully",
          ok: true,
        });
      } else return res.send({ message: "User Password Incorrect", ok: false });
    });
  } catch (err) {
    console.log(err);
  }
});

//get user data
authRouter.get("/user", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    let userData = await userModel.findById({ _id: user.id });
    userData.password = undefined;

    res.send({ data: userData, ok: true });
  } catch (err) {
    console.log(err);
  }
});

//To change UserRole
authRouter.patch("/user-role", authValidation, async (req, res) => {
  let user = res.locals.user;
  let email = req.body.email;
  if (user.isAdmin) {
    try {
      let isRegistered = await userModel.findOne({ email });
      if (!isRegistered)
        return res.send({ message: "User Not Found", ok: false });

      let updatedUser = await userModel.updateOne(
        { email },
        { isAdmin: !isRegistered.isAdmin }
      );
      if (updatedUser.modifiedCount > 0) {
        return res.send({
          message: "User Role is Changed",
          ok: true,
        });
      }
    } catch (err) {
      console.log(err);
    }
  } else {
    // if not admin
    res.send({ message: "Access Denied", ok: false });
  }
});

//get user notifications
authRouter.get("/notifications", authValidation, async (req, res) => {
  let { user } = res.locals;
  let sortBy = req.query.sortBy || "createdAt";
  let dir = req.query.dir || -1;

  try {
    let userData = await userModel
      .findById(user.id)
      .sort([[sortBy, dir]])
      .select("notifications");

    return res.send({
      data: userData.notifications,
      ok: true,
    });
  } catch (err) {
    console.log(err);
  }
});

authRouter.post(
  "/notifications/broadcast",
  authValidation,
  async (req, res) => {
    let user = res.locals.user;
    let { title, message, redirect } = req.body;

    if (!user.isAdmin) return res.send({ message: "Access Denied", ok: false });

    try {
      let users = await userModel.find();

      for (let i = 0; i < users.length; i++) {
        users[i].notifications.push({
          title,
          message,
          redirect,
        });

        await users[i].save();
      }

      return res.send({
        message: "Broadcasted Successfully",
        ok: true,
      });
    } catch (err) {
      console.log(err);
    }
  }
);

authRouter.patch(
  "/notifications/seen/:ntID",
  authValidation,
  async (req, res) => {
    let user = res.locals.user;
    let { ntID } = req.params;

    return;

    try {
      let userData = await userModel.findById(user.id);

      userData.notifications.id(ntID).seen = true;
      userData.markModified("notifications");
      await userData.save();

      return res.send({
        message: "Notification Seen Successfully",
        ok: true,
      });
    } catch (err) {
      console.log(err);
    }
  }
);

// create a token
const createToken = async (user) => {
  let token = jwt.sign(
    { email: user.email, id: user._id, isAdmin: user.isAdmin },
    process.env.JWT_SECRECT_KEY,
    {
      expiresIn: "3d",
    }
  );

  return token;
};

module.exports = authRouter;
