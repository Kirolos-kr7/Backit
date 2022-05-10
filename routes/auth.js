/** LIBERARIES **/
const { Router } = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authValidation = require("../middlewares/authValidation");
const authRouter = Router();
const JOI = require("joi");
const nodemailer = require("nodemailer");
const { sendNotification } = require("../utils/notification");
const { v1: uuid } = require("uuid");
const userModel = require("../models/userModel");
const tokenModel = require("../models/tokenModel");
const ImageKit = require("imagekit");

/** INITIALIZATIONS **/
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

/** VALIDATION SCHEMAS **/
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

/** ENDPOINTS **/
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
    // validation
    let isValid = registerSchema.validate(user);
    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    // check if password dosen't match
    if (user.password !== user.confirmPassword)
      return res.send({ message: "Passwords Dosen't Match", ok: false });

    // check if user exists
    let isRegistered = await userModel.findOne({ email: user.email });
    if (isRegistered)
      return res.send({ message: "User Already Exists", ok: false });

    // hash password using bcrypt
    bcrypt.hash(user.password, 10, async (err, hash) => {
      user.password = hash;

      // create new user in db
      let thisUser = await userModel.create(user);
      thisUser.password = undefined;
      thisUser.notifications = undefined;

      // send weclome notification
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

      // create a token
      let token = await createToken(thisUser);

      // store a verification token in db
      let verifyToken = await tokenModel.create({
        user: user.id,
      });

      let mailOptions = {
        from: "bidit.platform@gmail.com",
        to: user.email,
        subject: "Account Verification",
        html: `<h1>Hello ${user.name}</h1><br> Please Click on the link to verify your email.<br><a href="https://bidit.netlify.app/en/verify-email/${verifyToken._id}">Click here to verify</a>`,
      };

      // send mail to user with validation link
      transporter.sendMail(mailOptions, (err) => {
        // check if error happened while sending mail
        if (err) {
          console.log(err);
          return res.send({
            message: err,
            ok: false,
          });
        } else {
          // send user the account info and logging him in using token
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
    // check if a token is already created for user email verification
    let existingToken = await tokenModel.findOne({ user: user.id });
    if (existingToken)
      return res.send({ message: "Link Already Sent", ok: false });

    // creating an email verification token
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

    // sending an email with the verification token
    transporter.sendMail(mailOptions, (err) => {
      // check if error happened while sending mail

      if (err) {
        return res.send({
          message: err,
          ok: false,
        });
      }
      // asserting email is sent successfully
      else
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
    // checking if there is a token
    let existingToken = await tokenModel.findOne({ _id: token });
    if (!existingToken)
      return res.send({ message: "Token Expired.", ok: false });

    // if a token is found then verify the user email
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

authRouter.get("/forgot-password", async (req, res) => {
  let { email } = req.query;

  try {
    // creating an email schema and validating the email
    let emaiSchema = JOI.object({
      email: JOI.string()
        .email({ minDomainSegments: 2, tlds: { allow: ["com", "net", "co"] } })
        .required(),
    });

    let isValid = emaiSchema.validate({ email });
    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    // checking if a token exists
    let existingToken = await tokenModel.findOne({
      user: email,
    });

    // if found then sent that it's already sent
    if (existingToken)
      return res.send({ message: "Token Already Sent.", ok: false });

    // chack if the user is found
    let thisUser = await userModel.findOne({ email });
    if (!thisUser) {
      return res.send({ message: "User does not exist.", ok: false });
    }

    // create a forgot password token and save it in db
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

    // send recovery email to user
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
    // validating sent token
    if (token.length !== 24)
      return res.send({ message: "Invalid Token", ok: false });

    // chcking if sent token exists in db
    let existingToken = await tokenModel.findOne({ _id: token });
    if (!existingToken)
      return res.send({ message: "Invalid Token", ok: false });

    // sending user email back
    return res.send({ data: { email: existingToken.user }, ok: true });
  } catch (err) {
    console.log(err);
  }
});

authRouter.patch("/reset-password", async (req, res) => {
  let { email, password, confirmPassword } = req.body;

  try {
    // findOne user from db using email
    // check if a user is found
    // check if password === confirmPassword
    // use bcrypt to hash new password
    // update user with hashed password

    // validating email and password, confirmPassword
    let isValid = resetPasswordSchema.validate({
      email,
      password,
      confirmPassword,
    });
    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    // check if password === confirmPassword
    if (password !== confirmPassword)
      return res.send({ message: "Passwords Dosen't Match", ok: false });

    // get user from db
    let thisUser = await userModel.findOne({ email });

    // check if user exists
    if (!thisUser)
      return res.send({ message: "User does not exist", ok: false });

    // hashing new password
    bcrypt.hash(password, 10, async (err, hash) => {
      if (err) return res.send({ message: err, ok: false });
      else {
        // saving new hashed password in db
        let updatedUser = await userModel.updateOne(
          { email },
          { password: hash }
        );
        if (updatedUser.modifiedCount > 0) {
          // removing password token
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

authRouter.post("/login", async (req, res) => {
  let user = {
    email: req.body.email,
    password: req.body.password,
  };

  // validating login data
  try {
    let isValid = loginSchema.validate(user);
    if (isValid.error) {
      return res.send({ message: isValid.error.details[0].message, ok: false });
    }

    // checking if a user exists
    let thisUser = await userModel.findOne({ email: user.email });
    if (!thisUser)
      return res.send({ message: "User Email Not Found", ok: false });

    // comparing hashed password with user password
    bcrypt.compare(user.password, thisUser.password, async (err, result) => {
      if (result) {
        thisUser.password = undefined;
        thisUser.notifications = undefined;

        // creating a user token and logging user in
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

authRouter.get("/user", authValidation, async (req, res) => {
  let user = res.locals.user;

  try {
    // getting user data
    let userData = await userModel.findById({ _id: user.id });
    // removing hashed password
    userData.password = undefined;

    // sending response with user data
    res.send({ data: userData, ok: true });
  } catch (err) {
    console.log(err);
  }
});

authRouter.patch("/user-role", authValidation, async (req, res) => {
  let user = res.locals.user;
  let email = req.body.email;

  try {
    // checking if a user is admin
    if (!user.isAdmin) res.send({ message: "Access Denied", ok: false });

    // checking if a user exists
    let isRegistered = await userModel.findOne({ email });
    if (!isRegistered)
      return res.send({ message: "User Not Found", ok: false });

    // changing user's admin privlages and saving in db
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
});

authRouter.get("/notifications", authValidation, async (req, res) => {
  let { user } = res.locals;

  try {
    // getting user notifications
    let userData = await userModel.findById(user.id).select("notifications");

    // sorting user notification from newer to older
    userData.notifications.sort((a, b) => {
      const aDate = new Date(a.updatedAt);
      const bDate = new Date(b.updatedAt);

      if (aDate < bDate) return 1;
      if (aDate > bDate) return -1;

      return 0;
    });

    // sending sorted notifications
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

    // checking if a user is admin
    if (!user.isAdmin) return res.send({ message: "Access Denied", ok: false });

    try {
      // getting all user
      let users = await userModel.find();

      // sending notification for each user in db
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

// NOT DONE
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

authRouter.post("/add-profile", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { image } = req.body;

  try {
    // checking if an image exists
    if (!image) return res.send({ message: "An image is required", ok: false });

    // uploading image to imagekit
    imagekit
      .upload({
        file: image,
        fileName: uuid(),
      })
      .then(async (result) => {
        // updating user with new image details
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
    // checking if an image exists
    if (!image) return res.send({ message: "An image is required", ok: false });

    // deleting required image
    imagekit.deleteFile(image.fileId, async (err) => {
      if (err) return res.send({ message: err, ok: false });
      else {
        // updating user with new image details
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

/** FUNCTIONS **/
const createToken = async (user) => {
  // creating a jwt token to log users in
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
