require('dotenv').config();
let Response = require('../../utils/response');
let Subscription = require('../Subscribers/subscribers.modal');
let Plan = require('./plans.model');
let Discount = require('./discountUser.model');
let UserPlan = require('./planUser.model');
let User = require('../user/user.model');
let UsageReport = require('../adminReport/usage-report.model');
let BusinessUser = require('./businessUser.model');
let Projects = require('../project/project.model');
let Team = require('../team/team.model');
let TeamPayments = require('../teamPayment/teamPayments.model');
let TeamMember = require('../teamMembers/teamMembers.model');
let moment = require('moment');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const _ = require('lodash');
const Joi = require('joi');
const mailer = require('../../utils/mailService');
const jwt = require("jsonwebtoken");

function businessPortalController() {
    const Methods = {
        waitListUserDetails: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit) || 8;
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }

                // let lObjUserDetail = await Subscription.find({}).skip(skipRec).limit(pageLimit).lean().sort({ createdAt: -1 });

                let lObjUserDetail = await Subscription.find({}).sort({ createdAt: -1 });

                // let lObjIndusty = {
                //     items: lObjUserDetail,
                //     total: Math.round(lObjUserDetail.length / (limit ? limit : gIntDataPerPage)),
                //     totalUsers: lObjUserDetail.length,
                //     per_page: limit ? limit : gIntDataPerPage,
                //     currentPage: page
                // }

                return Response.success(res, lObjUserDetail, "User Approved")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        approveUser: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    email: Joi.array().items(Joi.string()).required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let emails = req.body.email;
                let lObjUserDetail = []
                for (let x of emails) {
                    await Subscription.findOneAndUpdate({ email: x }, {
                        $set: {
                            'approvedStatus': 1
                        }
                    }, { new: true }, async(err, doc) => {
                        if (!err) {
                            // let mailData = {
                            //     email: x
                            // };

                            // if (doc.emailStatus == 0) {
                            //     mailer.approveMail(mailData);
                            // }

                            let userData = await User.findOne({ email: x }).lean();

                            let expiry = '1 days'; //Expires in 1 day

                            let tokenData = {
                                _id: userData._id,
                                userName: userData.userName,
                                email: userData.email
                            }

                            var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                                expiresIn: expiry
                            });

                            //Send Email for verification purpose
                            let mailData = {
                                "firstName": userData.firstName,
                                "lastName": userData.lastName,
                                "email": userData.email.toLowerCase(),
                                "verifyToken": token,
                                //"link": `${process.env.BASE_URL}v1/auth/verifyEmailToken?token=${token}`,
                                "link": `${process.env.BASE_URL}login?verifyEmailToken=${token}`,
                                "mailType": "Your registration is successfull"
                            }
                            mailer.authenticationEmail(mailData)

                            await User.findOneAndUpdate({
                                _id: userData._id
                            }, {
                                $set: {
                                    verifyToken: token,
                                }
                            });

                            await Subscription.findOneAndUpdate({ email: x }, {
                                $set: {
                                    'emailStatus': 1
                                }
                            }, { new: true }, (err, doc) => {
                                if (!err) {
                                    lObjUserDetail.push(doc);
                                    console.log(lObjUserDetail, "QWERTUIOP")
                                    if (lObjUserDetail.length === emails.length) {
                                        return Response.success(res, lObjUserDetail, "Waitlist User Details")
                                    }
                                }
                            });
                        }

                    });
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        /**
         * Plan creation api 23/4/2020         * 
         */

        createPlan: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    planName: Joi.string().trim().required(),
                    basePrice: Joi.string().trim().required(),
                    threshold: Joi.string().trim(),
                    maxThreshold: Joi.string().trim()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let obj = {
                    planName: req.body.planName,
                    basePrice: req.body.basePrice,
                    threshold: req.body.threshold,
                    maxThreshold: req.body.maxThreshold,
                }

                let lObjPlanDetail = await Plan.create(obj);

                return Response.success(res, lObjPlanDetail, "Waitlist User Details")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getAllPlan: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit) || 8;
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }

                let lObjPlanDetail = await Plan.find({ status: 1 }).skip(skipRec).limit(pageLimit).lean().sort({ createdAt: -1 });

                let lObjIndusty = {
                    items: lObjPlanDetail,
                    total: Math.round(lObjPlanDetail.length / (limit ? limit : gIntDataPerPage)),
                    totalPlans: lObjPlanDetail.length,
                    per_page: limit ? limit : gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, lObjIndusty, "Waitlist User Details")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        updatePlan: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    planId: Joi.string().trim().required(),
                    planName: Joi.string().trim().required(),
                    basePrice: Joi.string().trim().required(),
                    threshold: Joi.string().trim(),
                    maxThreshold: Joi.string().trim()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let isPlanExists = await Plan.exists({
                    _id: ObjectId(req.body.planId),
                    status: 1
                });

                if (!isPlanExists) {
                    return Response.badValuesData(res, 'Plan does not exists');
                } else {
                    let lObjPlanDetail;
                    await Plan.findOneAndUpdate({ _id: ObjectId(req.body.planId), status: 1 }, {
                        $set: {
                            "planName": req.body.planName,
                            "basePrice": req.body.basePrice,
                            "threshold": req.body.threshold,
                            "maxThreshold": req.body.maxThreshold,
                        }
                    }, { new: true }, (err, doc) => {
                        if (!err) {
                            lObjPlanDetail = doc;
                        }
                        return Response.success(res, lObjPlanDetail, "Plan Detail Updated")
                    });
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        deletePlan: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    planId: Joi.string().trim().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.params, schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let isPlanExists = await Plan.exists({
                    _id: ObjectId(req.params.planId),
                    status: 1
                });

                if (!isPlanExists) {
                    return Response.badValuesData(res, 'Plan does not exists');
                } else {
                    let lObjPlanDetail;
                    await Plan.findOneAndUpdate({ _id: ObjectId(req.params.planId), status: 1 }, {
                        $set: {
                            status: 0
                        }
                    }, { new: true }, (err, doc) => {
                        if (!err) {
                            lObjPlanDetail = doc;
                        }
                        return Response.success(res, lObjPlanDetail, "Plan deleted successfully")
                    });

                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        /**
         * Discount
         */

        discountApi: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    userId: Joi.string().trim().required(),
                    discount: Joi.number().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let isUserDiscountExsists = await Discount.exists({
                    userId: ObjectId(req.body.userId),
                    status: 1
                });

                if (!isUserDiscountExsists) {

                    let obj = {
                        userId: ObjectId(req.body.userId),
                        discount: req.body.discount
                    }

                    let lObjDiscountDetail = await Discount.create(obj);

                    let plan = await Plan.find({
                        status: 1
                    });

                    for (let x of plan) {
                        await UserPlan.create({
                            userId: ObjectId(req.body.userId),
                            planId: ObjectId(x._id)
                        })
                    }

                    return Response.success(res, lObjDiscountDetail, "Discount Details")

                } else {

                    let lObjDiscountDetail;
                    await Discount.findOneAndUpdate({ userId: ObjectId(req.body.userId), status: 1 }, {
                        $set: {
                            "discount": req.body.discount,
                        }
                    }, { new: true }, (err, doc) => {
                        if (!err) {
                            lObjDiscountDetail = doc;
                        }
                        return Response.success(res, lObjDiscountDetail, "Discount Detail Updated")
                    });
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        /**
         * Plan User
         */

        planUserApi: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    userId: Joi.string().trim().required(),
                    planId: Joi.string().trim().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let isUserPlanExsists = await UserPlan.exists({
                    userId: ObjectId(req.body.userId),
                    status: 1
                });

                if (!isUserPlanExsists) {

                    let obj = {
                        userId: ObjectId(req.body.userId),
                        planId: ObjectId(req.body.planId)
                    }

                    let lObjUserPlanDetail = await UserPlan.create(obj);

                    return Response.success(res, lObjUserPlanDetail, "UserPlan Details")

                } else {

                    let lObjUserPlanDetail;
                    await UserPlan.findOneAndUpdate({ userId: ObjectId(req.body.userId), status: 1 }, {
                        $set: {
                            "planId": ObjectId(req.body.planId),
                        }
                    }, { new: true }, (err, doc) => {
                        if (!err) {
                            lObjUserPlanDetail = doc;
                        }
                        return Response.success(res, lObjUserPlanDetail, "UserPlan Detail Updated")
                    });
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },


        getPricingPlan: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit) || 8;
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }

                let lObjPricingPlan = await User.aggregate([{
                        $match: {
                            "isVerified": true
                        }
                    },
                    {
                        $group: {
                            "_id": "$_id",
                            "userName": { $first: "$userName" },
                            "firstName": { $first: "$firstName" },
                            "lastName": { $first: "$lastName" },
                            "email": { $first: "$email" },
                            "userId": { $first: "$_id" },
                            "profilePicture": { $first: "$profilePicture" },
                            "createdAt": { $first: "$createdAt" }
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $lookup: { from: "discount_users", localField: "_id", foreignField: "userId", as: "Discount" } },
                    { $unwind: { path: '$Discount', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "plan_users", localField: "_id", foreignField: "userId", as: "UserPlan" } },
                    { $unwind: { path: '$UserPlan', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "plans_businesses", localField: "UserPlan.planId", foreignField: "_id", as: "PlanDetail" } },
                    { $unwind: { path: '$PlanDetail', 'preserveNullAndEmptyArrays': true } },
                    {
                        $project: {
                            "_id": "$_id",
                            "userName": "$userName",
                            "firstName": "$firstName",
                            "lastName": "$lastName",
                            "email": "$email",
                            "userId": "$_id",
                            "profilePicture": { $ifNull: ["", { $concat: [`${process.env.AWS_URL}profilePicture/`, "$profilePicture"] }] },
                            "createdAt": "$createdAt",
                            "discountDetail": {
                                "_id": "$Discount._id",
                                "discountPercentage": "$Discount.discount"
                            },
                            "planDetail": {
                                "_id": "$PlanDetail._id",
                                "basePrice": "$PlanDetail.basePrice",
                                "planName": "$PlanDetail.planName",
                                "threshold": "$PlanDetail.threshold",
                                "maxThreshold": "$PlanDetail.maxThreshold"
                            }
                        }
                    },
                    { $skip: skipRec },
                    { $limit: pageLimit },
                ]);

                for (let x of lObjPricingPlan) {
                    let members = [];
                    let projectCount = await Projects.find({ userId: ObjectId(x._id), projectStatus: 1 });
                    x.projectCount = projectCount.length;
                    let teamCount = await Team.find({ createdUser: ObjectId(x._id), status: 1 });
                    x.teamCount = teamCount.length;
                    if (teamCount.length > 0) {
                        for (let y of teamCount) {
                            let pay = await TeamPayments.findOne({ teamId: ObjectId(y._id), status: 1, paymentStatus: 2 }).sort({ createdAt: -1 });
                            if (pay !== null) {
                                x.paidPlan = 1;
                                let data = await TeamMember.find({ teamId: ObjectId(pay.teamId), status: 1 }).count();
                                members.push(data);
                                break;
                            } else {
                                members = [];
                                x.paidPlan = 0;
                                break;
                            }
                        }
                        members = await Promise.all(members);
                        if (members.length > 0) {
                            const reducer = (accumulator, currentValue) => accumulator + currentValue;
                            x.teamMemberCount = members.reduce(reducer);
                        } else {
                            x.teamMemberCount = 0
                        }

                    } else {
                        x.paidPlan = 0;
                        x.teamMemberCount = 0
                    }


                    if (Object.keys(x.discountDetail).length > 0 && Object.keys(x.planDetail).length > 0) {
                        x.pricePerLicense = x.planDetail.basePrice - ((x.discountDetail.discountPercentage / 100) * x.planDetail.basePrice);
                    } else {
                        x.pricePerLicense = parseInt(process.env.TEAM_MEMBER_PRICE);
                    }


                }

                let num = await User.find({ "isVerified": true }).count()

                let lObjIndusty = {
                    items: lObjPricingPlan,
                    total: Math.round(num / (limit ? limit : gIntDataPerPage)),
                    totalPlans: num,
                    per_page: limit ? limit : gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, lObjIndusty, "Pricing User Details")


            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        listOfUserDetails: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit) || 8;
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }

                let lObjUserDetail = await User.find({ "isVerified": true }).skip(skipRec).limit(pageLimit).lean().sort({ createdAt: -1 }).select('userName email firstName lastName profilePicture');

                let num = await User.find({ "isVerified": true }).sort({ createdAt: -1 }).count();

                let lObjIndusty = {
                    items: lObjUserDetail,
                    total: Math.round(num / (limit ? limit : gIntDataPerPage)),
                    totalUsers: num,
                    per_page: limit ? limit : gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, lObjIndusty, "User Approved")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        businessUserSignUp: async(req, res) => {
            try {
                //Joi Input validation
                const schema = Joi.object().keys({
                    userName: Joi.string().trim().min(5).max(30).required().label('UserName'),
                    password: Joi.string().trim().min(8).max(30).label('Password'),
                    email: Joi.string().trim().regex(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/).label('email').required(),
                    gender: Joi.string().valid(["male", "female", "undisclosed"]),
                    firstName: Joi.string().trim(),
                    lastName: Joi.string().trim(),
                    profilePicture: Joi.string().trim().allow(''),
                    active: Joi.boolean(),
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg[0]);
                }

                if (!error) {

                    let userData = new BusinessUser(value);

                    //Generate hashed password
                    if (req.body.password) {
                        console.log(req.body.password)
                        let newPassword = req.body.password;
                        let newSaltAndPass = BusinessUser(userData).getSaltAndPassword(newPassword);
                        userData.salt = newSaltAndPass.salt;
                        userData.password = newSaltAndPass.password;
                        userData.isVerified = false;
                    }
                    if (req.body.googleId || req.body.verifyEmail == true) {
                        userData.isVerified = true;
                    }

                    let lObjRes = await userData.save(userData);

                    return Response.success(res, lObjRes, 'Sign Up successfully')

                }

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        businessLogin: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    userName: Joi.string().trim().label('UserName / Email'),
                    password: Joi.string().trim()
                }).required().options({ abortEarly: false })

                Joi.validate(req.body, schema, { abortEarly: false })
                    .then(validatedChanges => {
                        BusinessUser.findOne({
                                $or: [
                                    { email: req.body.userName },
                                    { userName: req.body.userName }
                                ]
                            },
                            async(err, user) => {
                                // console.log(user, "QWERTYUIOP")
                                if (err) Response.error(res, 400, err);
                                if (user === null) return Response.error(res, 400, "The username or password entered is invalid");

                                //Verify password
                                let lStrVerifyPassword = user.verifyPassword(req.body.password, true);
                                if (!lStrVerifyPassword) return Response.badValues(res, "Invalid Password");

                                //Generate Token
                                user.lastLoggedIn = Date.now();
                                user = await user.save();

                                const { _id, email, userName, lastLoggedIn } = user.toObject(),
                                    tokenData = { _id, email, userName, lastLoggedIn };

                                var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                                    expiresIn: 60 * 60 * 24
                                });

                                // user = sanitize(user.toObject()) //Remove Sensitive Data
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

        businessLogout: async(req, res) => {
            try {
                await BusinessUser.findByIdAndUpdate({ _id: ObjectId(req.user._id) }, {
                    $set: {
                        lastLoggedIn: Date.now()
                    }
                }).lean();
                return Response.success(res, 'Logged out successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        usageReport: async(req, res) => {
            try {
                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit) || 8;
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }

                let queryParam = req.query.email;

                if (!!queryParam) {
                    let lObjUserDetail = await UsageReport.find({ email: { $regex: queryParam, "$options": "i" } }).skip(skipRec).limit(pageLimit).lean().sort({ createdAt: -1 });

                    let num = await UsageReport.find({ email: { $regex: queryParam, "$options": "i" } }).sort({ createdAt: -1 }).count();

                    let lObjIndusty = {
                        items: lObjUserDetail,
                        total: Math.round(num / (limit ? limit : gIntDataPerPage)),
                        totalUsers: num,
                        per_page: limit ? limit : gIntDataPerPage,
                        currentPage: page
                    };
                    return Response.success(res, lObjIndusty, "Usage Report")

                } else {

                    let lObjUserDetail = await UsageReport.find({}).skip(skipRec).limit(pageLimit).lean().sort({ createdAt: -1 });

                    let num = await UsageReport.find({}).sort({ createdAt: -1 }).count();

                    let lObjIndusty = {
                        items: lObjUserDetail,
                        total: Math.round(num / (limit ? limit : gIntDataPerPage)),
                        totalUsers: num,
                        per_page: limit ? limit : gIntDataPerPage,
                        currentPage: page
                    }
                    return Response.success(res, lObjIndusty, "Usage Report")

                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },


    }
    return Object.freeze(Methods)
}

module.exports = businessPortalController();