require("dotenv").config();

const Joi = require('joi');
const Response = require('../../utils/response');
const Hotspot = require('../hotspot/hotspot.model');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const _ = require('lodash');
const Notification = require('../notification/notification.model');
const FocusGroup = require('../focusGroup/focusGroup.model');
const Screen = require('../screens/screens.model');
const ScreenVersion = require('../screenversions/screenVersion.model');
const User = require('../user/user.model')
const pusherNotif = require('../../utils/pusher')
const Anonymous = require('../anonymous/anonymous.model')
const mailer = require('../../utils/mailService')
let Activity = require('../activityfeed/activityfeed.model')
let Action = require('../hotspotActions/hotspotAction.model');
let Items = require('../flaggedItems/flaggedItems.model');
const projectTeam = require('../project/projectTeamMember.model');
const fgScreen = require('../focusGroup/fgProjectScreen.model');
const Ticket = require('./ticketAssign.model');
const ObjectId = mongoose.Types.ObjectId;

let moment = require('moment')

/***
 * common Hotspot response
 */
async function commonHospotResponse(req, res, lObjHotspotComment) {
    try {
        let lUserDetails = await Hotspot.aggregate([{
                $match: {
                    _id: lObjHotspotComment._id
                }
            },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
            { $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true } },
            { $lookup: { from: 'anonymous', localField: 'anonymousId', foreignField: '_id', as: 'anonymousId' } },
            { $unwind: { path: '$anonymousId', 'preserveNullAndEmptyArrays': true } },
            { $unwind: { path: '$commentRes', 'preserveNullAndEmptyArrays': true } },
            { $lookup: { from: 'users', localField: 'commentRes.userId', foreignField: '_id', as: 'commentRes.userId' } },
            { $unwind: { path: '$commentRes.userId', 'preserveNullAndEmptyArrays': true } },
            { $lookup: { from: 'anonymous', localField: 'commentRes.anonymousId', foreignField: '_id', as: 'commentRes.anonymousId' } },
            { $unwind: { path: '$commentRes.anonymousId', 'preserveNullAndEmptyArrays': true } },
            { $lookup: { from: 'hostspotactions', localField: 'actionId', foreignField: '_id', as: 'hotspotActions' } },
            { $unwind: { path: '$hotspotActions', 'preserveNullAndEmptyArrays': true } },
            { $lookup: { from: 'flaggeditems', localField: 'flagId', foreignField: '_id', as: 'flaggedItem' } },
            { $unwind: { path: '$flaggedItem', 'preserveNullAndEmptyArrays': true } },
            {
                $group: {
                    _id: "$_id",
                    "position": { $first: '$position' },
                    "screenId": { $first: "$screenId" },
                    "comment": { $first: "$comment" },
                    "dueDate": { $first: "$dueDate" },
                    "createdAt": { $first: "$createdAt" },
                    "userId": { $first: "$userId" },
                    "anonymousId": { $first: "$anonymousId" },
                    "actionId": { $first: "$actionId" },
                    "flagStatus": { $first: "$flagStatus" },
                    "flagId": { $first: "$flagId" },
                    "flagType": { $first: "$flaggedItem.name" },
                    "hotspotActions": { $first: "$hotspotActions.name" },
                    "commentRes": {
                        $push: {
                            _id: "$commentRes._id",
                            comment: "$commentRes.comment",
                            "createdAt": "$commentRes.createdAt",
                            anonymousId: {
                                '_id': '$commentRes.anonymousId._id',
                                'email': '$commentRes.anonymousId.email',
                                userName: "$commentRes.anonymousId.userName",
                                userId: "$commentRes.anonymousId._id"
                            },
                            userId: {
                                '_id': '$commentRes.userId._id',
                                'userName': '$commentRes.userId.userName',
                                'firstName': '$commentRes.userId.firstName',
                                'lastName': '$commentRes.userId.lastName',
                                'email': '$commentRes.userId.email',
                                "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$commentRes.userId.profilePicture"] }, ""] },
                            },
                        }

                    }
                }
            }, {
                $project: {
                    "position": 1,
                    "screenId": 1,
                    "comment": 1,
                    "dueDate": 1,
                    "createdAt": 1,
                    "actionId": 1,
                    "flagId": 1,
                    "flagStatus": 1,
                    "flagType": 1,
                    "anonymousId": {
                        '_id': '$anonymousId._id',
                        'email': '$anonymousId.email',
                        name: "$anonymousId.userName",
                        userId: "$anonymousId._id"
                    },
                    "userId": {

                        '_id': '$userId._id',
                        'userName': '$userId.userName',
                        'firstName': '$userId.firstName',
                        'lastName': '$userId.lastName',
                        'email': '$userId.email',
                        "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$userId.profilePicture"] }, ""] },
                    },
                    "hotspotActions": 1,
                    "commentRes": 1
                }
            }
        ])

        return lUserDetails;
    } catch (err) {
        return Response.errorInternal(err, res)
    }
};

