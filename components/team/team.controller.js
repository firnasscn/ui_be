let Teams = require('./team.model');
let teamMembers = require('../teamMembers/teamMembers.model');
let Joi = require('joi')
let Plans = require('../paymentPlan/paymentPlan.model')
let Response = require('../../utils/response')
let _ = require('lodash');
const fs = require('fs');
const path = require('path');
const mailer = require('../../utils/mailService');
//let payStructure = require('../paystructure/paystructure.model')
let Projects = require('../project/project.model')
const jsreport = require('jsreport');
let jsReportInitialized = false;
let Pusher = require('../../utils/pusher')
let activityFeed = require('../activityfeed/activityfeed.model')
let moment = require('moment')
let mongoose = require('mongoose')
const stripe = require("stripe")(process.env.STRIPE_KEY);
const Notification = require('../notification/notification.model');
const User = require('../user/user.model')
let TeamUsers = require('../teamUsers/teamUsers.model')
const TeamPayment = require('../teamPayment/teamPayments.model')
const TeamUserPayment = require('../teamUserPayment/teamUserPayments.model');
const Discount = require('../businessPortal/discountUser.model');
const Focusgroup = require('../focusGroup/focusGroup.model');
const ProjectTeamMember = require('../project/projectTeamMember.model');

// async function paymentStructure(req, res, teamId) {
//     let membersCount = Number(req.body.invitedUsers.length);
//     let paymentPlan = await Plans.find({});
//     let currentDate = moment();
//     let expireDate = moment(currentDate).add(1, 'M')
//     let obj = {
//         teamId: teamId,
//         createdUser: req.user._id,
//         paymentDate: currentDate,
//         expireDate: expireDate,
//         membersCount: membersCount
//     }

//     for (let plan of paymentPlan) {
//         let count = plan.membersCount;
//         if (count == 'unlimited' && membersCount >= 11) {
//             obj['planId'] = plan._id;
//             obj['amount'] = membersCount * Number(plan.amount)
//         } else if (count == 3 && membersCount <= 3) {
//             obj['planId'] = plan._id;
//             obj['amount'] = Number(plan.amount);
//         } else if (count == 10 && membersCount <= 10) {
//             obj['planId'] = plan._id;
//             obj['amount'] = Number(plan.amount)
//         }
//     }
//     console.log(obj, 'payment structure');
//     await payStructure.create(obj)
// }

async function createPaymentIntent(req, res, teamId) {
    //set the price and currency in stripe
    let paymentIntent = await stripe.paymentIntents.create({
        amount: amountPay * 100, //Amount should pay
        currency: 'inr',
        payment_method_types: ['card'],
        customer: customer.stripe_id
    });
}

