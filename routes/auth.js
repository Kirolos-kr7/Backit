const express = require("express");
const userModel = require("../models/userModel"); //connect to userModel
const { sendNotification } = require("../utils/notification"); //connect to userModel
const bcrypt = require("bcrypt"); //connect to bcrypt
const jwt = require("jsonwebtoken"); //connect to jwt
const authValidation = require("../middlewares/authValidation"); //connect to validation middlware
const authRouter = express.Router();
const JOI = require("joi");
const nodemailer = require("nodemailer");
const tokenModel = require("../models/tokenModel");
const { v1: uuid } = require("uuid");
const ImageKit = require("imagekit");

var imagekit = new ImageKit({
  publicKey: "public_QyIWVOnkYPjl4YXn3PGe3ymGrt4=",
  privateKey: "private_7WVBoOozqMA1E+OUmuJFzGi5KJ0=",
  urlEndpoint: "https://ik.imagekit.io/bidit",
});

var transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,

  auth: {
    type: "OAuth2",
    user: process.env.GOOGLE_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
    accessToken: process.env.ACCESS_TOKEN,
  },
});

const registerSchema = JOI.object({
  name: JOI.string().min(2).max(32).required(),
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net", "co"] } })
    .required(),
  password: JOI.string().min(7).max(30).required(),
  confirmPassword: JOI.string().min(7).max(30).required(),
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
  password: JOI.string().min(7).max(30).required(),
});

const resetPasswordSchema = JOI.object({
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: ["com", "net", "co"] } })
    .required(),
  password: JOI.string().min(7).max(30).required(),
  confirmPassword: JOI.string().min(7).max(30).required(),
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

    if (user.password !== user.confirmPassword)
      return res.send({ message: "Passwords Dosen't Match", ok: false });

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

      let verifyToken = await tokenModel.create({
        user: user.id,
      });

      let mailOptions = {
        from: "bidit.platform@gmail.com",
        to: user.email,
        subject: "Account Verification",
        html: `<h1>Hello ${user.name}</h1><br> Please Click on the link to verify your email.<br><a href="https://bidit.netlify.app/en/verify-email/${verifyToken._id}">Click here to verify</a>`,
      };

      transporter.sendMail(mailOptions, (err) => {
        if (err) {
          console.log(err);
          return res.send({
            message: err,
            ok: false,
          });
        } else {
          return res.send({
            data: { user: thisUser, token },
            message: "User Registered Successfully",
            ok: true,
          });
        }
      });
    });
  } catch (err) {
    console.log(err);
  }
});

authRouter.get("/send-verification-link", authValidation, async (req, res) => {
  let { user } = res.locals;

  try {
    let existingToken = await tokenModel.findOne({ user: user.id });

    if (existingToken)
      return res.send({ message: "Link Already Sent", ok: false });

    let token = await tokenModel.create({
      user: user.id,
    });

    let mailOptions = {
      from: "bidit.platform@gmail.com",
      to: user.email,
      subject: "Account Verification",
      html: `
      <h1>Hello Again</h1>
      <br>Please Click on the link to verify your email.
      <br><a href="bidit.netlify.app/en/verify-email/${token._id}">Click here to verify</a>
      `,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        return res.send({
          message: err,
          ok: false,
        });
      } else
        return res.send({
          message: "Verification Link is sent Successfully",
          ok: true,
        });
    });
  } catch (err) {
    console.log(err);
  }
});

authRouter.patch("/verify-email/:token", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { token } = req.params;

  try {
    let existingToken = await tokenModel.findOne({ _id: token });

    if (!existingToken)
      return res.send({ message: "Token Expired.", ok: false });

    let updatedUser = await userModel.updateOne(
      { _id: user.id },
      { isVerified: true }
    );

    if (updatedUser.modifiedCount > 0)
      return res.send({ message: "Email verified successfully.", ok: true });
  } catch (err) {
    console.log(err);
  }
});

