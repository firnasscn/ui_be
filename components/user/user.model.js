// users-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.

const bcrypt = require("bcrypt-nodejs");
const mongoose = require('mongoose');
const crypto = require("crypto");

const users = mongoose.Schema({
    userName: {
        type: String,
    },
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
    },
    about: {
        type: String,
    },
    location: {
        type: {
            type: String, // Don't do `{ location: { type: String } }`
            enum: ['Point'], // 'location.type' must be 'Point'
        },
        coordinates: {
            type: [Number],
        }
    },
    website: {
        type: String,
        lowercase: true
    },
    countryCode: {
        type: String,
        default: ""
    },
    facebookId: {
        type: String
    },
    phoneNumber: {
        type: Number,
        default: ""
    },
    lastLoggedIn: {
        type: Date
    },
    email: {
        type: String,
        unique: true,
        required: true,
    },
    dob: {
        type: Date
    },
    city: {
        type: String,
        default: "",
        lowercase: true
    },
    country: {
        type: String,
        default: "",
        lowercase: true
    },
    salt: {
        type: String
    },
    password: {
        type: String
    },
    gender: {
        type: String,
        enum: ["male", "female", "undisclosed"]
    },
    active: {
        type: Boolean,
        default: true
    },
    profilePicture: {
        type: String,
        default: ""
    },
    googleId: {
        type: String
    },
    uploadedSize: {
        type: String,
    },
    screenViewCount: {
        type: Number,
        default: 0
    },
    channelName: { type: String },
    isVerified: { type: Boolean, default: false },
    verifyToken: { type: String },
    verfiedTime: { type: Date },
    resetToken: { type: String },
    signUpToken: { type: String },
    resetTokenVerfiedTime: { type: Date },
    isAdmin: {
        type: Boolean,
        default: false
    }
},
    { timestamps: true }
);

users.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

users.methods.hashPassword = function (password) {
    if (this.salt && password) {
        return crypto
            .pbkdf2Sync(password, new Buffer(this.salt, "base64"), 10000, 64, "SHA1")
            .toString("base64");
    } else {
        return password;
    }
};

users.methods.getSaltAndPassword = function (newPassword) {
    let salt = crypto.randomBytes(16).toString("base64");
    let password = crypto
        .pbkdf2Sync(newPassword, new Buffer(salt, "base64"), 10000, 64, "SHA1")
        .toString("base64");
    return { salt: salt, password: password };
};

//method to decrypt password
users.methods.verifyPassword = function (password, isVerified) {
    console.log(password, isVerified)
    let user = this;
    console.log(this.hashPassword(password))
    if (password && isVerified)
        return this.password === this.hashPassword(password) && user.isVerified;
    else
        return this.password === this.hashPassword(password)
};

const User = mongoose.model('users', users);

module.exports = User;
