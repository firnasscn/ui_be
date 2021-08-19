require("dotenv").config();

const Joi = require('joi');
const User = require('../user/user.model');
const Response = require('../../utils/response');
const crypto = require('crypto-random-string');
const moment = require('moment');
const mailer = require('../../utils/mailService');
const authenticateService = require('../../utils/authenticate');
const jwt = require("jsonwebtoken");
const focusGroupCntrl = require('../focusGroup/focusGroup.controller');
const subscription = require('../Subscribers/subscribers.modal')
const loginHistory = require('../loginHistory/loginHistory.model')

// const Project = require('../project/project.model');

const _ = require('lodash');

const sanitize = user => {
    //remove sensitive data

    user.profilePicture = (!!user.profilePicture) ? `https://d31qgkthzchm5g.cloudfront.net/profilePicture/${user.profilePicture}` : user.profilePicture;
    user.isGoogleUser = (!!user.googleId) ? true : false
    user.isPasswordUpdate = (!!user.password) ? true : false
    user.password = user.salt = user.verifyToken = user.resetToken = user.resetTokenVerfiedTime = user.verfiedTime = user.__v = user.createdAt = user.updatedAt = user.lastLoggedIn = undefined;

    return user;
};

function componentOneCtrl(model) {
    const methods = {
        /**
         * Registration
         */
        signUp: async(req, res) => {
            try {
                //Joi Input validation
                const schema = Joi.object().keys({
                    userName: Joi.string().trim().min(5).max(30).required().label('UserName'),
                    phoneNumber: Joi.string().label('phone number').trim().regex(/^\d{10}$/).label('Phone number').options({
                        language: {
                            string: {
                                regex: {
                                    base: 'should be a valid mobile number'
                                }
                            }
                        }
                    }),
                    password: Joi.string().trim().min(8).max(30).label('Password'),
                    email: Joi.string().trim().regex(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).label('email').required(),
                    gender: Joi.string().valid(["male", "female", "undisclosed"]),
                    dob: Joi.date(), //.format('YYYY-MM-DD')
                    firstName: Joi.string().trim(),
                    lastName: Joi.string().trim(),
                    about: Joi.string().trim(),
                    countryCode: Joi.string().trim(),
                    country: Joi.string().trim(),
                    profilePicture: Joi.string().trim().allow(''),
                    active: Joi.boolean(),
                    focusGroupToken: Joi.string().trim(),
                    googleId: Joi.string().trim(),
                    tokenId: Joi.string(),
                    occupation: Joi.string(),
                    verifyEmail: Joi.boolean()
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg[0]);
                }

                if (!error) {

                    let checkWaitList = await subscription.find({ email: req.body.email });

                    if (checkWaitList.length == 0) {
                        let obj = {
                            email: req.body.email
                        };
                        await subscription.create(obj);
                        // return Response.badValuesData(res, 'If you want to signup, Please subscribe first')
                    }

                    let updateSubscribe = await subscription.update({ email: req.body.email }, { $set: { signUpStatus: 1 } })

                    if (req.body.googleId) {
                        const lGoogleBackendVerification = await authenticateService.verify(req.body.tokenId, req.body.googleId)
                    }
                    let userData = new User(value);

                    //Generate hashed password
                    if (req.body.password) {
                        console.log(req.body.password)
                        let newPassword = req.body.password;
                        let newSaltAndPass = User(userData).getSaltAndPassword(newPassword);
                        userData.salt = newSaltAndPass.salt;
                        userData.password = newSaltAndPass.password;
                        userData.isVerified = false;
                    }
                    if (req.body.googleId || req.body.verifyEmail == true) {
                        userData.isVerified = true;
                    }
                    console.log(userData)
                    userData.channelName = `FG-${crypto(6)}`;

                    let lObjRes = await userData.save(userData);
                    //Verification Token
                    let expiry = '1 days'; //Expires in 1 day

                    const { _id, email, userName } = lObjRes.toObject(),
                        tokenData = { _id, email, userName };

                    var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                        expiresIn: expiry
                    });
                    const signUptokenData = { email };
                    var signUpToken = jwt.sign(signUptokenData, process.env.SUPER_SECRET, {
                        expiresIn: expiry
                    });
                    if (!req.body.googleId && !req.body.verifyEmail) {
                        //Send Email for verification purpose
                        // let mailData = {
                        //     "firstName": userData.firstName,
                        //     "lastName": userData.lastName,
                        //     "email": userData.email.toLowerCase(),
                        //     "verifyToken": token,
                        //     //"link": `${process.env.BASE_URL}v1/auth/verifyEmailToken?token=${token}`,
                        //     "link": `${process.env.BASE_URL}login?verifyEmailToken=${token}`,
                        //     "mailType": "Your registration is successfull"
                        // }
                        // mailer.authenticationEmail(mailData)

                        let mailData = {
                            email: userData.email.toLowerCase()
                        }
                        mailer.welcomeInvitation(mailData)

                        //Save the verification token
                        User.findOneAndUpdate({
                                _id: lObjRes._id
                            }, {
                                $set: {
                                    // verifyToken: token,
                                    signUpToken: signUpToken
                                }
                            }, {
                                new: true
                            },
                            async(err, user) => {
                                if (err) {
                                    return Response.error(res, 400, err);
                                } else {
                                    user = sanitize(user) //Remove Sensitive Data
                                    if (!!req.body.focusGroupToken) {
                                        req.body['joinedUser'] = user._id;
                                        req.body['returnResponse'] = false;
                                        req.query['token'] = req.body.focusGroupToken;
                                        await focusGroupCntrl.acceptInvitation(req, res)
                                    }

                                    return Response.success(res, user, 'Your account has been created. Welcome aboard! ');
                                }
                            });
                    } else {
                        lObjRes.lastLoggedIn = Date.now();
                        let user = await lObjRes.save();
                        const { _id, email, userName, lastLoggedIn } = user.toObject(),
                            tokenData = { _id, email, userName, lastLoggedIn };

                        var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                            expiresIn: 60 * 60 * 24
                        });
                        user = sanitize(user) //Remove Sensitive Data
                        let lObjResponse = {
                            token: token,
                            data: user
                        }
                        return Response.success(res, lObjResponse, 'Logged in successfully')
                    }
                }

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Check the Email already Exist
         */
        checkEmailExist: async(req, res, next) => {
            try {
                let lStrEmail = req.body.email ? req.body.email.toLowerCase() : req.body.email
                    //Check Email Already exist or not
                let check, checkUserName
                if (req.body.googleId) {
                    check = await User.findOne({ $and: [{ email: lStrEmail }, { googleId: req.body.googleId }] }).lean();
                    checkUserName = await User.findOne({ userName: req.body.userName }).lean();
                } else {
                    check = await User.findOne({ email: lStrEmail }).lean();
                    checkUserName = await User.findOne({ userName: req.body.userName }).lean();
                }

                if (check == null && checkUserName == null) next()
                let lUserObj = {
                    email: (check != null) ? "Email already exist" : '',
                    userName: (checkUserName != null) ? "User name already exist" : ''
                }
                if (check !== null || checkUserName !== null) return Response.message(res, 400, lUserObj)
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        checkUserName: async(req, res, next) => {
            try {

                //Check Email Already exist or not
                checkUserName = await User.findOne({ userName: req.body.username }).lean();
                if (checkUserName == null) {
                    return Response.success(res, "User name doesn't exists !!")
                } else {
                    if (checkUserName !== null) return Response.badValues(res, 'User name already exists!!')
                }

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        /**
         * Get User name based on email 
         * input : (email)
         */
        getUserDetailsByName: async(req, res, next) => {
            try {
                //Get the username based on email
                let check = await User.findOne({
                    $or: [
                        { email: req.body.email.toLowerCase() },
                        { userName: req.body.email.toLowerCase() }
                    ]
                }).select('userName isVerified').lean();
                console.log(check, "check")
                if (check == null) return Response.message(res, 404, "User not found")
                if (check !== null) return Response.success(res, check)
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Check the UserName already Exist
         */
        checkUserNameExist: async(req, res, next) => {
            try {
                //Check UserName Already exist or not
                let check = await User.findOne({ userName: req.body.userName }).lean();
                if (check == null) next()
                let lUserObj = {
                    userName: "UserName already exist"
                }
                if (check !== null) return Response.message(res, 400, lUserObj)
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        forgotPassword: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    email: Joi.string().trim().regex(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).required().label("Invalid Email address"),
                }).required()

                let { error, value } = Joi.validate(req.body, schema);
                if (error) return Response.badValuesData(res, error)

                if (!error) {
                    let lObjUserDetails = await User.findOne({ email: req.body.email }).select('_id firstName lastName email').lean();
                    console.log(lObjUserDetails)
                    if (lObjUserDetails == null) {
                        return Response.notFound(res, `This account doesn't exist. Try creating one!!`)
                    } else {
                        let forgetPasswordToken = crypto(20);
                        //Verification Token
                        let expiry = '1h'; //Expires in 1 Hour
                        let token = jwt.sign({
                            _id: lObjUserDetails._id,
                            forgetPasswordToken
                        }, process.env.SUPER_SECRET, {
                            expiresIn: expiry
                        });

                        //Send Email for verification purpose
                        let mailData = {
                                "firstName": lObjUserDetails.firstName,
                                "lastName": lObjUserDetails.lastName,
                                "email": lObjUserDetails.email,
                                "verifyToken": token,
                                "mailType": "Password Reset",
                                link: `${process.env.BASE_URL}reset-password?token=${token}`
                            }
                            // mailer.authenticationEmail(mailData)
                        mailer.forgotPassword(mailData)

                        User.findOneAndUpdate({
                                _id: lObjUserDetails._id,
                            }, {
                                $set: { resetToken: forgetPasswordToken }
                            },
                            (err, user) => {
                                if (err) {
                                    return Response.error(res, 400, err);
                                } else {
                                    let data = {
                                        "email": user.email,
                                        _id: user._id
                                    }
                                    return Response.success(res, data, `Password reset link to set password has been sent to this email id ${user.email}`)
                                }
                            })
                    }
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        resetPassword: async(req, res) => {
            try {
                User.findOne({
                        _id: req.body._id,
                        resetToken: { $ne: null }
                    },
                    (err, user) => {
                        if (err) return Response.errorInternal(err, res)

                        let newPassword = req.body.password;
                        let newSaltAndPass = User(user).getSaltAndPassword(newPassword);
                        user.salt = newSaltAndPass.salt;
                        user.password = newSaltAndPass.password;
                        User.findByIdAndUpdate(
                            req.body._id, {
                                $set: {
                                    salt: newSaltAndPass.salt,
                                    password: newSaltAndPass.password,
                                    resetToken: null
                                }
                            },
                            function(err, userUpdated) {
                                if (err) return Response.errorInternal(err, res)
                                if (userUpdated) return Response.success(res, "Password was successfully reset. Please login to continue.")
                            }
                        );
                    }
                );
            } catch (e) {
                return Response.errorInternal(err, res)
            }
        },

        /**
         * Verify Token
         */
        verifyResetPasswordToken: async(req, res) => {
            try {
                //This is a middleware to compute validity of token
                let token = req.body.token;
                if (token) {
                    jwt.verify(token, process.env.SUPER_SECRET, (err, decoded) => {
                        if (err) return Response.error(res, 400, err);
                        if (decoded) {
                            console.log(decoded, "decoded")
                            User.findOneAndUpdate({
                                    _id: decoded._id,
                                    resetToken: decoded.forgetPasswordToken
                                }, {
                                    $set: { resetTokenVerfiedTime: Date.now() }
                                }, {
                                    new: true
                                },
                                (err, user) => {
                                    if (err) {
                                        return Response.error(res, 400, err);
                                    } else {
                                        if (user) {
                                            let newPassword = req.body.password;
                                            let newSaltAndPass = User(user).getSaltAndPassword(newPassword);
                                            User.findByIdAndUpdate(user._id, {
                                                    $set: {
                                                        salt: newSaltAndPass.salt,
                                                        password: newSaltAndPass.password,
                                                        // password : newPassword,
                                                        resetToken: null
                                                    }
                                                },
                                                function(err, userUpdated) {
                                                    if (err) {
                                                        console.log(err)
                                                        return Response.errorInternal(err, res)
                                                    }
                                                    if (userUpdated) {
                                                        console.log(userUpdated)
                                                        return Response.success(res, "Your password has been updated successfully. Please login to continue.")
                                                    }
                                                }
                                            );
                                        } else {
                                            return Response.badValues(res, "Something went wrong. Please try again.")
                                        }
                                    }
                                })
                        }
                    });
                } else {
                    return Response.forbiddenError(res, "Something went wrong. Please try again.")
                }

            } catch (e) {
                console.log(e)
                return Response.errorInternal(e, res)
            }
        },

        resendVerificationToken: async(req, res) => {
            try {
                console.log(req.body)
                const schema = Joi.object().keys({
                    email: Joi.string().trim().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjUserDetails = await User.findOne({
                    email: req.body.email
                }).select('_id firstName lastName email').lean();

                //Verification Token
                let expiry = '6 days'; //Expires in 1 Days
                let token = jwt.sign({
                    _id: lObjUserDetails._id
                }, process.env.SUPER_SECRET, {
                    expiresIn: expiry
                });

                //Send Email for verification purpose
                let mailData = {
                    "firstName": lObjUserDetails.firstName,
                    "lastName": lObjUserDetails.lastName,
                    "email": lObjUserDetails.email,
                    "verifyToken": token,
                    "mailType": "Verification Email",
                    // "link": `${process.env.BASE_URL}v1/auth/verifyEmailToken?token=${token}`,
                    "link": `${process.env.BASE_URL}login?verifyEmailToken=${token}`,
                }
                mailer.authenticationEmail(mailData)

                User.findOneAndUpdate({
                        _id: lObjUserDetails._id,
                    }, {
                        $set: { verifyToken: token }
                    },
                    (err, user) => {
                        if (err) {
                            return Response.error(res, 400, err);
                        } else {
                            let data = {
                                "email": user.email,
                                _id: user._id
                            }
                            return Response.success(res, data, `Verification email sent successfully to this mail Id ${user.email}`)
                        }
                    })

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        login: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    userName: Joi.string().trim().label('UserName / Email'),
                    password: Joi.string().trim()
                }).required().options({ abortEarly: false })

                Joi.validate(req.body, schema, { abortEarly: false })
                    .then(validatedChanges => {
                        User.findOne({
                                $or: [
                                    { email: req.body.userName },
                                    { userName: req.body.userName }
                                ]
                            },
                            async(err, user) => {
                                if (err) Response.error(res, 400, err);
                                if (user === null) return Response.error(res, 400, "The username or password entered is invalid");
                                if (!user.isVerified) return Response.error(res, 400, "Your account has not been verified. Please check inbox/spam folder for the verification email");

                                //Verify password
                                let lStrVerifyPassword = user.verifyPassword(req.body.password);
                                if (!lStrVerifyPassword) return Response.badValues(res, "Invalid Password");

                                //Generate Token
                                user.lastLoggedIn = Date.now();
                                user = await user.save();

                                await new loginHistory({
                                    userId: user._id,
                                    loginTime: Date.now()
                                }).save();

                                const { _id, email, userName, lastLoggedIn, channelName, isGoogleUser, isPasswordUpdate } = user.toObject(),
                                    tokenData = { _id, email, userName, lastLoggedIn, channelName };

                                var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                                    expiresIn: 60 * 60 * 24
                                });

                                user = sanitize(user.toObject()) //Remove Sensitive Data
                                    // console.log(user)
                                let lObjResponse = {
                                    token: token,
                                    data: user
                                }

                                return Response.success(res, lObjResponse, 'Logged in successfully')
                            })
                    })
                    .catch(validationError => {
                        const errorMessage = validationError.details.map(d => d.message);
                        return Response.badValuesData(res, errorMessage)
                    });
            } catch (e) {
                return Response.errorInternal(err, res)
            }
        },
        /**
         * Verify Token
         */
        verifyEmailToken: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    token: Joi.string().required(),
                    signUpToken: Joi.string()
                }).required()

                let { error, value } = Joi.validate(req.query, schema);
                if (error) return Response.badValuesData(res, error);

                //This is a middleware to compute validity of token
                let token = req.query.token;
                let signUpToken = req.query.signUpToken;
                console.log(signUpToken, 'signUpToken')

                if (token) {
                    jwt.verify(token, process.env.SUPER_SECRET, (err, decoded) => {
                        if (err) return Response.error(res, 400, err);
                        if (decoded) {
                            console.log(decoded)
                            User.findOneAndUpdate({
                                    _id: decoded._id,
                                    verifyToken: req.query.token
                                }, {
                                    $set: { isVerified: true, verifyToken: null, verfiedTime: Date.now() }
                                }, {
                                    new: true
                                },
                                async(err, user) => {
                                    if (err) {
                                        return Response.error(res, 400, err);
                                    } else {
                                        if (user !== null) {
                                            console.log(user)
                                                // user = sanitize(user)
                                            user.lastLoggedIn = Date.now();
                                            let userUpdate = await User.update({ _id: user._id }, { $set: { lastLoggedIn: Date.now() } })
                                            if (signUpToken) {

                                                let tokenData = { _id: user._id, email: user.email, userName: user.userName, lastLoggedIn: user.lastLoggedIn };
                                                console.log(tokenData)
                                                var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                                                    expiresIn: 60 * 60 * 24
                                                });

                                                user = sanitize(user.toObject()) //Remove Sensitive Data
                                                let lObjResponse = {
                                                    token: token,
                                                    data: user
                                                }
                                                return Response.success(res, lObjResponse, 'Token Verified and Logged in successfully')
                                            } else {
                                                let lObjResponse = {
                                                    data: user
                                                }
                                                return Response.success(res, lObjResponse, 'Token Verified successfully')
                                            }


                                        } else {
                                            return Response.error(res, 400, 'Something went wrong. Please try again.')
                                        }
                                    }
                                })
                        }
                    });
                } else {
                    // if there is no token or platform headers
                    // return an HTTP response of 403 (access forbidden) and an error message
                    return Response.forbiddenError(res, "Something went wrong. Please try again.")
                }

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        /**
         * Gogole Login
         */
        socialSignInCallback: async(req, res) => {
            try {

                if (req.query.error_code)
                    return Response.notAuthorized(res, req.query.error_message.replace(/[+]/g, " "));
                const lGoogleBackendVerification = await authenticateService.verify(req.body.tokenId, req.body.googleId)

                let user = req.body;
                User.findOne({
                        $or: [{
                                $or: [
                                    { email: user.email },
                                    { userName: user.userName }
                                ]
                            },
                            {
                                "googleId": user.googleId
                            }
                        ]
                    },
                    async(err, user) => {
                        if (err) Response.error(res, 400, err);
                        if (user) {
                            user.lastLoggedIn = Date.now();
                            user = await user.save();
                            const { _id, email, userName, lastLoggedIn } = user.toObject(),
                                tokenData = { _id, email, userName, lastLoggedIn };

                            //Generate Token
                            let token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                                expiresIn: 60 * 60 * 24
                            });

                            let lObjResponse = {
                                token: token,
                                data: user,
                                type: 'old'
                            };
                            return Response.success(res, lObjResponse, 'Logged in successfully');
                        } else {
                            let lObjResponse = {
                                type: 'new'
                            };
                            return Response.success(res, lObjResponse, 'New user Signup!!');
                        }

                    });

            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        /**
         * Adding google user details to database 
         */
        addGoogleUserDetails: async(req, res) => {
            try {
                let data = req.body;
                let profilePic = data.profilePicture || "";

                let user = new User({
                    googleId: data.googleId,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    email: data.email.toLowerCase().trim(),
                    profilePicture: profilePic,
                    active: true,
                    isVerified: true
                });
                user.lastLoggedIn = Date.now();
                user = await user.save();
                const { _id, email, userName, lastLoggedIn } = user.toObject(),
                    tokenData = { _id, email, userName, lastLoggedIn };

                let token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                    expiresIn: 60 * 60 * 24
                });
                let lObjResponse = {
                    token: token,
                    _id: user._id
                };
                return Response.success(res, lObjResponse, 'Logged in successfully');


            } catch (error) {
                return Response.errorInternal(error, res);
            }

        }
    }
    return Object.freeze(methods)
}

module.exports = componentOneCtrl()