// forgot-password HERE *************************************************
authRouter.get("/forgot-password", async (req, res) => {
  let { email } = req.query;

  try {
    // findOne user from db using email
    // check if a user is found
    // create a forgot password token
    // send email to user with forgot token

    if (!email)
      return res.send({ message: "User Email is Required.", ok: false });

    let existingToken = await tokenModel.findOne({
      user: email,
    });

    if (existingToken)
      return res.send({ message: "Token Already Sent.", ok: false });

    let thisUser = await userModel.findOne({ email });
    if (!thisUser) {
      return res.send({ message: "User does not exist.", ok: false });
    }

    let token = await tokenModel.create({
      user: email,
    });

    let mailOptions = {
      from: "bidit.platform@gmail.com",
      to: email,
      subject: "Forgot Password",
      html: `
      <h1>Hello Again</h1>
      <br> Please Click on the link to Reset your Password.
      <br><a href="https://bidit.netlify.app/en/reset-password/${token._id}">Click here to Reset Your Password</a>`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err)
        return res.send({
          message: err,
          ok: false,
        });
      else
        return res.send({
          message: "Reset Password Link is sent Successfully",
          ok: true,
        });
    });
  } catch (err) {
    console.log(err);
  }
});

authRouter.get("/validate-password-token", async (req, res) => {
  let { token } = req.query;

  try {
    if (token.length !== 24)
      return res.send({ message: "Invalid Token", ok: false });

    let existingToken = await tokenModel.findOne({ _id: token });
    if (!existingToken)
      return res.send({ message: "Invalid Token", ok: false });

    return res.send({ data: { email: existingToken.user }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

// reset-password HERE *************************************************
authRouter.patch("/reset-password", async (req, res) => {
  let { email, password, confirmPassword } = req.body;

  try {
    // findOne user from db using email
    // check if a user is found
    // check if password === confirmPassword
    // use bcrypt to hash new password
    // update user with hashed password

    let isValid = resetPasswordSchema.validate({
      email,
      password,
      confirmPassword,
    });

    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    if (password !== confirmPassword)
      return res.send({ message: "Passwords Dosen't Match", ok: false });

    let thisUser = await userModel.findOne({ email });

    if (!thisUser)
      return res.send({ message: "User does not exist", ok: false });

    bcrypt.hash(password, 10, async (err, hash) => {
      if (err) return res.send({ message: err, ok: false });
      else {
        let updatedUser = await userModel.updateOne(
          { email },
          { password: hash }
        );
        if (updatedUser.modifiedCount > 0) {
          let updatedToken = await tokenModel.deleteOne({ email });
          if (updatedToken.deletedCount > 0) {
            return res.send({
              message: "password reset succesfully",
              ok: true,
            });
          }
        }
      }
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

  try {
    let userData = await userModel.findById(user.id).select("notifications");

    userData.notifications.sort((a, b) => {
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);

      if (aDate < bDate) return 1;
      if (aDate > bDate) return -1;

      return 0;
    });

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

authRouter.post("/add-profile", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { image } = req.body;

  if (!image) return res.send({ message: "An image is required", ok: false });

  try {
    imagekit
      .upload({
        file: image,
        fileName: uuid(),
      })
      .then(async (result) => {
        let thisUser = await userModel.updateOne(
          { _id: user.id },
          { profilePicture: { name: result.name, fileId: result.fileId } }
        );

        if (thisUser.modifiedCount > 0)
          return res.send({
            message: "Profile Image Updated Successfully",
            ok: true,
          });
      });
  } catch (err) {
    console.log(err);
  }
});

authRouter.delete("/delete-profile", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { image } = req.body;

  try {
    imagekit.deleteFile(image.fileId, async (err) => {
      if (err) return res.send({ message: err, ok: false });
      else {
        let thisUser = await userModel.updateOne(
          { _id: user.id },
          { profilePicture: null }
        );

        if (thisUser.modifiedCount > 0)
          return res.send({
            message: "Profile Image Removed Successfully",
            ok: true,
          });
      }
    });
  } catch (err) {
    console.log(err);
  }
});

module.exports = authRouter;