function hotspotComponentCtrl() {
    const methods = {
        /**
         * Get all Hotspot Comments for a particular screen
         */
        hotspotComments: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required(),
                };

                let { error, value } = Joi.validate(req.params, validate);

                if (error) return Response.badValuesData(res, error);
                let lAryHotspotComment = await Hotspot.find({ screenId: req.params.screenId, status: 1 }).populate('userId', 'userName');
                return Response.success(res, lAryHotspotComment, 'Hotspot Comment');
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        /**
         * Adding Comments to the screen
         */
        createHotspotcomment: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().required(),
                    parentId: Joi.string().trim().allow(''),
                    comment: Joi.string().trim(),
                    top: Joi.string(),
                    left: Joi.string(),
                    actionId: Joi.string().trim().required(),
                    focusgroupId: Joi.string().trim().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let screenId = req.body.screenId;
                let lArrFocusGroupId = await fgScreen.findOne({ "screenId": screenId }).lean()

                if (lArrFocusGroupId == null) {
                    lArrFocusGroupId = await fgScreen.findOne({ "screenId": req.body.parentId }).lean();
                }
                let user;
                let getFocusGroupDetails = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId })

                let lObjCheckOwnedGroup = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId, groupstatus: 2 })
                if (lObjCheckOwnedGroup) return Response.forbiddenError(res, "You can't comment on the Archived group!!")

                if (!getFocusGroupDetails.isPublic) {
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET)

                    let userDetails = await User.find({
                        _id: decoded._id,
                        email: decoded.email,
                        userName: decoded.userName,
                        lastLoggedIn: decoded.lastLoggedIn
                    })
                    userId = decoded._id
                    user = await decoded;
                    value.userId = userId;

                    if (!userDetails) {
                        return Response.errorInternal('Access Denied, If you want to share your comment please login first!!!', res)
                    }
                } else {
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let accessToken = req.headers['x-access-token'];
                    let decord = await jwt.verify(accessToken, process.env.SUPER_SECRET);
                    user = await decord;
                    let checkUser = await User.find({ _id: user._id })
                    if (checkUser.length > 0) {
                        value.userId = user._id
                    } else {
                        value.anonymousId = user._id
                    }
                }

                let lJoinedMembers = getFocusGroupDetails.joinedMembers;
                let lInvitedMembers = getFocusGroupDetails.invitedMembers;
                let lProjectMembers = await projectTeam.find({ projectId: ObjectId(getFocusGroupDetails.projectId) }).select('projectTeamMember');
                lProjectMembers = lProjectMembers.map(v => {
                    return v.projectTeamMember;
                })

                lInvitedMembers = [].concat(lInvitedMembers, lProjectMembers)

                let listinviteMembers = [];

                for (let member of lInvitedMembers) {
                    let mem = await User.findOne({ email: member.email })
                    if (mem) {
                        listinviteMembers.push(mem._id)
                    }
                }

                let lArrayJoinedMenebersId = lJoinedMembers.map(x => {
                    return x._id
                })
                let lAryTotalMembers = [...lArrayJoinedMenebersId, getFocusGroupDetails.createdUser._id, ...listinviteMembers].map(String)

                let lResult = lAryTotalMembers.includes(user._id.toString());
                let emailResult = [];
                await getFocusGroupDetails.invitedMembers.filter((user) => {
                    if (user.email == user.email) {
                        emailResult.push(user)
                    }
                })

                if (getFocusGroupDetails.isPublic == false) {
                    if (!lResult && emailResult.length == 0) return Response.forbiddenError(res, "Access Denied, If you want to share your comment please join this group first");
                }

                value.position = {
                    top: req.body.top,
                    left: req.body.left
                }
                delete value.top
                delete value.left
                console.log(value, "Value")
                value.focusgroupId = req.body.focusgroupId;
                let lObjHotspotComment = await Hotspot.create(value);
                let actionType = await Hotspot.findOneAndUpdate({ _id: lObjHotspotComment }, { actionTypeId: req.body.actionId })

                let lUserDetails = await commonHospotResponse(req, res, lObjHotspotComment);
                lUserDetails = lUserDetails ? lUserDetails[0] : {};
                if (lUserDetails && lUserDetails.commentRes) {
                    lUserDetails.commentRes = _.filter(lUserDetails.commentRes, function(v) {
                        return v.userId.profilePicture
                    });
                }
                if (lUserDetails.userId._id) {
                    delete lUserDetails.anonymousId
                } else if (lUserDetails.anonymousId._id) {
                    delete lUserDetails.userId
                }

                lAryTotalMembers = lAryTotalMembers.map(x => {
                    if (x !== user._id.toString()) return x;
                })

                lAryTotalMembers = _.compact(lAryTotalMembers);
                let lAryChannels = [];

                if (getFocusGroupDetails.isPublic == false) {
                    for (let i of lAryTotalMembers) {
                        let lNotificaionChannel = []
                        let notifyObj = await Notification.create({
                            'userId': i,
                            'focusGroupId': getFocusGroupDetails._id,
                            notificationType: 'onScreenComment',
                            message: `${user.userName} has commented in hotspot.`,
                            // createdUser: req.user._id
                        })

                        lAryChannels.push((await User.findById(i).select('channelName')).channelName);
                        lNotificaionChannel.push((await User.findById(i).select('channelName')).channelName)
                        let Notify = await Notification.find({ _id: notifyObj._id })
                        pusherNotif.sendNotification(lNotificaionChannel, Notify);
                    }

                    pusherNotif.onScreenComment(lAryChannels, lUserDetails);


                    if (getFocusGroupDetails.hasOwnProperty('projectId') || getFocusGroupDetails.projectId != undefined) {
                        //activity Feed
                        console.log("Activity Check");
                        let createActivity = await Activity.create({
                            projectId: getFocusGroupDetails.projectId,
                            focusGroupId: getFocusGroupDetails._id,
                            userId: userId,
                            message: `commented a screen in '${getFocusGroupDetails.groupName} focus group'`,
                            type: 'activity'
                        })
                        let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                        pusherNotif.activitySocket(`ch-${getFocusGroupDetails.projectId}`, activity)
                    }


                    return Response.success(res, lUserDetails, "Hotspot Comment");
                } else {
                    let anonymous = getFocusGroupDetails.anonymousId;
                    anonymous = Array.isArray(anonymous) ? anonymous : [anonymous]
                    let anonymousIds = []
                    await anonymous.map(x => {
                        anonymousIds.push(x._id)
                    })

                    lAryTotalMembers = [...lAryTotalMembers, ...anonymousIds]

                    for (let i of lAryTotalMembers) {
                        let lNotificaionChannel = []
                        let notifyObj = await Notification.create({
                            'userId': i,
                            'focusGroupId': lArrFocusGroupId.focusGroupId._id,
                            notificationType: 'focusGroupNotification',
                            message: `${user.userName} has commented in hotspot.`,
                        })
                        let userChannel = await User.findOne({ _id: i }).select('channelName')
                        let anonymousChannel = await Anonymous.findOne({ _id: i }).select('channelName')
                        if (userChannel) {
                            lAryChannels.push(userChannel.channelName);
                        } else if (anonymousChannel) {
                            lAryChannels.push(anonymousChannel.channelName);
                        }

                        let Notify = await Notification.find({ _id: notifyObj._id })
                        pusherNotif.sendNotification(lAryChannels, Notify);
                    }
                    console.log(lAryChannels, 'hotspot channels')
                    pusherNotif.onScreenComment(lAryChannels, lUserDetails);
                    return Response.success(res, lUserDetails, "Hotspot Comment");
                }

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        /**
         * Delete the Hotspot (Soft delete only)
         */
        deleteHotspotcomment: async(req, res) => {
            try {
                let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET)

                let userDetails = await User.find({
                    _id: decoded._id,
                    email: decoded.email,
                    userName: decoded.userName,
                    lastLoggedIn: decoded.lastLoggedIn
                })
                let userId = decoded._id
                let lObjPostId = req.params.postId;
                let lObjHotspot;
                let output;

                if (userDetails.length > 0) {
                    lObjHotspot = await Hotspot.findOne({ _id: lObjPostId, userId: userId })
                    output = await Hotspot.findOneAndUpdate({
                        _id: lObjPostId,
                        userId: userId
                    }, {
                        $set: {
                            status: 0
                        }
                    }, {
                        new: true
                    });
                } else {
                    lObjHotspot = await Hotspot.findOne({ _id: lObjPostId, anonymousId: userId })
                    output = await Hotspot.findOneAndUpdate({
                        _id: lObjPostId,
                        anonymousId: userId
                    }, {
                        $set: {
                            status: 0
                        }
                    }, {
                        new: true
                    });
                }
                if (lObjHotspot === null) return Response.notAuthorized(res, "You're not authorized to perform this action")

                if (output !== null) return Response.success(res, 'Hotspot deleted succesfully');

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        /***
         * Update Hotspot (for reply)
         */
        updateHotspotComment: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    hotspotId: Joi.string().trim().required(),
                    parentId: Joi.string().trim().allow(''),
                    comment: Joi.string().trim(),
                    screenId: Joi.string().trim().required(),
                    dueDate: Joi.date().allow()
                        // actionId: Joi.string().trim()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lArrFocusGroupId = await fgScreen.findOne({ "screenId": req.body.screenId }).lean();

                if (lArrFocusGroupId == null) {
                    lArrFocusGroupId = await fgScreen.findOne({ "screenId": req.body.parentId }).lean();
                }

                let getFocusGroupDetails = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId })

                let lObjCheckOwnedGroup = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId._id, groupstatus: 2 })
                if (lObjCheckOwnedGroup) return Response.forbiddenError(res, "You can't comment on the Archived group!!")
                let lJoinedMembers = getFocusGroupDetails.joinedMembers;

                let lArrayJoinedMenebersId = lJoinedMembers.map(x => {
                    return x._id
                });

                let lInvitedMembers = getFocusGroupDetails.invitedMembers;
                let lProjectMembers = await projectTeam.find({ projectId: ObjectId(getFocusGroupDetails.projectId) }).select('projectTeamMember');
                lProjectMembers = lProjectMembers.map(v => {
                    return v.projectTeamMember;
                });
                lInvitedMembers = [].concat(lInvitedMembers, lProjectMembers)

                let listinviteMembers = [];

                for (let member of lInvitedMembers) {
                    let mem = await User.findOne({ email: member.email })
                    if (mem) {
                        listinviteMembers.push(mem._id)
                    }
                }

                let lAryTotalMembers = [...lArrayJoinedMenebersId, getFocusGroupDetails.createdUser._id, ...listinviteMembers].map(String)
                let commentRes;
                if (!getFocusGroupDetails.isPublic) {
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET)

                    let userDetails = await User.find({
                        _id: decoded._id,
                        email: decoded.email,
                        userName: decoded.userName,
                        lastLoggedIn: decoded.lastLoggedIn
                    })
                    userId = decoded._id

                    user = await decoded;
                    if (!userDetails) {
                        return Response.errorInternal('Access Denied, If you want to share your comment please login first!!!', res)
                    }

                    let emailResult = [];
                    await getFocusGroupDetails.invitedMembers.filter((u) => {
                        if (u.email == user.email) {
                            emailResult.push(u)
                        }
                    })

                    let lResult = lAryTotalMembers.includes(user._id.toString())
                    if (!lResult && emailResult.length == 0) return Response.forbiddenError(res, "Access Denied, If you want to share your comment please join this group first");

                    commentRes = {
                        comment: value.comment,
                        userId: user._id,
                        createdAt: new Date()
                    }
                } else {
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let accessToken = req.headers['x-access-token'];
                    let decord = await jwt.verify(accessToken, process.env.SUPER_SECRET);
                    user = await decord;
                    let checkUser = await User.find({ _id: user._id })
                    let date = new Date()
                    if (checkUser.length > 0) {
                        commentRes = {
                            comment: value.comment,
                            userId: user._id,
                            createdAt: `${date}`
                        }
                    } else {
                        commentRes = {
                            comment: value.comment,
                            anonymousId: user._id,
                            createdAt: `${date}`
                        }
                    }

                }
                console.log(commentRes, 'comments')
                let lObjHotspotComment = await Hotspot.findOneAndUpdate({ _id: req.body.hotspotId }, {
                    $push: { commentRes: commentRes },
                    //  actionTypeId: req.body.actionId 
                })

                let lUserDetails = await commonHospotResponse(req, res, lObjHotspotComment);

                lUserDetails = lUserDetails ? lUserDetails[0] : {};
                if (lUserDetails && lUserDetails.commentRes) {
                    for (let comment of lUserDetails.commentRes) {
                        if (comment.anonymousId._id) {
                            delete comment.userId
                        } else if (comment.userId._id) {
                            delete comment.anonymousId
                        }
                    }
                    if (lUserDetails.userId._id) {
                        delete lUserDetails.anonymousId
                    } else if (lUserDetails.anonymousId._id) {
                        delete lUserDetails.userId
                    }
                }

                lAryTotalMembers = await lAryTotalMembers.map(x => {
                    if (x !== user._id.toString()) return x;
                })
                lAryTotalMembers = _.compact(lAryTotalMembers)

                let anonymous = getFocusGroupDetails.anonymousId;
                anonymous = Array.isArray(anonymous) ? anonymous : [anonymous]
                let anonymousIds = []
                await anonymous.map(x => {
                    anonymousIds.push(x._id)
                })

                lAryTotalMembers = [...lAryTotalMembers, ...anonymousIds]
                let lAryChannels = [];
                for (let i of lAryTotalMembers) {
                    let lObjNoti = await Notification.create({
                        'userId': i,
                        'focusGroupId': lArrFocusGroupId.focusGroupId._id,
                        notificationType: 'onScreenComment',
                        message: `${user.userName} has commented in hotspot.`
                    })
                    let channel = await User.findOne({ _id: i })
                    let anonymousChannel = await Anonymous.findOne({ _id: i })
                    if (channel) {
                        lAryChannels.push(channel.channelName);
                    } else if (anonymousChannel) {
                        lAryChannels.push(anonymousChannel.channelName);
                    }

                    let lObjMsg = []
                    lObjMsg.push(await Notification.find({ _id: lObjNoti._id }))
                    pusherNotif.onScreenComment(lAryChannels, lObjMsg);
                }
                console.log(lAryChannels, 'channels')
                return Response.success(res, lUserDetails, 'Hotspot Updated Successfully');
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        updateDuedate: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().required(),
                    hotspotId: Joi.string().trim().required(),
                    parentId: Joi.string().trim().allow(''),
                    dueDate: Joi.date().allow('')
                        // actionId: Joi.string().trim()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let user;

                let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET);
                user = await decoded;

                let lArrHotspotId = await Hotspot.findOne({ _id: req.body.hotspotId }).lean();
                let getFocusGroupDetails = await FocusGroup.findOne({ _id: lArrHotspotId.focusgroupId }).lean();
                let lProjectMembers = await projectTeam.findOne({ projectId: ObjectId(getFocusGroupDetails.projectId), "projectTeamMember.userId": user._id });
                let lArrFocusGroupId = await fgScreen.findOne({ "screenId": req.body.screenId }).lean();

                if (!lProjectMembers) {
                    return Response.forbiddenError(res, "You don't have access to update the due date!!")
                }

                lProjectMembers = await projectTeam.find({ projectId: ObjectId(getFocusGroupDetails.projectId) }).select('projectTeamMember');

                lProjectMembers = lProjectMembers.map(v => {
                    return v.projectTeamMember;
                });

                let lObjHotspotComment = await Hotspot.findOneAndUpdate({ _id: req.body.hotspotId }, { dueDate: req.body.dueDate });

                lProjectMembers = [...lProjectMembers].map(String);
                let lUserDetails = await commonHospotResponse(req, res, lObjHotspotComment);
                lUserDetails = lUserDetails[0];

                // Noticication part.
                lProjectMembers = lProjectMembers.map(x => {
                    if (x !== user._id.toString()) return x;
                })

                lProjectMembers = _.compact(lProjectMembers);
                let lAryChannels = [];
                for (let i of lProjectMembers) {
                    let lObjNoti = await Notification.create({
                        'userId': i.userId,
                        'focusGroupId': lArrFocusGroupId.focusGroupId._id,
                        notificationType: 'onScreenComment',
                        message: `${user.userName} has updated due date for an issue in ${getFocusGroupDetails.groupName}.`
                    })
                    let channel = await User.findOne({ _id: i.userId });
                    if (channel) {
                        lAryChannels.push(channel.channelName);
                    };
                    let lObjMsg = []
                    lObjMsg.push(await Notification.find({ _id: lObjNoti._id }));
                    pusherNotif.onScreenComment(lAryChannels, lObjMsg);
                }
                console.log(lAryChannels, 'hotspot channels due date')
                return Response.success(res, lUserDetails, 'Hotspot due date Updated Successfully');

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        changePositionOfHotspot: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    hotspotId: Joi.string().trim().required(),
                    top: Joi.string().trim(),
                    left: Joi.string().trim()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET)
                let userId = decoded._id

                let lUserCheck = await Hotspot.findById({ _id: req.body.hotspotId }).select('userId').select('anonymousId')

                if (userId == lUserCheck.userId) {
                    let lObjHotspotComment = await Hotspot.findOneAndUpdate({ _id: req.body.hotspotId }, {
                        $set: {
                            position: {
                                top: req.body.top,
                                left: req.body.left
                            }
                        }
                    }, {
                        new: true
                    });

                    return Response.success(res, lObjHotspotComment, 'Hotspot Position Updated Successfully');
                } else if (userId == lUserCheck.anonymousId) {
                    let lObjHotspotComment = await Hotspot.findOneAndUpdate({ _id: req.body.hotspotId }, {
                        $set: {
                            position: {
                                top: req.body.top,
                                left: req.body.left
                            }
                        }
                    }, {
                        new: true
                    });

                    return Response.success(res, lObjHotspotComment, 'Hotspot Position Updated Successfully');
                } else return Response.forbiddenError(res, "Access Denied, You can't change the position !!");
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        /**
         * Consolidated mail after threshold for hotspots
         */

        listOfOnScreenComments: async(req, res) => {
            try {
                let hotspots = await Hotspot.aggregate([
                    { $match: { mailSent: 0 } },
                    { $sort: { 'createdAt': -1 } },
                    {
                        $group: {
                            _id: '$screenId',
                            comment: {
                                $push: {
                                    comment: '$comment',
                                    userId: '$userId',
                                    commentId: '$_id'
                                }
                            },
                            mailSent: { $first: "$mailSent" }
                        }
                    },
                    {
                        $lookup: {
                            from: 'screens',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'Screens'
                        }
                    },
                    { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'Screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: '$_id',
                            comment: { $first: "$comment" },
                            mailSent: { $first: "$mailSent" },
                            screenName: { $first: "$Screens.screenName" },
                            focusGroupId: { $first: "$Screens.focusGroupId" }
                        }
                    },
                    {
                        $lookup: {
                            from: 'focusgroups',
                            localField: 'focusGroupId',
                            foreignField: '_id',
                            as: 'FocusGroups'
                        }
                    },
                    { $unwind: { path: '$FocusGroups', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$_id',
                            comment: { $first: "$comment" },
                            mailSent: { $first: "$mailSent" },
                            // screenName: { $last: "$Screens.screenName" },
                            focusGroupDetail: {
                                $first: {
                                    focusGroupId: "$FocusGroups._id",
                                    projectId: "$FocusGroups.projectId",
                                    focusGroupName: "$FocusGroups.groupName",
                                    invitedMembers: "$FocusGroups.invitedMembers",
                                    joinedMembers: "$FocusGroups.joinedMembers",
                                    anonymousId: "$FocusGroups.anonymousId"
                                }

                            }

                        }
                    },
                ])
                let userData = {};
                hotspots.forEach(element => {
                    let data = element.focusGroupDetail;
                    let emailDatas = [].concat(data.invitedMembers, data.joinedMembers);
                    userData.groupName = element.focusGroupDetail.focusGroupName;
                    userData.commentCount = element.comment.length;
                    userData.emails = emailDatas;
                    if ((userData.commentCount) > 5) {
                        mailer.focusGroupOnScreenEmail(userData);
                        element.comment.map(async(v) => {
                            await Hotspot.findOneAndUpdate({ _id: v.commentId }, { mailSent: 1 })
                        })
                    }
                })



                return Response.success(res, hotspots, "chat list");
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        // Add ACtion
        listAllActionType: async(req, res) => {
            try {
                let lAryActionsType = await Action.find().lean()
                return Response.success(res, lAryActionsType, 'Action Type');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        listAllFlagType: async(req, res) => {
            try {
                let lAryFlagType = await Items.find().lean().select('name')
                return Response.success(res, lAryFlagType, 'Flagged Items');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },


        flagComment: async(req, res) => {
            try {

                let hostspotId = req.query.hotspotId;
                let flag = req.query.flagId;
                let type = req.query.type;
                let status = req.query.flagStatus

                let lAryFlagComment = await Hotspot.findOne({ _id: hostspotId, status: 1 });
                if (type == 'flagged') {

                    lAryFlagComment.flagId = flag;
                    lAryFlagComment.flagStatus = true;
                    lAryFlagComment.save();

                    let screenId = await Hotspot.findOne({ _id: hostspotId, status: 1 })
                        .populate('focusgroupId', 'groupName');
                    let screenName = await Screen.findOne({ _id: screenId.screenId, screenStatus: 1 }).select('screenName');
                    if (screenName == null) {
                        screenName = await ScreenVersion.findOne({ _id: screenId.screenId, screenStatus: 1 }).select('screenName');
                    }
                    let action = await Items.findOne({ _id: flag }).select('name')
                    let projectID = await FocusGroup.findOne({ _id: screenId.focusgroupId._id, groupstatus: 1 }).select('projectId')

                    let createActivity = await Activity.create({
                        projectId: projectID.projectId,
                        userId: req.user._id,
                        type: 'activity',
                        focusGroupId: screenId.focusgroupId._id,
                        message: `flagged the comment as '${action.name}' in '${screenId.focusgroupId.groupName}' gocusgroup`
                    })
                    let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${projectID.projectId}`, activity)

                    return Response.success(res, lAryFlagComment, 'Flag Comment');

                } else {

                    lAryFlagComment.flagId = null;
                    lAryFlagComment.flagStatus = false;
                    lAryFlagComment.save();

                    let screenId = await Hotspot.findOne({ _id: hostspotId, status: 1 })
                        .populate('focusgroupId', 'groupName');
                    let screenName = await Screen.findOne({ _id: screenId.screenId, screenStatus: 1 }).select('screenName');
                    if (screenName == null) {
                        screenName = await ScreenVersion.findOne({ _id: screenId.screenId, screenStatus: 1 }).select('screenName');
                    }
                    let action = await Items.findOne({ _id: flag }).select('name')
                    let projectID = await FocusGroup.findOne({ _id: screenId.focusgroupId._id, groupstatus: 1 }).select('projectId')

                    let createActivity = await Activity.create({
                        projectId: projectID.projectId,
                        userId: req.user._id,
                        type: 'activity',
                        focusGroupId: screenId.focusgroupId._id,
                        message: `deflagged the comment in '${screenId.focusgroupId.groupName}' gocusgroup`
                    })
                    let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${projectID.projectId}`, activity)

                    return Response.success(res, lAryFlagComment, 'Deflag Comment');

                }


            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        updateHostspotAction: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    hotspotId: Joi.string().trim().required(),
                    actionId: Joi.string().trim().required()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjHotspotComment = await Hotspot.findOneAndUpdate({ _id: req.body.hotspotId }, { actionId: req.body.actionId })

                let lUserDetails = await commonHospotResponse(req, res, lObjHotspotComment);

                let screenId = await Hotspot.findOne({ _id: req.body.hotspotId, status: 1 })
                    .populate('focusgroupId', 'groupName');
                let screenName = await Screen.findOne({ _id: screenId.screenId, screenStatus: 1 }).select('screenName');
                if (screenName == null) {
                    screenName = await ScreenVersion.findOne({ _id: screenId.screenId, screenStatus: 1 }).select('screenName');
                }
                let action = await Action.findOne({ _id: req.body.actionId }).select('name')
                let projectID = await FocusGroup.findOne({ _id: screenId.focusgroupId._id, groupstatus: 1 }).select('projectId')

                let createActivity = await Activity.create({
                    projectId: projectID.projectId,
                    userId: req.user._id,
                    type: 'activity',
                    focusGroupId: screenId.focusgroupId._id,
                    message: `changed the status to '${action.name}' for ${screenName.screenName} in '${screenId.focusgroupId.groupName}' gocusgroup`
                })
                let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                pusherNotif.activitySocket(`ch-${projectID.projectId}`, activity)

                return Response.success(res, lUserDetails, 'Hotspot Action Updated Successfully');


            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        assignHotspot: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    hotspotId: Joi.string().trim().required(),
                    assign: Joi.string().trim().required(),
                    projectId: Joi.string().trim().required(),
                    focusgroupId: Joi.string().trim().required(),
                    userName: Joi.string().allow('')
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjHotspotComment = await Hotspot.findOne({ _id: req.body.hotspotId, status: 1 });



                let isAlreadyAssigned = await Ticket.findOne({ hotspotId: req.body.hotspotId, status: 1 }).sort({ createdAt: -1 });

                if (isAlreadyAssigned != null) {

                    let obj = {
                        hotspotId: lObjHotspotComment._id,
                        raisedUser: lObjHotspotComment.userId,
                        assignedUser: req.body.assign,
                        assignedBy: req.user._id
                    }

                    if (isAlreadyAssigned.assignedUser.toString() !== obj.assignedUser.toString()) {

                        await Ticket.findOneAndUpdate({ _id: isAlreadyAssigned._id }, {
                            $set: {
                                status: 0
                            }
                        })

                        let assign = await Ticket.create(obj);

                        let assignUser = await Ticket.findOne({ _id: assign._id, status: 1 }).populate('assignedUser', 'firstName lastName email profilePicture');

                        let fgDetail = await FocusGroup.findOne({ _id: req.body.focusgroupId, groupstatus: 1 }).select('groupName')

                        let createActivity = await Activity.create({
                            projectId: req.body.projectId,
                            userId: req.user._id,
                            type: 'activity',
                            focusGroupId: req.body.focusgroupId,
                            message: `reassigned the issue to '${req.body.userName}' in ${fgDetail.groupName} focusgroup`
                        })
                        let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                        pusherNotif.activitySocket(`ch-${req.body.projectId}`, activity)

                        return Response.success(res, assignUser, 'User assigned successfully');
                    } else {
                        return Response.successInvalid(res, 'You can not assign to same user');
                    }

                } else {

                    let obj = {
                        hotspotId: lObjHotspotComment._id,
                        raisedUser: lObjHotspotComment.userId,
                        assignedUser: req.body.assign,
                        assignedBy: req.user._id
                    }

                    let assign = await Ticket.create(obj);

                    let assignUser = await Ticket.findOne({ _id: assign._id, status: 1 }).populate('assignedUser', 'firstName lastName email profilePicture');

                    let fgDetail = await FocusGroup.findOne({ _id: req.body.focusgroupId, groupstatus: 1 }).select('groupName')

                    let createActivity = await Activity.create({
                        projectId: req.body.projectId,
                        userId: req.user._id,
                        type: 'activity',
                        focusGroupId: req.body.focusgroupId,
                        message: `assigned the issue to '${req.body.userName}' in ${fgDetail.groupName} focusgroup`
                    })
                    let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${req.body.projectId}`, activity)

                    return Response.success(res, assignUser, 'User assigned successfully');

                }

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        searchUser: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    projectId: Joi.string().trim().required(),
                    focusgroupId: Joi.string().trim().required(),
                    userName: Joi.string().trim().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let userName = req.query.userName;
                let projectId = req.query.projectId;
                let focusgroupId = req.query.focusgroupId;

                //console.log("queryParam", queryParam, req.user._id);


                if (!!userName) {
                    console.log("if condition");

                    let listUsers = await projectTeam.aggregate([
                        { $match: { "projectTeamMember.firstName": { $regex: userName, "$options": "i" } } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'projectTeamMember.email',
                                foreignField: 'email',
                                as: 'teamUser'
                            }
                        },
                        { $unwind: { path: '$teamUser', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: { "projectId": ObjectId(projectId) }
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                "teamUser": {
                                    $addToSet: {
                                        _id: "$teamUser._id",
                                        firstName: "$teamUser.firstName",
                                        lastName: "$teamUser.lastName",
                                        email: "$teamUser.email",
                                        userId: "$teamUser._id",
                                        profilePicture: "$teamUser.profilePicture"
                                    }
                                }
                            }

                        }
                    ]);

                    let fgUsers = await FocusGroup.aggregate([
                        { $match: { "projectId": ObjectId(projectId), "_id": ObjectId(focusgroupId) } },
                        { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: { "invitedMembers.email": { $regex: userName, "$options": "i" } }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'invitedMembers.email',
                                foreignField: 'email',
                                as: 'teamUser'
                            }
                        },
                        { $unwind: { path: '$teamUser', 'preserveNullAndEmptyArrays': true } },

                        {
                            $group: {
                                _id: "$projectId",
                                "fgUser": {
                                    $addToSet: {
                                        _id: "$teamUser._id",
                                        firstName: "$teamUser.firstName",
                                        lastName: "$teamUser.lastName",
                                        email: "$teamUser.email",
                                        userId: "$teamUser._id",
                                        profilePicture: "$teamUser.profilePicture"
                                    }
                                }
                            }

                        }
                    ]);

                    listUsers = listUsers[0];

                    if (fgUsers.length > 0 && fgUsers.hasOwnProperty('fgUser')) {
                        fgUsers = fgUsers[0]
                        listUsers = listUsers.teamUser.concat(fgUsers.fgUser)
                    } else {
                        listUsers = listUsers.teamUser
                    }

                    return Response.success(res, listUsers)
                } else {
                    console.log("if condition");

                    let listUsers = await projectTeam.aggregate([{
                            $lookup: {
                                from: 'users',
                                localField: 'projectTeamMember.email',
                                foreignField: 'email',
                                as: 'teamUser'
                            }
                        },
                        { $unwind: { path: '$teamUser', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: { "projectId": ObjectId(projectId) }
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                "teamUser": {
                                    $addToSet: {
                                        _id: "$teamUser._id",
                                        firstName: "$teamUser.firstName",
                                        lastName: "$teamUser.lastName",
                                        email: "$teamUser.email",
                                        userId: "$teamUser._id",
                                        profilePicture: "$teamUser.profilePicture"
                                    }
                                }
                            }

                        }
                    ]);

                    let fgUsers = await FocusGroup.aggregate([
                        { $match: { "projectId": ObjectId(projectId), "_id": ObjectId(focusgroupId) } },
                        { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: { "invitedMembers.email": { $regex: userName, "$options": "i" } }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'invitedMembers.email',
                                foreignField: 'email',
                                as: 'teamUser'
                            }
                        },
                        { $unwind: { path: '$teamUser', 'preserveNullAndEmptyArrays': true } },

                        {
                            $group: {
                                _id: "$projectId",
                                "fgUser": {
                                    $addToSet: {
                                        _id: "$teamUser._id",
                                        firstName: "$teamUser.firstName",
                                        lastName: "$teamUser.lastName",
                                        email: "$teamUser.email",
                                        userId: "$teamUser._id",
                                        profilePicture: "$teamUser.profilePicture"
                                    }
                                }
                            }

                        }
                    ]);

                    listUsers = listUsers[0];

                    if (fgUsers.length > 0 && fgUsers.hasOwnProperty('fgUser')) {
                        fgUsers = fgUsers[0]
                        listUsers = listUsers.teamUser.concat(fgUsers.fgUser)
                    } else {
                        listUsers = listUsers.teamUser
                    }

                    return Response.success(res, listUsers)
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },


        dueDateNotification: async(req, res) => {
            try {
                let currentDate = moment().utc().format('');
                let hotspotList = await Action.aggregate([
                    { $match: { "name": "Issue" } },
                    { $lookup: { from: 'hotspots', localField: '_id', foreignField: 'actionId', as: 'hotspots' } },
                    { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                    { $match: { "hotspots.status": 1, "hotspots.dueDate": { $gte: new Date(currentDate) } } },
                    { $lookup: { from: 'ticketassigns', localField: 'hotspots._id', foreignField: 'hotspotId', as: 'assignedUsers' } },
                    { $unwind: { path: '$assignedUsers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "hotspots.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    {
                        $lookup: {
                            from: 'screens',
                            localField: 'hotspots.screenId',
                            foreignField: '_id',
                            as: 'Screens'
                        }
                    },
                    { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'Screens.screenStatus': 1 } },
                ]);

                let lAryTotalMembers = [];

                for (let x of hotspotList) {
                    if (x.hasOwnProperty('assignedUsers')) {
                        let data = lAryTotalMembers.some((item) => item._id.toString() === x.assignedUsers.assignedUser.toString() && item.fgId.toString() === x.Focusgroup._id.toString() && item.screenId.toString() === x.Screens._id.toString())
                        if (data === false) {
                            lAryTotalMembers.push({
                                _id: x.assignedUsers.assignedUser,
                                fgId: x.Focusgroup._id,
                                fgName: x.Focusgroup.groupName,
                                screenName: x.Screens.screenName,
                                screenId: x.Screens._id
                            })
                        }
                    } else {
                        for (let y of x.teamMember) {
                            let data = lAryTotalMembers.some((item) => item._id.toString() === y.projectTeamMember.userId.toString() && item.fgId.toString() === x.Focusgroup._id.toString() && item.screenId.toString() === x.Screens._id.toString())
                            if (data === false) {
                                lAryTotalMembers.push({
                                    _id: y.projectTeamMember.userId,
                                    fgId: x.Focusgroup._id,
                                    fgName: x.Focusgroup.groupName,
                                    screenName: x.Screens.screenName,
                                    screenId: x.Screens._id
                                })
                            }
                        }
                    }
                };

                for (let i of lAryTotalMembers) {
                    let lAryChannels = [];
                    let notifyObj = await Notification.create({
                        'userId': i._id,
                        'focusGroupId': i.fgId,
                        notificationType: 'focusGroupNotification',
                        message: `Your deadline for an issue in ${i.fgName} is tomorrow.`,
                    });

                    let userChannel = await User.findOne({ _id: i._id }).select('channelName')

                    if (userChannel) {
                        lAryChannels.push(userChannel.channelName);
                    }
                    let Notify = await Notification.find({ _id: notifyObj._id })
                    pusherNotif.sendNotification(lAryChannels, Notify);
                }

                return Response.success(res, lAryTotalMembers, 'Notification duedate successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = hotspotComponentCtrl()