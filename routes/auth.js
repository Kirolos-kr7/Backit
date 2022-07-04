/** IMPORTS **/
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
const ObjectId = require("mongoose").Types.ObjectId;
const banModel = require("../models/banModel");
const dayjs = require("dayjs");

/** INITIALIZATIONS **/
/* Connecting to the Mailjet API. */
const mailjet = require("node-mailjet").connect(
  "92ac5ce8ae8ae0ff255cd6f5bb46ce69",
  "c9b5277b85ef2c4488014502497429c8"
);

/* Creating a new instance of the ImageKit class. */
const imagekit = new ImageKit({
  publicKey: "public_QyIWVOnkYPjl4YXn3PGe3ymGrt4=",
  privateKey: "private_7WVBoOozqMA1E+OUmuJFzGi5KJ0=",
  urlEndpoint: "https://ik.imagekit.io/bidit",
});

/** VALIDATION SCHEMAS **/
const registerSchema = JOI.object({
  name: JOI.string().min(2).max(32).required(),
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: false } })
    .required(),
  password: JOI.string().min(7).max(30).required(),
  confirmPassword: JOI.string().min(7).max(30).required(),
  address: JOI.string().min(2).required(),
  gender: JOI.string().min(4).required(),
  isAdmin: JOI.boolean(),
  phone: JOI.string().min(11).max(11).required(),
  profilePicture: JOI.string().allow(null, ""),
});

const editAccount = JOI.object({
  name: JOI.string().min(2).max(32).required(),
  address: JOI.string().min(2).required(),
  phone: JOI.string().min(11).max(11).required(),
});

const loginSchema = JOI.object({
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: false } })
    .required(),
  password: JOI.string().min(7).max(30).required(),
});

