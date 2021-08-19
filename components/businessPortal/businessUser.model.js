const bcrypt = require("bcrypt-nodejs");
const mongoose = require('mongoose');
const crypto = require("crypto");

const businessUser = mongoose.Schema({
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
    lastLoggedIn: {
        type: Date
    },
    email: {
        type: String,
        unique: true,
        required: true,
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
    isVerified: { type: Boolean, default: false },
    isAdmin: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

businessUser.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

businessUser.methods.hashPassword = function(password) {
    if (this.salt && password) {
        return crypto
            .pbkdf2Sync(password, new Buffer(this.salt, "base64"), 10000, 64, "SHA1")
            .toString("base64");
    } else {
        return password;
    }
};

businessUser.methods.getSaltAndPassword = function(newPassword) {
    let salt = crypto.randomBytes(16).toString("base64");
    let password = crypto
        .pbkdf2Sync(newPassword, new Buffer(salt, "base64"), 10000, 64, "SHA1")
        .toString("base64");
    return { salt: salt, password: password };
};

//method to decrypt password
businessUser.methods.verifyPassword = function(password, isVerified) {
    console.log(password, isVerified)
    let user = this;
    console.log(this.hashPassword(password))
    if (password && isVerified)
        return this.password === this.hashPassword(password) && user.isVerified;
    else
        return this.password === this.hashPassword(password)
};

const BusinessUser = mongoose.model('business_users', businessUser);

module.exports = BusinessUser;