require("dotenv").config();

const Joi = require('joi');
const Response = require('../../utils/response');
const FocusGroup = require('../focusGroup/focusGroup.model');
const FGScreen = require('../focusGroup/fgProjectScreen.model');
const Version = require('../screenversions/screenVersion.model');
const Interaction = require('../interaction/interaction.model');
const Project = require('../project/project.model');
const projectTeamMember = require('../project/projectTeamMember.model');
const TeamUsers = require('../teamUsers/teamUsers.model');
const TeamUserPayment = require('../teamUserPayment/teamUserPayments.model');
const Notification = require('../notification/notification.model');
const pusherNotif = require('../../utils/pusher')
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const _ = require('lodash');

function interactionComponentCtrl() {
    const methods = {
        /**
         * add interaction
         */
        addInteraction: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().required(),
                    event: Joi.string().required().default('click'),
                    bounds: Joi.object().keys({
                        x: Joi.number().required(),
                        y: Joi.number().required(),
                        width: Joi.number().required(),
                        height: Joi.number().required()
                    }).required(),
                    targetType: Joi.string().required().default('screen').valid('screen', 'url'),
                    targetScreenId: Joi.string().when('targetType', {
                        is: 'screen',
                        then: Joi.string().required()
                    }).concat(Joi.string().when('targetType', {
                        is: 'url',
                        then: Joi.string().allow(null).valid(null)
                    })),
                    targetUrl: Joi.string().when('targetType', {
                        is: 'url',
                        then: Joi.string().uri().required()
                    }).concat(Joi.string().when('targetType', {
                        is: 'screen',
                        then: Joi.string().allow(null).valid(null)
                    })),
                    focusGroupId: Joi.string().required()
                }).options({ abortEarly: false });

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let isAlreadyExist = await Interaction.find({
                    screenId: value.screenId,
                    focusGroupId: value.focusGroupId,
                });


                // if (isAlreadyExist.length == 0) {

                //     let FG = await FocusGroup.findOne({ _id: value.focusGroupId, groupstatus: 1 });

                //     let projectTeamMembers = await projectTeamMember.find({ projectId: FG.projectId });

                //     let currentDate = moment().utc().format('');

                //     let notificationEmail = projectTeamMembers.map(async(v) => {
                //         let projectId = await Project.findOne({ _id: v.projectId, projectStatus: 1 }).select('userId');
                //         if (v.projectTeamMember.userId.toString() !== req.user._id.toString()) {
                //             let teamUsers = await TeamUsers.findOne({ email: v.projectTeamMember.userId, createdUser: projectId.userId }).sort({ planExpiryDate: -1 });
                //             if (teamUsers != null) {
                //                 let teamUserPayment = await TeamUserPayment.findOne({ teamUserId: teamUsers._id }).sort({ endDate: -1 });
                //                 let subtract = moment(teamUserPayment.endDate).diff(currentDate, 'day');
                //                 if (subtract > 0) {
                //                     return v.projectTeamMember.email;
                //                 }
                //             }
                //         }
                //     });

                //     notificationEmail = await Promise.all(notificationEmail);

                //     notificationEmail = notificationEmail.filter(v => {
                //         return v != undefined
                //     })

                //     notificationEmail = [...notificationEmail];

                //     for (let i of notificationEmail) {
                //         let userData = await User.findOne({ email: i })
                //         if (userData) {
                //             let lObjNotifData = await Notification.create({
                //                 'userId': userData._id,
                //                 'focusGroupId': FG._id,
                //                 'projectId': FG.projectId,
                //                 notificationType: 'focusGroupNotification',
                //                 message: `${req.user.userName} has created Prototype in '${lObjFocusGroupRes.groupName}' Focusgroup.`
                //             })
                //             let lObjNotifChannel = userData.channelName
                //             let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })
                //             pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                //         }
                //     }
                // }

                for (let a of isAlreadyExist) {
                    if (a.bounds.x == value.bounds.x && a.bounds.y == value.bounds.y && a.bounds.width == value.bounds.width && a.bounds.height == value.bounds.height) {
                        return Response.badValues(res, 'Interaction is already exist for given screenId and targetScreenId');
                    }
                }

                value.createdBy = req.user._id;
                let result = await Interaction.create(value);

                Response.success(res, result, 'Interaction added successfully.');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * remove interaction
         */
        removeInteraction: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    id: Joi.string().required()
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let isExist = await Interaction.exists({
                    _id: value.id
                });
                if (!isExist) {
                    return Response.notFound(res, "Interaction doesn't exist");
                }

                await Interaction.remove({
                    _id: value.id
                });

                Response.success(res, null, 'Interaction removed successfully.');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * remove all interactions
         */
        removeAllInteractions: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().required()
                }).options({ abortEarly: false });

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let isExist = await Interaction.exists({
                    screenId: value.screenId
                });
                if (!isExist) {
                    return Response.notFound(res, "Interactions doesn't exist");
                }

                await Interaction.remove({
                    screenId: value.screenId
                });

                Response.success(res, null, 'Interactions removed successfully.');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * get interactions
         */
        getInteractions: async(req, res, next) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().required()
                }).options({ abortEarly: false });

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let result = await Interaction.find({
                    screenId: value.screenId
                });
                Response.success(res, result, 'All Interactions');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        updateInteraction: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().required(),
                    event: Joi.string().required().default('click'),
                    bounds: Joi.object().keys({
                        x: Joi.number().required(),
                        y: Joi.number().required(),
                        width: Joi.number().required(),
                        height: Joi.number().required()
                    }).required(),
                    targetType: Joi.string().required().default('screen').valid('screen', 'url'),
                    targetScreenId: Joi.string().when('targetType', {
                        is: 'screen',
                        then: Joi.string().required()
                    }).concat(Joi.string().when('targetType', {
                        is: 'url',
                        then: Joi.string().allow(null).valid(null)
                    })),
                    targetUrl: Joi.string().when('targetType', {
                        is: 'url',
                        then: Joi.string().uri().required()
                    }).concat(Joi.string().when('targetType', {
                        is: 'screen',
                        then: Joi.string().allow(null).valid(null)
                    })),
                    focusGroupId: Joi.string().required()
                }).options({ abortEarly: false });

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let interactionId = ObjectId(req.params.id);
                let isExist = await Interaction.findOne({
                    _id: interactionId,
                    focusGroupId: value.focusGroupId
                });
                if (!isExist) {
                    return Response.notFound(res, "Interaction doesn't exist");
                } else {
                    let lObjInteraction = await Interaction.findOneAndUpdate({ _id: ObjectId(interactionId) }, {
                        $set: {
                            "screenId": value.screenId,
                            "targetType": value.targetType,
                            "targetScreenId": value.targetScreenId,
                            "targetUrl": value.targetUrl
                        }
                    }, {
                        new: true
                    });
                    Response.success(res, lObjInteraction, 'Interaction updated successfully.');
                }

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        listFGScreenWithVersion: async(req, res, next) => {
            try {
                const schema = Joi.object().keys({
                    focusgroupId: Joi.string().required()
                }).options({ abortEarly: false });

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                // let isMemberExsists = await FocusGroup.aggregate([{
                //         $match: { _id: ObjectId(req.params.focusgroupId), groupstatus: 1 }
                //     },
                //     { $lookup: { from: 'projectteammembers', localField: 'projectId', foreignField: 'projectId', as: 'teamMembers' } },
                //     {
                //         $match: {
                //             $or: [
                //                 { "createdUser": req.user._id },
                //                 { "teamMembers.projectTeamMember.email": req.user.email }
                //             ]
                //         }
                //     }
                // ]);

                // if (isMemberExsists.length == 0) {
                //     return Response.forbiddenError(res, 'Access Denied, If you want to view please join the group first!!');
                // }

                let listScreen = await FGScreen.aggregate([{
                        $match: {
                            focusGroupId: ObjectId(req.params.focusgroupId)
                        }
                    },
                    { $lookup: { from: 'project_screens', localField: 'projectScreenId', foreignField: '_id', as: 'projectScreens' } },
                    { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'focusgroups', localField: 'focusGroupId', foreignField: '_id', as: 'focusgroup' } },
                    { $unwind: { path: '$focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'screens', localField: 'projectScreens.screenId', foreignField: '_id', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$focusgroup._id",
                            "invitedMembers": { $first: '$focusgroup.invitedMembers' },
                            "groupName": { $first: "$focusgroup.groupName" },
                            "type": { $first: "$focusgroup.type" },
                            "groupstatus": { $first: "$focusgroup.groupstatus" },
                            "description": { $first: "$focusgroup.description" },
                            "createdUser": { $first: '$focusgroup.createdUser' },
                            "isPublic": { $first: "$focusgroup.isPublic" },
                            "projectId": { $first: "$focusgroup.projectId" },
                            "createdAt": { $first: "$createdAt" },
                            "joinedMembers": { $first: '$focusgroup.joinedMembers' },
                            screens: {
                                "$push": {
                                    "_id": "$screens._id",
                                    "categories": "$screens.categories",
                                    "industry": "$screens.industry",
                                    "tags": "$screens.tags",
                                    "isPublish": "$screens.isPublish",
                                    "disableComments": "$screens.disableComments",
                                    "colorPalette": "$screens.colorPalette",
                                    "approvedStatus": "$screens.approvedStatus",
                                    "viewCount": "$screens.viewCount",
                                    "viewedUser": "$screens.viewedUser",
                                    "screenStatus": "$screens.screenStatus",
                                    "uploadStatus": "$screens.uploadStatus",
                                    "inspire": "$screens.inspire",
                                    "screenName": "$screens.screenName",
                                    "image": "$screens.image",
                                    "userId": "$screens.userId",
                                    "description": "$description",
                                    "sequence": "$sequence",
                                    "screenVersionId": "$screens.screenVersionId",
                                    "projectScreenId": "$projectScreens._id"
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: "$_id",
                            "invitedMembers": 1,
                            "groupName": 1,
                            "type": 1,
                            "groupstatus": 1,
                            "description": 1,
                            "isPublic": 1,
                            "projectId": 1,
                            "createdUser": {
                                '_id': '$createdUser._id',
                                'isAdmin': true,
                                'userName': '$createdUser.userName',
                                'firstName': '$createdUser.firstName',
                                'lastName': '$createdUser.lastName',
                                'email': '$createdUser.email',
                                'userId': '$createdUser._id',
                                "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$createdUser.profilePicture"] }, ""] },
                            },
                            'joinedMembers': 1,
                            "createdAt": 1,
                            screens: {
                                $filter: {
                                    input: "$screens",
                                    as: "screen",
                                    cond: { $gte: ["$$screen.screenStatus", 1] }
                                }
                            }
                        }
                    },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $sort: { "screens.sequence": 1 }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            "invitedMembers": { $first: '$invitedMembers' },
                            "groupName": { $first: "$groupName" },
                            "type": { $first: "$type" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': { $first: '$joinedMembers' },
                            "createdAt": { $first: "$createdAt" },
                            "isPublic": { $first: { $ifNull: ["$isPublic", false] } },
                            "project": { $first: "$projectId" },
                            screens: {
                                $push: {
                                    "_id": '$screens._id',
                                    // "screenId": '$screens._id',
                                    image: {
                                        $cond: {
                                            if: { $eq: ['$screens.inspire', false] },
                                            then: { $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$screens.image"] }, ""] },
                                            else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$screens.image"] }, ""] }
                                        }
                                    },
                                    images: {
                                        $cond: {
                                            if: { $eq: ['$screens.inspire', false] },
                                            then: {
                                                $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$screens.image"] }, ""]
                                            },
                                            else: { $ifNull: [{ $concat: [`${process.env.CLOUDURL}screens/`, "$screens.image"] }, ""] }
                                        }
                                    },
                                    "sequence": { "$ifNull": ["$screens.sequence", 999999] },
                                    // "images": { $ifNull: [{ $concat: ["https://doodleflowbucket.s3.ap-south-1.amazonaws.com/", "$screens.image"] }, ""] },
                                    // "image": { $ifNull: [{ $concat: ["https://doodleflowbucket.s3.ap-south-1.amazonaws.com/", "$screens.image"] }, ""] },
                                    "description": "$screens.description",
                                    "parentId": '$screens.parentScreen',
                                    "screensId": "$screens.parentScreenId",
                                    "screenName": { $ifNull: ["$screens.screenName", ""] },
                                    "screenStatus": "$screens.screenStatus",
                                    inspire: '$screens.inspire',
                                    projectScreenId: '$screens.projectScreenId'
                                }
                            }

                        }
                    },
                ]);
                let versions;
                for (let x of listScreen[0].screens) {
                    versions = await Version.find({ parentId: x._id, screenStatus: 1 })
                        .sort({ createdAt: -1 })
                        .limit(1)
                        .select('image sequence description screenName screenStatus inspire parentId').lean();
                    if (versions.length > 0) {
                        for (let y of versions) {
                            if (y != null || y != undefined) {
                                let result;
                                y.description = x.description;
                                y.screenName = x.screenName;
                                y.sequence = x.sequence;
                                if (y.inspire != null || y.inspire != undefined) {
                                    result = y.inspire;
                                } else {
                                    result = false;
                                }

                                let url;
                                if (result == false) {
                                    url = process.env.AWS_URL + y.image;
                                    y.image = url;
                                    y["images"] = url;
                                } else {
                                    url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + y.image;
                                    y.image = url;
                                    y["images"] = url;
                                }
                            }

                            listScreen[0].screens = listScreen[0].screens.filter(v => {
                                return v._id.toString() != y.parentId.toString();
                            })

                        }
                        listScreen[0].screens = [...listScreen[0].screens, ...versions];
                    }
                }

                listScreen = listScreen[0] || {};

                listScreen.screens.sort((a, b) => {
                    return a.sequence - b.sequence
                })

                Response.success(res, listScreen, 'All Interactions');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = interactionComponentCtrl()