const resetPasswordSchema = JOI.object({
  email: JOI.string()
    .email({ minDomainSegments: 2, tlds: { allow: false } })
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
      return res
        .status(400)
        .json({ message: isValid.error.details[0].message, ok: false });
    }

    // check if password dosen't match
    if (user.password !== user.confirmPassword)
      return res
        .status(400)
        .json({ message: "Passwords Dosen't Match", ok: false });

    // check if user exists
    let isRegistered = await userModel.findOne({ email: user.email });
    if (isRegistered)
      return res
        .status(400)
        .json({ message: "User Already Exists", ok: false });

    // hash password using bcrypt
    bcrypt.hash(user.password, 10, async (err, hash) => {
      if (err) return res.status(400).json({ message: err.message, ok: true });
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
          return res.status(200).json({
            data: { user: thisUser, token },
            message: "User Registered Successfully",
            ok: true,
          });
        })
        .catch((err) => {
          return res.status(400).json({
            message: err,
            ok: false,
          });
        });
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.get("/send-verification-link", authValidation, async (req, res) => {
  let { user } = res.locals;

  try {
    // check if a token is already created for user email verification
    let existingToken = await tokenModel.findOne({ user: user.id });
    if (existingToken)
      return res.status(400).json({ message: "Link Already Sent", ok: false });

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
          <br><a href="https://bidit.netlify.app/en/verify-email/${token._id}">Click here to verify</a>
          `,
        },
      ],
    });

    request
      .then(() => {
        return res.status(200).json({
          message:
            "We've sent you the verification email. Checkout your email and click the link to verify it.",
          ok: true,
        });
      })
      .catch((err) => {
        return res.status(400).json({
          message: err.message,
          ok: false,
        });
      });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.patch("/verify-email/:token", async (req, res) => {
  let { token } = req.params;

  try {
    // checking if there is a token
    let existingToken = await tokenModel.findOne({ _id: token });
    if (!existingToken)
      return res.status(400).json({ message: "Token Expired.", ok: false });

    // if a token is found then verify the user email
    let updatedUser = await userModel.updateOne(
      { _id: existingToken.user },
      { isVerified: true }
    );

    if (updatedUser.modifiedCount > 0) {
      let removedToken = await tokenModel.deleteOne({ _id: token });
      if (removedToken.deletedCount > 0)
        return res
          .status(200)
          .json({ message: "Email verified successfully.", ok: true });
    }
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.get("/forgot-password", async (req, res) => {
  let { email } = req.query;

  try {
    // creating an email schema and validating the email
    let emaiSchema = JOI.object({
      email: JOI.string()
        .email({ minDomainSegments: 2, tlds: { allow: false } })
        .required(),
    });

    let isValid = emaiSchema.validate({ email });
    if (isValid.error) {
      return res
        .status(400)
        .json({ message: isValid.error.details[0].message, ok: false });
    }

    // checking if a token exists
    let existingToken = await tokenModel.findOne({
      user: email,
    });

    // if found then sent that it's already sent
    if (existingToken)
      return res
        .status(400)
        .json({ message: "Token Already Sent.", ok: false });

    // chack if the user is found
    let thisUser = await userModel.findOne({ email });
    if (!thisUser) {
      return res
        .status(400)
        .json({ message: "User does not exist.", ok: false });
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
        return res.status(200).json({
          message: "Reset Password Link is sent Successfully",
          ok: true,
        });
      })
      .catch((err) => {
        return res.status(400).json({
          message: err,
          ok: false,
        });
      });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.get("/validate-password-token", async (req, res) => {
  let { token } = req.query;

  try {
    // validating sent token
    if (!ObjectId.isValid(token))
      res.status(404).json({ message: "Token not found", ok: false });

    // chcking if sent token exists in db
    let existingToken = await tokenModel.findOne({ _id: token });
    if (!existingToken)
      return res.status(400).json({ message: "Invalid Token", ok: false });

    // sending user email back
    return res
      .status(200)
      .json({ data: { email: existingToken.user }, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.patch("/reset-password", async (req, res) => {
  let { email, password, confirmPassword } = req.body;

  try {
    // validating email and password, confirmPassword
    let isValid = resetPasswordSchema.validate({
      email,
      password,
      confirmPassword,
    });
    if (isValid.error) {
      return res
        .status(400)
        .json({ message: isValid.error.details[0].message, ok: false });
    }

    // check if password === confirmPassword
    if (password !== confirmPassword)
      return res
        .status(400)
        .json({ message: "Passwords Dosen't Match", ok: false });

    // get user from db
    let thisUser = await userModel.findOne({ email });

    // check if user exists
    if (!thisUser)
      return res
        .status(400)
        .json({ message: "User does not exist", ok: false });

    // hashing new password
    bcrypt.hash(password, 10, async (err, hash) => {
      if (err) return res.status(400).json({ message: err.message, ok: false });
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
            return res.status(200).json({
              message: "password reset succesfully",
              ok: true,
            });
          }
        }
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
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
      return res
        .status(400)
        .json({ message: isValid.error.details[0].message, ok: false });
    }

    // checking if a user exists
    let thisUser = await userModel.findOne({ email: user.email });
    if (!thisUser)
      return res
        .status(400)
        .json({ message: "User Email Not Found", ok: false });

    // get banned user
    let xUser = await banModel.findOne({ user: user.email });

    // check if user is banned
    if (xUser) {
      if (xUser.days === 0)
        return res.status(400).json({
          message: `Your account has been banned forever you need to contact support`,
          ok: false,
        });

      let today = dayjs();
      let banDay = dayjs(xUser.createdAt);
      let duration = today.diff(banDay, "d");

      if (duration >= xUser.days) {
        await banModel.deleteOne({ _id: xUser._id });
      } else {
        return res.status(400).json({
          message: `Your account has been banned wait ${
            xUser.days - duration
          } days or contact support`,
          ok: false,
        });
      }
    }

    // comparing hashed password with user password
    bcrypt.compare(user.password, thisUser.password, async (err, result) => {
      if (result) {
        thisUser.password = undefined;
        thisUser.notifications = undefined;

        // creating a user token and logging user in
        let token = await createToken(thisUser);
        return res.status(200).json({
          data: { user: thisUser, token },
          message: "User Logged In Successfully",
          ok: true,
        });
      } else
        return res
          .status(400)
          .json({ message: "User Password Incorrect", ok: false });
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.patch("/edit-account", authValidation, async (req, res) => {
  let { user } = res.locals;

  let userData = {
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
  };

  try {
    let isValid = editAccount.validate(userData);
    if (isValid.error) {
      return res
        .status(400)
        .json({ message: isValid.error.details[0].message, ok: false });
    }

    let updatedUser = await userModel.updateOne({ _id: user.id }, userData);
    if (updatedUser.modifiedCount > 0) {
      let xUser = await userModel.findOne({ _id: user.id }).select("-password");
      return res.status(200).json({
        data: xUser,
        message: "Profile Updated Successfully",
        ok: true,
      });
    }
    res.status(400).json({ message: "Profile Update Failed", ok: false });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.get("/user", authValidation, async (req, res) => {
  let { user } = res.locals;

  try {
    // getting user data
    let userData = await userModel
      .findById({ _id: user.id })
      .select("-password");

    // sending response with user data
    res.status(200).json({ data: userData, ok: true });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.get("/notifications", authValidation, async (req, res) => {
  let { user } = res.locals;

  try {
    userModel
      .findOne({ _id: user.id })
      .then((doc) => {
        doc.notifications.forEach((nt) => {
          nt.seen = true;
        });
        doc.save();
      })
      .then(async () => {
        let userData = await userModel
          .findById(user.id)
          .select("notifications");

        userData.notifications.sort((a, b) => {
          const aDate = new Date(a.createdAt);
          const bDate = new Date(b.createdAt);

          if (aDate < bDate) return 1;
          if (aDate > bDate) return -1;

          return 0;
        });

        // sending sorted notifications
        return res.status(200).json({
          data: userData.notifications,
          ok: true,
        });
      })
      .catch((err) => {
        res.status(400).json({ message: err.message, ok: false });
      });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.post("/add-profile", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { image } = req.body;

  try {
    // checking if an image exists
    if (!image)
      return res
        .status(400)
        .json({ message: "An image is required", ok: false });

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
          return res.status(200).json({
            message: "Profile Image Updated Successfully",
            ok: true,
          });
      });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

authRouter.delete("/delete-profile", authValidation, async (req, res) => {
  let { user } = res.locals;
  let { image } = req.body;

  try {
    // checking if an image exists
    if (!image)
      return res
        .status(400)
        .json({ message: "An image is required", ok: false });

    // deleting required image
    imagekit.deleteFile(image.fileId, async (err) => {
      if (err) return res.status(400).json({ message: err.message, ok: false });
      else {
        // updating user with new image details
        let thisUser = await userModel.updateOne(
          { _id: user.id },
          { profilePicture: null }
        );

        if (thisUser.modifiedCount > 0)
          return res.status(200).json({
            message: "Profile Image Removed Successfully",
            ok: true,
          });
      }
    });
  } catch (err) {
    res.status(400).json({ message: err.message, ok: false });
  }
});

/**
 * It creates a token for the user to log in.
 * @param user - the user object that is returned from the database
 * @returns A token
 */
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