function teamController() {
    const methods = {
        createTeam: async(req, res) => {
            try {
                let Schema = Joi.object().keys({
                    teamName: Joi.string().required().trim(),
                    description: Joi.string().allow(''),
                    link: Joi.string().allow(''),
                    invitedUsers: Joi.array().items(Joi.string().email()).required(),
                    teamId: Joi.string().allow('')
                })

                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let checkTeam = await Teams.find({ teamName: req.body.teamName, createdUser: req.user._id, status: 1 });
                if (checkTeam.length > 0) {
                    return Response.badValuesData(res, 'Already you have the same team name')
                }

                let obj = {
                    teamName: req.body.teamName,
                    description: req.body.description,
                    link: req.body.link,
                    createdUser: req.user._id
                }

                let createTeam = await Teams.create(obj);

                let invitedUsers = req.body.invitedUsers;
                if (invitedUsers.length > 0) {

                    invitedUsers.forEach(async(element) => {
                        if (element === req.user.email) {
                            await Teams.update({ _id: createTeam._id }, { status: 0 });
                            await teamMembers.update({ teamId: createTeam._id }, { status: 0 });
                            return Response.badValuesData(res, "You cannot use the same user email")
                        }
                    })
                }
                let emailTeamMatesArr = [];
                for (let user of invitedUsers) {


                    if (user == req.user.email) {
                        continue;
                    }
                    let checkTeamUser = await TeamUsers.findOne({ createdUser: req.user._id, email: user, status: 1 })

                    if (!checkTeamUser) {
                        console.log("team user not exist");

                        checkTeamUser = await TeamUsers.create({
                            createdUser: req.user._id,
                            email: user
                        })

                    }
                    // else {
                    //     await Teams.update({ _id: createTeam._id }, { status: 0 });
                    //     return Response.badValuesData(res, "You cannot same user in more than one Team Member")
                    // }

                    // console.log("checkTeamUser", checkTeamUser);

                    let checkTeamMember = await teamMembers.findOne({ teamId: createTeam._id, teamUserId: checkTeamUser._id, createdUser: req.user._id, email: user, status: 1 })

                    // console.log("checkTeamMember", checkTeamMember);

                    if (!checkTeamMember) {
                        console.log("team member not exist");

                        await teamMembers.create({
                            teamId: createTeam._id,
                            teamUserId: checkTeamUser._id,
                            email: user,
                            createdUser: req.user._id
                        })
                        emailTeamMatesArr.push(user);

                    }
                    // else {

                    //     await Teams.update({ _id: createTeam._id }, { status: 0 });
                    //     await teamMembers.update({ teamId: createTeam._id }, { status: 0 });
                    //     return Response.badValuesData(res, "You cannot same user in more than one Team Member")
                    // }

                    // let check = await teamMembers.find({ userId: req.user._id, email: user, status: 1 })
                    // if (check.length > 0 || user == req.user.email) {
                    //     return Response.badValues(res, `${user} has already invited`)
                    // }
                    // let deleteUser = await teamMembers.find({ userId: req.user._id, email: user, status: 0 })
                    // if (deleteUser.length > 0) {
                    //     await teamMembers.update({ _id: deleteUser[0]._id }, { $set: { status: 1 } })
                    // }
                    // if (req.user.email != user && deleteUser.length == 0) {
                    //     await teamMembers.create({ teamId: createTeam._id, email: user, userId: req.user._id })
                    // }
                }

                //await paymentStructure(req, res, createTeam._id)


                let team = await Teams.aggregate([
                    { $match: { _id: createTeam._id, status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'teamMembers' } },
                    { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teamMembers.status': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            status: { $first: '$status' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    userName: '$users.userName',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$teamMembers._id',
                                    email: '$teamMembers.email'
                                }
                            }
                        }
                    }
                ]);

                let data;
                if (team.length > 0) {
                    data = team[0]
                    let mailData = {
                        userName: req.user.userName,
                        email: emailTeamMatesArr,
                        teamName: team[0].teamName,
                        link: `${process.env.BASE_URL}`
                    }
                    mailer.invitationTeamMembers(mailData)
                    return Response.success(res, data, 'Team created successfully')
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        deleteTeam: async(req, res) => {
            try {
                let teamId = mongoose.Types.ObjectId(req.params.teamId);;

                let checkUser = await Teams.findOne({ _id: teamId, createdUser: req.user._id, status: 1 });
                if (!checkUser) {
                    return Response.badValuesData(res, 'You are not have permission to delete the team')
                }
                /** Soft delete for payment start 22/021/2020 */

                let listTeamMembers = await teamMembers.aggregate([
                    { $match: { teamId: teamId, status: 1 } },
                    {
                        $lookup: {
                            from: 'teamusers',
                            localField: 'teamUserId',
                            foreignField: '_id',
                            as: 'teamUsers'
                        }
                    },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $lookup: {
                            from: 'teamuserpayments',
                            localField: 'teamUsers.lastPaymentId',
                            foreignField: '_id',
                            as: 'teamUserPayments'
                        }
                    },
                    { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } }

                ])

                listTeamMembers.forEach(async(element) => {
                    let paymentId = mongoose.Types.ObjectId(element.teamUserPayments._id);
                    let teamUserPayment = await TeamUsers.updateMany({ lastPaymentId: paymentId }, { status: 0 })
                })

                /** Soft delete for payment end 22/01/2020 */

                await Teams.update({ _id: teamId }, { status: 0 });
                await teamMembers.updateMany({ teamId: teamId }, { status: 0 });

                return Response.success(res, {}, 'Team deleted successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        updateTeam: async(req, res) => {
            try {
                let Schema = Joi.object().keys({
                    teamId: Joi.string().required(),
                    teamName: Joi.string(),
                    description: Joi.string().allow(''),
                    link: Joi.string().allow('').allow(null),
                    invitedUsers: Joi.array()
                })

                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let checkUser = await Teams.findOne({ _id: req.body.teamId, createdUser: req.user._id, status: 1 });
                if (!checkUser) {
                    return Response.badValuesData(res, 'You does not have permission to update team details')
                }

                await Teams.update({ _id: req.body.teamId }, {
                    $set: {
                        teamName: req.body.teamName,
                        description: req.body.description,
                        link: req.body.link
                    }
                })
                let emailTeamMatesArr = [];
                let teamUserIdsArr = [];
                // let redirectToPayment = false;
                for (let user of req.body.invitedUsers) {

                    let checkTeamUser = await TeamUsers.findOne({ createdUser: req.user._id, email: user, status: 1 })
                    if (!checkTeamUser) {

                        checkTeamUser = await TeamUsers.create({
                            createdUser: req.user._id,
                            email: user
                        })
                        redirectToPayment = true;
                    }

                    if (checkTeamUser) {
                        teamUserIdsArr.push(checkTeamUser._id)
                    }

                    let checkTeamMember = await teamMembers.findOne({ teamId: req.body.teamId, teamUserId: checkTeamUser._id, createdUser: req.user._id, email: user, status: 1 })

                    if (!checkTeamMember) {

                        await teamMembers.create({
                            teamId: req.body.teamId,
                            teamUserId: checkTeamUser._id,
                            email: user,
                            createdUser: req.user._id
                        })
                        emailTeamMatesArr.push(user);
                    }
                }


                //toupdate or remove users
                let removeTeamMember = await teamMembers.update({
                    teamId: req.body.teamId,
                    teamUserId: { $nin: teamUserIdsArr },
                    createdUser: req.user._id,
                    status: 1
                }, {
                    $set: {
                        status: 2
                    }
                })

                // console.log("removeTeamMember", removeTeamMember)
                if (teamUserIdsArr.length > 0) {
                    let removedMembers = await teamMembers.find({
                        teamId: req.body.teamId,
                        teamUserId: { $nin: teamUserIdsArr },
                        createdUser: req.user._id,
                        status: 2
                    }).sort({ createdAt: -1 })

                    removedMembers = removedMembers.reduce((curr, next) => {
                        if (!curr.some(obj => obj.email == next.email && obj.createdAt > next.createdAt)) {
                            curr.push(next);
                        }
                        return curr;
                    }, []);

                    let projectss;
                    for (let x of removedMembers) {
                        projectss = await ProjectTeamMember.deleteOne({ "projectTeamMember.email": x.email });
                        // if (projectss.length > 0) {
                        //     for (let y of projectss) {
                        //         let team = y.teamMembers;
                        //         team = team.filter(function(obj) {
                        //             return obj !== x.email;
                        //         });
                        //         await Projects.findOneAndUpdate({ _id: y._id }, { teamMembers: team });

                        //         let fg = await Focusgroup.find({ projectId: y._id, groupstatus: 1 })
                        //         for (let z of fg) {
                        //             let projectTeam = z.projectTeamMembers;
                        //             projectTeam = projectTeam.filter(v => {
                        //                 return v.email !== x.email
                        //             })
                        //             await Focusgroup.findOneAndUpdate({ _id: z._id }, { projectTeamMembers: projectTeam });
                        //         }
                        //     }
                        // }
                    }

                }


                // added ObjectId
                let team = await Teams.aggregate([
                    { $match: { _id: mongoose.Types.ObjectId(req.body.teamId), status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'teamMembers' } },
                    { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teamMembers.status': 1 } },
                    { $sort: { 'teamMembers.createdAt': -1 } },
                    { $lookup: { from: 'teamusers', localField: 'teamMembers.teamUserId', foreignField: '_id', as: 'teamUsers' } },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $lookup: {
                            from: 'teamuserpayments',
                            localField: 'teamUsers.lastPaymentId',
                            foreignField: '_id',
                            as: 'teamUserPayments'
                        }
                    },
                    { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            status: { $first: '$status' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    userName: '$users.userName',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$teamMembers._id',
                                    email: '$teamMembers.email',
                                    endDate: '$teamUserPayments.endDate',
                                    paymentStatus: '$teamUserPayments.status'
                                }
                            },
                        }
                    }
                ]);

                if (emailTeamMatesArr.length > 0) {
                    let mailData = {
                        userName: req.user.userName,
                        email: emailTeamMatesArr,
                        teamName: team[0].teamName,
                        link: `${process.env.BASE_URL}`
                    }
                    mailer.invitationTeamMembers(mailData)
                }

                let currentDate = moment().utc().format('');
                // team[0].redirectToPayment = redirectToPayment;
                team[0].teamMembers.forEach(element => {
                    let subtract = moment(element.endDate).diff(currentDate, 'day');
                    if (element.hasOwnProperty('paymentStatus') && subtract >= 0) {
                        element;
                    } else {
                        element.paymentStatus = 0;
                    }
                })
                return Response.success(res, team, 'Team updated successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        addTeamMembers: async(req, res) => {
            try {
                let invitedUsers = req.body.addMembers;
                let teamId = req.body.teamId;

                for (let user of invitedUsers) {
                    let check = await teamMembers.find({ userId: req.user._id, email: user, status: 1 });
                    if (check.length > 0 || user == req.user.email) return Response.badValuesData(res, `${user} has already joined`);

                    let deleteUser = await teamMembers.find({ userId: req.user._id, email: user, status: 0 });
                    if (deleteUser.length > 0) {
                        await teamMembers.update({ _id: deleteUser._id }, { $set: { status: 1 } })
                    } else {
                        await teamMembers.create({ teamId: teamId, email: user, userId: req.user._id });
                    }
                }

                let team = await Teams.aggregate([
                    { $match: { _id: teamId, status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'teamMembers' } },
                    { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teamMembers.status': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            status: { $first: '$status' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    userName: '$users.userName',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$teamMembers._id',
                                    email: '$teamMembers.email'
                                }
                            }
                        }
                    }
                ]);

                return Response.success(res, team, 'User added successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        deleteTeamMember: async(req, res) => {
            try {
                let memberId = req.body.memberId;
                let teamId = req.body.teamId;

                let checkPermission = await Teams.findOne({ _id: teamId, createdUser: req.user._id, status: 1 });
                if (!checkPermission) {
                    return Response.badValuesData(res, 'You does not have permission to remove member')
                }
                let checkUser = await teamMembers.findOne({ _id: memberId, status: 1 });
                if (!checkUser) {
                    return Response.badValuesData(res, 'This user already removed from this team')
                }

                await teamMembers.update({ _id: memberId }, { $set: { status: 0 } });

                let myProjects = await Projects.find({ userId: req.user._id, projectStatus: 1 });

                for (let project of myProjects) {
                    let check = await Projects.findOne({ _id: project._id, teamMembers: memberId });
                    if (check) {
                        await Projects.update({ _id: project._id }, {
                            $pull: { teamMembers: checkUser.email }
                        })
                    }
                }

                let team = await Teams.aggregate([
                    { $match: { _id: teamId, status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'teamMembers' } },
                    { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teamMembers.status': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            status: { $first: '$status' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    userName: '$users.userName',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$teamMembers._id',
                                    email: '$teamMembers.email'
                                }
                            }
                        }
                    }
                ]);

                return Response.success(res, team, 'User removed successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        listTeam: async(req, res) => {
            try {
                let list = {}
                let currentDate = moment().utc().format('');
                list['myTeam'] = await Teams.aggregate([
                    { $match: { createdUser: req.user._id, status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'members' } },
                    { $unwind: { path: '$members', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'members.email', foreignField: 'email', as: 'userData' } },
                    { $unwind: { path: '$userData', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: {
                            'members.status': { $eq: 1 },
                        }
                    },
                    { $lookup: { from: 'teamusers', localField: 'members.teamUserId', foreignField: '_id', as: 'teamUsers' } },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $lookup: {
                            from: 'teamuserpayments',
                            localField: 'teamUsers.lastPaymentId',
                            foreignField: '_id',
                            as: 'teamUserPayments'
                        }
                    },
                    { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            status: { $first: '$status' },
                            endDate: { $first: '$teamUserPayments.endDate' },
                            teamUserId: { $first: '$teamUserPayments.teamUserId' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    userName: '$users.userName',
                                    email: '$users.email',
                                    profilePicture: '$users.profilePicture'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$members._id',
                                    email: '$members.email',
                                    firstName: '$userData.firstName',
                                    lastName: '$userData.lastName',
                                    userName: '$userData.userName',
                                    profilePicture: '$userData.profilePicture',
                                }
                            }
                        }
                    },
                    { $sort: { teamName: -1 } }
                ])

                list['joinedTeam'] = await teamMembers.aggregate([
                    { $match: { email: req.user.email, status: 1 } },
                    { $lookup: { from: 'teams', localField: 'teamId', foreignField: '_id', as: 'teams' } },
                    { $unwind: { path: '$teams', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'teams.createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'teammembers', localField: 'teams._id', foreignField: 'teamId', as: 'members' } },
                    { $unwind: { path: '$members', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'members.email', foreignField: 'email', as: 'userData' } },
                    { $unwind: { path: '$userData', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teams.status': 1 } },
                    {
                        $group: {
                            _id: '$teams._id',
                            teamName: { $first: '$teams.teamName' },
                            description: { $first: '$teams.description' },
                            link: { $first: '$link' },
                            status: { $first: '$teams.status' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    userName: '$users.userName',
                                    email: '$users.email',
                                    profilePicture: '$users.profilePicture'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$members._id',
                                    email: '$members.email',
                                    firstName: '$userData.firstName',
                                    lastName: '$userData.lastName',
                                    userName: '$userData.userName',
                                    profilePicture: '$userData.profilePicture'
                                }
                            }
                        }
                    },
                    { $sort: { teamName: -1 } }
                ])

                list.myTeam.forEach(elements => {

                    // team Exipry 
                    let subtract = moment(elements.endDate).diff(currentDate, 'day');
                    if (subtract >= 0) {
                        elements['teamExpiry'] = 0;
                    } else {
                        elements['teamExpiry'] = 1;
                    }


                    elements.teamMembers.forEach(element => {
                        if (subtract >= 0) {
                            element.paymentStatus = 1;
                        } else {
                            element.paymentStatus = 0;
                        }
                    });


                })


                return Response.success(res, list)
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        searchTeamuser: async(req, res) => {
            try {

                let queryParam = req.query.email;

                //console.log("queryParam", queryParam, req.user._id);

                let listTeamUsers;
                if (!!queryParam) {
                    console.log("if condition");

                    listTeamUsers = await TeamUsers.aggregate([
                        { $match: { createdUser: req.user._id, status: 1, email: { $regex: queryParam, "$options": "i" } } },
                        {
                            $lookup: {
                                from: 'teammembers',
                                localField: '_id',
                                foreignField: 'teamUserId',
                                as: 'teamMembers'
                            }
                        },
                        { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                        { $match: { 'teamMembers.status': 1 } },
                        { $lookup: { from: 'teams', localField: 'teamMembers.teamId', foreignField: '_id', as: 'teams' } },
                        { $match: { 'teams.status': 1 } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'email',
                                foreignField: 'email',
                                as: 'user'
                            }
                        },
                        { $unwind: { path: '$user', 'preserveNullAndEmptyArrays': true } },
                        // { $match: { 'user': { $ne: null } } },
                        {
                            $project: {
                                "email": 1,
                                "lastPaymentId": 1,
                                planExpiryDate: 1,
                                'teams.teamName': 1,
                                'teams.description': 1,
                                'teams.link': 1,
                                //user: 1,
                                'user.firstName': { $ifNull: ["$user.firstName", ""] },
                                'user.lastName': { $ifNull: ["$user.lastName", ""] },
                                'user.profilePicture': { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$user.profilePicture"] }, ""] },
                                'user._id': 1
                            }

                        },
                    ])
                } else {
                    console.log("else condition");
                    listTeamUsers = await TeamUsers.aggregate([
                        { $match: { createdUser: req.user._id, status: 1 } },
                        // { $limit: 10 },
                        {
                            $lookup: {
                                from: 'teammembers',
                                localField: '_id',
                                foreignField: 'teamUserId',
                                as: 'teamMembers'
                            }
                        },
                        { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                        { $match: { 'teamMembers.status': 1 } },
                        { $lookup: { from: 'teams', localField: 'teamMembers.teamId', foreignField: '_id', as: 'teams' } },
                        { $match: { 'teams.status': 1 } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'email',
                                foreignField: 'email',
                                as: 'user'
                            }
                        },
                        { $unwind: { path: '$user', 'preserveNullAndEmptyArrays': true } },
                        // { $match: { 'user': { $ne: null } } },
                        {
                            $project: {
                                email: 1,
                                lastPaymentId: 1,
                                planExpiryDate: 1,
                                'teams.teamName': 1,
                                'teams.description': 1,
                                'teams.link': 1,
                                //user: 1,
                                'user.firstName': { $ifNull: ["$user.firstName", ""] },
                                'user.lastName': { $ifNull: ["$user.lastName", ""] },
                                'user.profilePicture': { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$user.profilePicture"] }, ""] },
                                'user._id': 1
                            }

                        },
                    ])
                }
                let currentDate = moment().format('YYYY-MM-DD');
                // payment removal
                // listTeamUsers = listTeamUsers.filter(v => {
                //     let subtract = moment(v.planExpiryDate).diff(currentDate, 'day');
                //     return subtract >= 0;
                // })

                // for (let k of listTeamUsers) {
                //     if (k.user.profilePicture.length > 0) {
                //         k.user.profilePicture = process.env.AWS_URL + 'profilePicture/' + k.user.profilePicture;
                //     }
                // }


                return Response.success(res, listTeamUsers)
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        teamUsersList: async(req, res) => {
            try {
                let listTeamUsers = await TeamUsers.aggregate([
                    { $match: { createdUser: req.user._id, status: 1 } },
                    {
                        $lookup: {
                            from: 'teammembers',
                            localField: '_id',
                            foreignField: 'teamUserId',
                            as: 'teamMembers'
                        }
                    },
                    //  { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } }
                ])

                return Response.success(res, listTeamUsers)
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        teamMembersList: async(req, res) => {
            try {

                let objectId = mongoose.Types.ObjectId(req.params.teamId);
                // console.log("req.params.teamId", req.params.teamId);

                let listTeamMembers = await teamMembers.aggregate([
                    { $match: { teamId: objectId, status: 1 } },
                    {
                        $lookup: {
                            from: 'teamusers',
                            localField: 'teamUserId',
                            foreignField: '_id',
                            as: 'teamUsers'
                        }
                    },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } }
                ])

                //console.log("listTeamMembers", listTeamMembers);

                return Response.success(res, listTeamMembers)
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },


        readOneTeam: async(req, res) => {
            try {

                let objectId = mongoose.Types.ObjectId(req.params.teamId);
                // console.log("req.params.teamId", req.params.teamId);

                let listTeamMembers = await Teams.aggregate([
                    { $match: { _id: objectId, status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'teamMembers' } },
                    { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teamMembers.status': 1 } },
                    { $lookup: { from: 'teamusers', localField: 'teamMembers.teamUserId', foreignField: '_id', as: 'teamUsers' } },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $lookup: {
                            from: 'teamuserpayments',
                            localField: 'teamUsers.lastPaymentId',
                            foreignField: '_id',
                            as: 'teamUserPayments'
                        }
                    },
                    { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            status: { $first: '$status' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    userName: '$users.userName',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$teamMembers._id',
                                    email: '$teamMembers.email',
                                    teamPayments: '$teamUserPayments.status',
                                    endDate: '$teamUserPayments.endDate'
                                }
                            },
                        }
                    }
                ]);

                let currentDate = moment().format('YYYY-MM-DD');

                listTeamMembers = listTeamMembers[0];
                if (listTeamMembers.teamMembers.length > 0) {
                    listTeamMembers.teamMembers.forEach(element => {
                        if (element.endDate != undefined) {
                            let diffDays = moment(element.endDate).diff(currentDate, 'days')
                            if (diffDays >= 0) {
                                element.teamPayments = 1;
                            } else {
                                // element.teamPayments = 0; payment removal
                                element.teamPayments = 1;
                            }
                        } else {
                            // element.teamPayments = 0; payment removal
                            element.teamPayments = 1;
                        }

                    })
                }

                return Response.success(res, listTeamMembers)
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        paymentCheckout: async(req, res) => {

            try {

                let discountAmt = await Discount.findOne({ userId: req.user._id, status: 1 });
                let defaultPrice;
                if (discountAmt == null) {
                    defaultPrice = process.env.TEAM_MEMBER_PRICE;
                } else {
                    defaultPrice = (process.env.TEAM_MEMBER_PRICE - ((discountAmt.discount / 100) * process.env.TEAM_MEMBER_PRICE)) || process.env.TEAM_MEMBER_PRICE;
                };

                let objectId = mongoose.Types.ObjectId(req.params.teamId);

                let listTeamMembers = await teamMembers.aggregate([
                    { $match: { teamId: objectId, status: 1 } },
                    {
                        $lookup: {
                            from: 'teamusers',
                            localField: 'teamUserId',
                            foreignField: '_id',
                            as: 'teamUsers'
                        }
                    },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    { $match: { createdUser: req.user._id } },
                    {
                        $lookup: {
                            from: 'teamuserpayments',
                            localField: 'teamUsers.lastPaymentId',
                            foreignField: '_id',
                            as: 'teamUserPayments'
                        }
                    },
                    { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } }

                ]);


                let startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
                let endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
                let monthDays = moment(endOfMonth).diff(startOfMonth, 'days')
                let currentDate = moment().format('YYYY-MM-DD');

                let memberList = [];
                let data = {};
                let dateDiff;
                let totalPrice = parseFloat(0);
                for (let members of listTeamMembers) {

                    data = {};

                    let diffDays = moment(endOfMonth).diff(currentDate, 'days')
                    let pricePerDay = parseFloat((defaultPrice / monthDays));
                    let price = parseFloat((diffDays * pricePerDay))
                    price = price.toFixed(2);
                    price = parseFloat(price);

                    if (members.teamUserPayments) {
                        dateDiff = moment(members.teamUserPayments.endDate).diff(currentDate, 'days');

                        if (dateDiff >= 0) {
                            monthDays = moment(endOfMonth).diff(startOfMonth, 'days')
                            diffDays = moment(endOfMonth).diff(members.teamUserPayments.endDate, 'days')
                            pricePerDay = parseFloat((defaultPrice / monthDays));

                            price = parseFloat((diffDays * pricePerDay))
                            console.log("price", price);
                            price = price.toFixed(2);
                            price = parseFloat(price);
                        }
                    }

                    // let diffDays = moment(endOfMonth).diff(currentDate, 'days')
                    // let pricePerDay = parseFloat((process.env.TEAM_MEMBER_PRICE / monthDays));
                    // let price = parseFloat((diffDays * pricePerDay))
                    // price = price.toFixed(2);
                    // price = parseFloat(price);

                    //console.log("dates", startOfMonth, endOfMonth, diffDays, price);

                    data.teamId = members.teamId;
                    data.teamUserId = members.teamUserId;
                    data.email = members.email;
                    data.createdUser = members.createdUser
                    data.price = price;
                    data.noOfDays = diffDays;
                    data.endDate = endOfMonth
                    data.startDate = currentDate

                    if (members.teamUserPayments && dateDiff >= 0) {
                        delete data;
                    } else {
                        memberList.push(data);
                        totalPrice = parseFloat(totalPrice + price);
                        totalPrice = parseFloat(totalPrice);
                    }

                    //console.log("totalPrice before", totalPrice, typeof (price));


                    //console.log("totalPrice", totalPrice);

                }

                let resData = {
                    teamId: objectId,
                    totalPrice: totalPrice.toFixed(2),
                    memberList: await Promise.all(memberList)
                }
                return Response.success(res, resData)
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        createPaymentTeam: async(req, res, teamId) => {

            try {

                let inserData = {
                    teamId: req.body.teamId,
                    createdUser: req.user._id,
                    //paymentIntentId: paymentIntent.id,
                    teamDetails: req.body.memberList,
                    price: req.body.totalPrice
                }

                let teamPayment = await TeamPayment.create(inserData);

                //console.log("teamPayment", teamPayment);

                let now = new Date();
                let timestamp = now.getFullYear().toString(); //To get year
                timestamp += (now.getFullMonth < 9 ? '0' : '') + now.getMonth().toString(); //To get month
                timestamp += (now.getDate() < 10 ? '0' : '') + now.getDate().toString(); //To get Date
                timestamp += now.getMilliseconds(); //To get millisecond
                let EventName = 'DF';
                let bookingId = EventName + timestamp;
                // console.log(bookingId)

                //set the price and currency in stripe
                let paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(parseFloat(req.body.totalPrice * 100)), //Amount should pay
                    currency: 'usd',
                    payment_method_types: ['card'],
                    metadata: {
                        teamPaymentId: String(teamPayment._id)
                    },
                    capture_method: 'manual'
                        //customer: customer.stripe_id
                });

                // console.log("paymentIntent", paymentIntent);

                await TeamPayment.update({ _id: teamPayment._id }, { client_secret: paymentIntent.client_secret, paymentStatus: 1, paymentIntentId: paymentIntent.id, transactionId: bookingId })

                let resData = {
                    paymentIntentId: paymentIntent.id,
                    teamPaymentId: teamPayment._id,
                    client_secret: paymentIntent.client_secret
                }

                return Response.success(res, resData)

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        capturePayment: async(req, res) => {
            try {

                let currentDate = moment().format('YYYY-MM-DD');

                let Schema = Joi.object().keys({
                    teamPaymentId: Joi.string().required(),
                    paymentIntentId: Joi.string().required()
                })

                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let checkPaymentStatus = await stripe.paymentIntents.capture(req.body.paymentIntentId)

                console.log("checkPaymentStatus", checkPaymentStatus);

                if (!checkPaymentStatus) {
                    // console.log("payment intent id not exist");
                    return Response.badValuesData(res, "Payment Inetnet id not exist")
                }

                if (checkPaymentStatus.status == "succeeded") {
                    // console.log("payment success");

                    let checkTeamPayment = await TeamPayment.findOne({ _id: req.body.teamPaymentId, paymentIntentId: req.body.paymentIntentId })

                    // console.log("checkTeamPayment------------>>>>>", checkTeamPayment);


                    await TeamPayment.update({ _id: req.body.teamPaymentId }, { paymentStatus: 2 })

                    for (let teamUser of checkTeamPayment.teamDetails) {

                        // console.log("teamUser---------->>>", teamUser);

                        let userPayment = await TeamUserPayment.create({
                            teamUserId: teamUser.teamUserId,
                            price: teamUser.price,
                            teamPaymentId: req.body.teamPaymentId,
                            paymentDate: currentDate,
                            startDate: teamUser.startDate,
                            endDate: teamUser.endDate
                        })

                        await TeamUsers.update({ _id: teamUser.teamUserId }, { lastPaymentId: userPayment._id, planExpiryDate: teamUser.endDate })

                    }
                    // console.log("req.user", req.user)

                    let mailData = {
                        userName: req.user.userName,
                        email: req.user.email,
                        sub: `doodleflow.io | ${parseFloat(checkPaymentStatus.amount / 100)}$ \n Payment recieved Successfully !`,
                        link: `${process.env.BASE_URL}teams/${checkTeamPayment.teamId}`,
                        members: checkTeamPayment.teamDetails.length,
                        teamName: (await Teams.findOne({ _id: checkTeamPayment.teamId })).teamName
                    }
                    mailer.paymentSuccessMail(mailData)

                } else {
                    // console.log("payment not yet done");
                    let mailData = {
                        userName: req.user.userName,
                        email: req.user.email,
                        sub: `doodleflow.io | We couldn't process your request for payment of Rs.${parseFloat(checkPaymentStatus.amount / 100)}`
                    }
                    mailer.paymentDueMail(mailData)
                    return Response.badValuesData(res, "Payment not yet completed")
                }

                return Response.success(res, "Payment captured")
            } catch (err) {

                // console.log("err--------------->>>", err);

                if (!!err.raw.code) {
                    if (err.raw.code == "payment_intent_unexpected_state") {
                        return Response.badValuesData(res, "Payment not yet completed")
                    }
                }

                return Response.errorInternal(err, res)
            }
        },

        assignToProjects: async(req, res) => {
            try {

                let userSchema = Joi.object().keys({
                    userId: Joi.string().required(),
                    email: Joi.string().required(),
                    firstName: Joi.string().required()
                });

                let Schema = Joi.object().keys({
                    projectId: Joi.string().required(),
                    addUsers: Joi.array().items(userSchema).unique().default([]),
                    removeUsers: Joi.array().items(userSchema).unique().default([])
                })

                let subtract;
                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let projectId = mongoose.Types.ObjectId(value.projectId);

                let checkProject = await Projects.findOne({ _id: projectId, projectStatus: { $eq: 1 } });
                if (!checkProject) {
                    return Response.badValues(res, 'You does not assign a member to deleted project')
                }

                let projectTeamMember = await ProjectTeamMember.find({
                    projectId: projectId,
                });

                let currentDate = moment().utc().format('');
                let notificationIds = [];
                let emailLen = value.addUsers.length - 1;
                if (value.addUsers.length > 0) {
                    for (let [indexx, user] of value.addUsers.entries()) {
                        if (user.email == req.user.email) {
                            continue;
                        }

                        let userDetails = await User.findOne({ email: user.email }).lean();

                        //Focus gruop member addition
                        // mail for team members
                        let checkMember = await TeamUsers.find({ email: user.email, createdUser: req.user._id, status: 1 });
                        if (checkMember.length == 0 || req.user.email == user.email) {
                            return Response.badValuesData(res, `You can't assign ${user.email} to this project`)
                        }

                        // plan expiry

                        let planExpiryDate = checkMember[0].planExpiryDate;
                        if (planExpiryDate != undefined) {
                            subtract = moment(planExpiryDate).diff(currentDate, 'day')
                        }

                        let checkAlreadyExists = await ProjectTeamMember.find({
                            projectId: projectId,
                            'projectTeamMember.userId': user.userId,
                        });
                        if (checkAlreadyExists.length > 0) {
                            return Response.badValues(res, `${user.email} already assigned in this project`)
                        }
                        //user Id and Name for Notification
                        notificationIds.push({ _id: user.userId, name: user.firstName });
                        for (let i of projectTeamMember) {
                            if (i.projectTeamMember.userId.toString() !== req.user._id.toString()) {
                                notificationIds.push({ _id: i.projectTeamMember.userId, name: i.projectTeamMember.firstName });
                            }
                        }

                        // if (subtract >= 0) { payment removal
                        await ProjectTeamMember.create({
                            projectId: projectId,
                            projectTeamMember: {
                                userId: userDetails._id || '',
                                email: user.email,
                                firstName: userDetails.firstName || ''
                            },
                            createdBy: req.user._id
                        });

                        let mailData = {
                            userName: req.user.userName,
                            email: user.email,
                            projectName: checkProject.projectName,
                            link: `${process.env.BASE_URL}project/${checkProject._id}`
                        }
                        mailer.teamMemberInvite(mailData);

                        let createActivity = await activityFeed.create({
                            projectId: req.body.projectId,
                            userId: req.user._id,
                            message: `invited ${user.email} to ${checkProject.projectName} project`,
                            type: 'activity'
                        })

                        let team = await activityFeed.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName email')

                        Pusher.activitySocket(`ch-${req.body.projectId}`, team);

                        /** Notification starts */
                        if (indexx == emailLen) {

                            for (let [index, i] of notificationIds.entries()) {
                                let lNotificaionChannel = [];
                                let notifyObj;

                                // if (index == 0) {
                                //     notificationIds.push({ _id: req.user._id, name: user.firstName });
                                // }

                                if (value.addUsers.length == 1) {
                                    notifyObj = await Notification.create({
                                        'userId': i._id,
                                        'projectId': projectId,
                                        notificationType: 'projectNotification',
                                        message: `${req.user.userName} has invited ${i.name} to '${checkProject.projectName}.'`
                                    })
                                } else {
                                    let membersCount = value.addUsers.length;
                                    notifyObj = await Notification.create({
                                        'userId': i._id,
                                        'projectId': projectId,
                                        notificationType: 'projectNotification',
                                        message: `${req.user.userName} has invited ${membersCount} members to '${checkProject.projectName}.'`
                                    })
                                }

                                lNotificaionChannel.push((await User.findById(i._id).select('channelName')).channelName)
                                let Notify = await Notification.find({ _id: notifyObj._id })
                                Pusher.sendNotification(lNotificaionChannel, Notify);
                            }
                        }
                        // } else {
                        //     return Response.badValuesData(res, `Payment Expired for this user`)
                        // }
                    }
                    return Response.success(res, teamMembers, 'User added successfully')
                }

                if (value.removeUsers.length > 0) {
                    for (let user of value.removeUsers) {
                        let checkUser = await ProjectTeamMember.findOne({
                            projectId: projectId,
                            'projectTeamMember.userId': user.userId,
                            // createdBy: req.user._id
                        });

                        let checkMember = await TeamUsers.findOne({ email: user.email, createdUser: checkUser.createdBy, status: 1 });
                        let planExpiryDate = checkMember.planExpiryDate;
                        if (planExpiryDate != undefined) {
                            subtract = moment(planExpiryDate).diff(currentDate, 'day')
                        }

                        // if (checkUser && (subtract >= 0)) { payment removal
                        if (checkUser) {
                            await ProjectTeamMember.deleteOne({
                                projectId: projectId,
                                'projectTeamMember.userId': user.userId,
                                createdBy: checkUser.createdBy
                            });

                            let createActivity = await activityFeed.create({
                                projectId: projectId,
                                userId: req.user._id,
                                message: `removed ${user.email} from ${checkProject.projectName} project`,
                                type: 'activity'
                            })

                            let team = await activityFeed.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName email')

                            Pusher.activitySocket(`ch-${projectId}`, team);

                        }
                        // else {
                        //     return Response.badValuesData(res, `Payment Expired for this user`)
                        // }
                    }
                    return Response.success(res, teamMembers, 'User removed successfully')
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        removeMember: async(req, res) => {
            try {
                let Schema = Joi.object().keys({
                    projectId: Joi.string().required(),
                    user: {
                        userId: Joi.string().required(),
                        email: Joi.string().required(),
                        firstName: Joi.string().required()
                    }
                });

                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let projectTeamMember = await ProjectTeamMember.findOne({
                    projectId: value.projectId,
                    'projectTeamMember.userId': value.user.userId,
                    createdBy: req.user._id
                });

                if (!projectTeamMember) {
                    return Response.badValues(res, 'You are not having permission to remove member')
                }

                await ProjectTeamMember.deleteOne({
                    projectId: value.projectId,
                    'projectTeamMember.userId': value.user.userId,
                    createdBy: req.user._id
                });
                let project = await Projects.findOne({
                    _id: value.projectId
                });

                let createActivity = await activityFeed.create({
                    projectId: value.projectId,
                    userId: req.user._id,
                    message: `removed ${value.user.email} from ${project.projectName} project`,
                    type: 'activity'
                })

                Pusher.activitySocket(`ch-${value.projectId}`, createActivity);
                return Response.success(res, project, 'Member removed successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        paymentDueMailFunction: async(req, res) => {
            try {
                let paymentDue = await Teams.aggregate([
                    { $match: { status: 1, team_status: 1, createdUser: req.user._id } },
                    { $lookup: { from: 'teampayments', localField: '_id', foreignField: 'teamId', as: 'teamPayments' } },
                    { $unwind: { path: '$teamPayments', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            userId: { $first: "$createdUser" },
                            teamName: { $first: "$teamName" },
                            teamPayment: { $first: "$teamPayments" }
                        }
                    },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'Users' } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },

                ])

                let userData = {};
                let currentDate = moment().utc().format('');

                paymentDue.forEach(async(element) => {
                    userData.teamName = element.teamName;
                    userData.firstName = element.Users.firstName;
                    userData.email = element.Users.email;
                    let data = element.teamPayment;
                    if (data != null || data != undefined) {
                        userData.teamCount = data.teamDetails.length;
                        userData.notificationId = data.createdUser;
                        if (data.paymentStatus == 2 && data.status == 1 && userData.teamCount > 0) {
                            let expiryDate = data.teamDetails[0].endDate;
                            let subtract = moment(expiryDate).diff(currentDate, 'day');
                            if (subtract == 7) {
                                mailer.paymentExpiry(userData);
                            } else if (subtract == 1) {

                                let lNotificaionChannel;
                                let notifyObj = await Notification.create({
                                    'userId': userData.notificationId,
                                    teamId: paymentDue._id,
                                    notificationType: 'paymentNotification',
                                    message: `${userData.teamName} is due for payment. Member access will be restricted from tomorrow`,
                                    createdUser: req.user._id
                                })

                                // console.log(notifyObj, "OBJECT")
                                let userChannel = await User.findOne({ _id: userData.notificationId }).select('channelName');
                                lNotificaionChannel = userChannel.channelName;
                                let Notify = await Notification.find({ _id: notifyObj._id })
                                Pusher.sendNotification(lNotificaionChannel, Notify);
                            }
                        }
                    }

                })

                return Response.success(res, paymentDue, 'Payment Due')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        /**
         * get team payments
         */
        getTeamPayments: async(req, res, next) => {
            try {
                let page = req.query.page ? req.query.page : 1;
                let perpage = 8;
                let skip = perpage * (page - 1)

                var result = await TeamPayment.find({
                    createdUser: req.user._id,
                    paymentStatus: 2
                }).skip(skip).limit(perpage).lean().sort({ createdAt: -1 });

                result = result.filter(v => {
                    return v.transactionId != null
                });

                let paymentHistory = {
                    payments: result
                }

                return Response.success(res, paymentHistory, 'Team Payment Histories');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * download team payment invoice
         */
        downloadTeamPaymentInvoice: async(req, res, next) => {
            try {
                const schema = Joi.object().keys({
                    id: Joi.string().required()
                }).options({ abortEarly: false });

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let isExist = await TeamPayment.exists({
                    _id: value.id,
                    paymentStatus: 2
                });
                if (!isExist) {
                    return Response.notFound(res, "Team Payment doesn't exist");
                }

                var populatequery = [{ path: 'teamId', select: ['teamName', '_id'] }, { path: 'createdUser', select: ['firstName', 'lastName', '_id', 'email', 'profilePicture'] }]
                let teamPayment = await TeamPayment.findOne({
                    _id: value.id,
                    paymentStatus: 2,
                    status: 1
                }).populate(populatequery);

                let details = JSON.stringify({
                    firstName: teamPayment.createdUser.firstName,
                    lastName: teamPayment.createdUser.lastName,
                    members: teamPayment.teamDetails,
                    totalPrice: teamPayment.price,
                    invoiceId: teamPayment.transactionId,
                    teamName: teamPayment.teamId.teamName,
                    email: teamPayment.createdUser.email,
                    invoiceDate: moment(teamPayment.createdAt).utcOffset("+05:30").format('DD/MM/YYYY, hh:mm A')
                });

                let invoiceTemplatePath = path.join(__dirname, '../../static/templates/invoice.html');
                let invoiceTempalte = fs.readFileSync(invoiceTemplatePath, 'utf-8');

                //remove this on production juz for staging
                if (!jsReportInitialized) {
                    await jsreport().init();
                    jsReportInitialized = true;
                }

                await jsreport.render({
                    template: {
                        content: invoiceTempalte,
                        engine: 'handlebars',
                        recipe: 'chrome-pdf',
                        helpers: `
                        function plusOne(number) {
                            return number + 1;
                        };`

                    },
                    data: details
                }).then((out) => {
                    let downloadFileName = path.join(__dirname, '../../public/', `invoice_${teamPayment._id}.pdf`);
                    var output = fs.createWriteStream(downloadFileName)
                    out.stream.pipe(output);
                    out.stream.on('end', () => {
                        let filepathfromResponse = downloadFileName
                        let lastParam = filepathfromResponse.split('/')
                        let length = lastParam.length
                        let filepath = { path: `${process.env.SERVER_URL}public/${lastParam[length - 1]}` };
                        return Response.success(res, filepath, 'Invoice download link')
                    })
                }).catch((e) => {
                    console.log(e, "fghjkl")
                    return Response.forbiddenError(res, 'Something went wrong. Please try again.')
                });
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        adminCreateTeam: async(req, res) => {
            try {
                let Schema = Joi.object().keys({
                    teamName: Joi.string().required().trim(),
                    description: Joi.string().allow(''),
                    link: Joi.string().allow(''),
                    invitedUsers: Joi.array().items(Joi.string().email()).required(),
                    userId: Joi.string().required()
                })

                let { error, value } = Joi.validate(req.body, Schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let userId = req.body.userId;

                let checkTeam = await Teams.find({ teamName: req.body.teamName, createdUser: mongoose.Types.ObjectId(userId), status: 1 });
                if (checkTeam.length > 0) {
                    return Response.badValuesData(res, 'Already you have the same team name')
                }

                let obj = {
                    teamName: req.body.teamName,
                    description: req.body.description,
                    link: req.body.link,
                    createdUser: mongoose.Types.ObjectId(userId)
                }

                let createTeam = await Teams.create(obj);

                let userData = await User.findOne({ _id: mongoose.Types.ObjectId(userId) });

                let invitedUsers = req.body.invitedUsers;
                if (invitedUsers.length > 0) {
                    invitedUsers.forEach(async(element) => {
                        if (element === userData.email) {
                            await Teams.update({ _id: createTeam._id }, { status: 0 });
                            await teamMembers.update({ teamId: createTeam._id }, { status: 0 });
                            return Response.badValuesData(res, "You cannot use the same user email")
                        }
                    })
                }

                let emailTeamMatesArr = [];
                for (let user of invitedUsers) {


                    if (user == userData.email) {
                        continue;
                    }
                    let checkTeamUser = await TeamUsers.findOne({ createdUser: userData._id, email: user, status: 1 })

                    if (!checkTeamUser) {
                        console.log("team user not exist");

                        checkTeamUser = await TeamUsers.create({
                            createdUser: userData._id,
                            email: user
                        })

                    }


                    let checkTeamMember = await teamMembers.findOne({ teamId: createTeam._id, teamUserId: checkTeamUser._id, createdUser: userData._id, email: user, status: 1 })


                    if (!checkTeamMember) {
                        console.log("team member not exist");

                        await teamMembers.create({
                            teamId: createTeam._id,
                            teamUserId: checkTeamUser._id,
                            email: user,
                            createdUser: userData._id
                        })
                        emailTeamMatesArr.push(user);

                    }

                }



                let team = await Teams.aggregate([
                    { $match: { _id: createTeam._id, status: 1 } },
                    { $lookup: { from: 'teammembers', localField: '_id', foreignField: 'teamId', as: 'teamMembers' } },
                    { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'teamMembers.status': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            teamName: { $first: '$teamName' },
                            status: { $first: '$status' },
                            description: { $first: '$description' },
                            link: { $first: '$link' },
                            createdUser: {
                                $first: {
                                    _id: '$users._id',
                                    userName: '$users.userName',
                                    firstName: '$users.firstName',
                                    lastName: '$users.lastName',
                                    email: '$users.email'
                                }
                            },
                            teamMembers: {
                                $push: {
                                    _id: '$teamMembers._id',
                                    email: '$teamMembers.email'
                                }
                            }
                        }
                    }
                ]);

                let discountAmt = await Discount.findOne({ userId: userData._id, status: 1 });
                let defaultPrice;
                if (discountAmt == null) {
                    defaultPrice = process.env.TEAM_MEMBER_PRICE;
                } else {
                    defaultPrice = (process.env.TEAM_MEMBER_PRICE - ((discountAmt.discount / 100) * process.env.TEAM_MEMBER_PRICE)) || process.env.TEAM_MEMBER_PRICE;
                };

                let objectId = mongoose.Types.ObjectId(createTeam._id);

                let listTeamMembers = await teamMembers.aggregate([
                    { $match: { teamId: objectId, status: 1 } },
                    {
                        $lookup: {
                            from: 'teamusers',
                            localField: 'teamUserId',
                            foreignField: '_id',
                            as: 'teamUsers'
                        }
                    },
                    { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    { $match: { createdUser: userData._id } },
                    {
                        $lookup: {
                            from: 'teamuserpayments',
                            localField: 'teamUsers.lastPaymentId',
                            foreignField: '_id',
                            as: 'teamUserPayments'
                        }
                    },
                    { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } }

                ]);


                let startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
                let endOfMonth = moment().endOf('month').format('YYYY-MM-DD');
                let monthDays = moment(endOfMonth).diff(startOfMonth, 'days')
                let currentDate = moment().format('YYYY-MM-DD');

                let memberList = [];
                let data = {};
                let dateDiff;
                let totalPrice = parseFloat(0);
                for (let members of listTeamMembers) {

                    data = {};

                    let diffDays = moment(endOfMonth).diff(currentDate, 'days')
                    let pricePerDay = parseFloat((defaultPrice / monthDays));
                    let price = parseFloat((diffDays * pricePerDay))
                    price = price.toFixed(2);
                    price = parseFloat(price);

                    if (members.teamUserPayments) {
                        dateDiff = moment(members.teamUserPayments.endDate).diff(currentDate, 'days');

                        if (dateDiff >= 0) {
                            monthDays = moment(endOfMonth).diff(startOfMonth, 'days')
                            diffDays = moment(endOfMonth).diff(members.teamUserPayments.endDate, 'days')
                            pricePerDay = parseFloat((defaultPrice / monthDays));

                            price = parseFloat((diffDays * pricePerDay))
                            console.log("price", price);
                            price = price.toFixed(2);
                            price = parseFloat(price);
                        }
                    }

                    data.teamId = members.teamId;
                    data.teamUserId = members.teamUserId;
                    data.email = members.email;
                    data.createdUser = members.createdUser
                    data.price = price;
                    data.noOfDays = diffDays;
                    data.endDate = endOfMonth
                    data.startDate = currentDate

                    if (members.teamUserPayments && dateDiff >= 0) {
                        delete data;
                    } else {
                        memberList.push(data);
                        totalPrice = parseFloat(totalPrice + price);
                        totalPrice = parseFloat(totalPrice);
                    }
                }

                let resData = {
                    teamId: objectId,
                    totalPrice: totalPrice.toFixed(2),
                    memberList: await Promise.all(memberList)
                }

                let inserData = {
                    teamId: resData.teamId,
                    createdUser: userData._id,
                    //paymentIntentId: paymentIntent.id,
                    teamDetails: resData.memberList,
                    price: resData.totalPrice
                }

                console.log(inserData, "INSERT DATA")
                let teamPayment = await TeamPayment.create(inserData);

                console.log("teamPayment", teamPayment);

                let now = new Date();
                let timestamp = now.getFullYear().toString(); //To get year
                timestamp += (now.getFullMonth < 9 ? '0' : '') + now.getMonth().toString(); //To get month
                timestamp += (now.getDate() < 10 ? '0' : '') + now.getDate().toString(); //To get Date
                timestamp += now.getMilliseconds(); //To get millisecond
                let EventName = 'DF';
                let bookingId = EventName + timestamp;

                console.log(bookingId, "BOOKINGID")

                //set the price and currency in stripe
                let paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(parseFloat(inserData.price * 100)), //Amount should pay
                    currency: 'usd',
                    payment_method_types: ['card'],
                    metadata: {
                        teamPaymentId: String(teamPayment._id)
                    },
                    capture_method: 'manual'
                        //customer: customer.stripe_id
                });


                await TeamPayment.update({ _id: teamPayment._id }, { client_secret: paymentIntent.client_secret, paymentStatus: 1, paymentIntentId: paymentIntent.id, transactionId: bookingId })

                let ressData = {
                    paymentIntentId: paymentIntent.id,
                    teamPaymentId: teamPayment._id,
                    client_secret: paymentIntent.client_secret
                }

                console.log(ressData, "QWEYUO")

                let checkPaymentStatus = await stripe.paymentIntents.capture(ressData.paymentIntentId)


                if (!checkPaymentStatus) {
                    return Response.badValuesData(res, "Payment Inetnet id not exist")
                }

                if (checkPaymentStatus.status == "succeeded") {

                    let checkTeamPayment = await TeamPayment.findOne({ _id: ressData.teamPaymentId, paymentIntentId: ressData.paymentIntentId })

                    await TeamPayment.update({ _id: ressData.teamPaymentId }, { paymentStatus: 2 })

                    for (let teamUser of checkTeamPayment.teamDetails) {

                        let userPayment = await TeamUserPayment.create({
                            teamUserId: teamUser.teamUserId,
                            price: teamUser.price,
                            teamPaymentId: ressData.teamPaymentId,
                            paymentDate: currentDate,
                            startDate: teamUser.startDate,
                            endDate: teamUser.endDate
                        })

                        await TeamUsers.update({ _id: teamUser.teamUserId }, { lastPaymentId: userPayment._id, planExpiryDate: teamUser.endDate })

                    }

                } else {
                    return Response.badValuesData(res, "Payment not yet completed")
                }

                return Response.success(res, "Payment captured")


            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
    }

    return Object.freeze(methods);
}

module.exports = teamController();