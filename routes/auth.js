/** LIBERARIES **/
const { Router } = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const authValidation = require("../middlewares/authValidation");
const authRouter = Router();
const JOI = require("joi");
const { sendNotification } = require("../utils/notification");
const { v1: uuid } = require("uuid");
const userModel = require("../models/userModel");
const tokenModel = require("../models/tokenModel");
const ImageKit = require("imagekit");

const mailjet = require("node-mailjet").connect(
  "92ac5ce8ae8ae0ff255cd6f5bb46ce69",
  "c9b5277b85ef2c4488014502497429c8"
);

/** INITIALIZATIONS **/
var imagekit = new ImageKit({
  publicKey: "public_QyIWVOnkYPjl4YXn3PGe3ymGrt4=",
  privateKey: "private_7WVBoOozqMA1E+OUmuJFzGi5KJ0=",
  urlEndpoint: "https://ik.imagekit.io/bidit",
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
      if (err) return res.send({ message: err, ok: true });
      user.password = hash;

      // create new user in db
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

      // create a token
      let token = await createToken(thisUser);

      // store a verification token in db
      let verifyToken = await tokenModel.create({
        user: thisUser.id,
      });

      // send mail to user with validation link
      let request = mailjet.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: "bidit.platform@gmail.com",
              Name: "Bidit",
            },
            To: [
              {
                Email: thisUser.email,
                Name: thisUser.name,
              },
            ],
            Subject: "Greetings from Bidit.",
            TextPart: "Welcome to Bidit",
            HTMLPart: `<h1>Hello ${
              thisUser.name
            }</h1><br> Please Click on the link to verify your email.<br><a href="https://bidit.netlify.app/en/verify-email/${await verifyToken._id}">Click here to verify</a>`,
          },
        ],
      });

      request
        .then(() => {
          return res.send({
            data: { user: thisUser, token },
            message: "User Registered Successfully",
            ok: true,
          });
        })
        .catch((err) => {
          console.log(err);
          return res.send({
            message: err,
            ok: false,
          });
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

    let thisUser = await userModel
      .findOne({ _id: user.id })
      .select("email name");

    let request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: "bidit.platform@gmail.com",
            Name: "Bidit",
          },
          To: [
            {
              Email: thisUser.email,
              Name: thisUser.name,
            },
          ],
          Subject: "Account Verification",
          TextPart: "Verify Your Account",
          HTMLPart: `
          <h1>Hello Again</h1>
          <br>Please Click on the link to verify your email.
          <br><a href="bidit.netlify.app/en/verify-email/${token._id}">Click here to verify</a>
          `,
        },
      ],
    });

    request
      .then(() => {
        return res.send({
          message:
            "We've sent you the verification email. Checkout your email and click the link to verify it.",
          ok: true,
        });
      })
      .catch((err) => {
        console.log(err);
        return res.send({
          message: err,
          ok: false,
        });
      });
  } catch (err) {
    console.log(err);
  }
});

authRouter.patch("/verify-email/:token", async (req, res) => {
  let { token } = req.params;

  try {
    // checking if there is a token
    let existingToken = await tokenModel.findOne({ _id: token });
    if (!existingToken)
      return res.send({ message: "Token Expired.", ok: false });

    // if a token is found then verify the user email
    let updatedUser = await userModel.updateOne(
      { _id: existingToken.user },
      { isVerified: true }
    );

    if (updatedUser.modifiedCount > 0) {
      let removedToken = await tokenModel.deleteOne({ _id: token });
      if (removedToken.deletedCount > 0)
        return res.send({ message: "Email verified successfully.", ok: true });
    }
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

    let request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: "bidit.platform@gmail.com",
            Name: "Bidit",
          },
          To: [
            {
              Email: thisUser.email,
              Name: thisUser.name,
            },
          ],
          Subject: "Forgot Password",
          TextPart: "Password reset",
          HTMLPart: `
          <h1>Hello Again</h1>
          <br> Please Click on the link to Reset your Password.
          <br><a href="https://bidit.netlify.app/en/reset-password/${token._id}">Click here to Reset Your Password</a>
          `,
        },
      ],
    });

    request
      .then(() => {
        return res.send({
          message: "Reset Password Link is sent Successfully",
          ok: true,
        });
      })
      .catch((err) => {
        console.log(err);
        return res.send({
          message: err,
          ok: false,
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
