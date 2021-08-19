require("dotenv").config();

const Joi = require('joi');
const Response = require('../../utils/response');
const verify = require('../../utils/authenticate')
const FocusGroup = require('../focusGroup/focusGroup.model');
const User = require('../user/user.model');
const Unread = require('../chat/unreadchat.model');
const Project = require('../project/project.model');
const UserBadge = require('../../utils/userBadge');
const UserInvite = require('../userInvited/userInvite.model');
const Screens = require('../screens/screens.model');
const TeamUsers = require('../teamUsers/teamUsers.model');
const TeamUserPayment = require('../teamUserPayment/teamUserPayments.model');
const Hotspot = require('../hotspot/hotspot.model');
const Ticket = require('../hotspot/ticketAssign.model');
const mailer = require('../../utils/mailService');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const _ = require('lodash');
const Notification = require('../notification/notification.model');
const pusherNotif = require('../../utils/pusher')
const activityFeed = require('../activityfeed/activityfeed.model')
const verifyToken = require('../../utils/authenticate')
const crypto = require('crypto-random-string');
const Anonymous = require('../anonymous/anonymous.model');
let Activity = require('../activityfeed/activityfeed.model')
const ProjectTeamMember = require('../project/projectTeamMember.model');
const FGScreen = require('../focusGroup/fgProjectScreen.model');
const ProjectScreen = require('../project/projectScreen.model');
let moment = require('moment')
let gIntDataPerPage = 10;

const sanitize = data => {
    //remove sensitive data
    for (let v of data.invitedMembers) {
        delete v.invitationToken;
    }
    data.__v = data.updatedAt = undefined;
    return data;
};


function focusGroupComponentCtrl() {
    const methods = {
        /**
         * Create Focus Group
         */
        createNewFocusGroup: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    groupName: Joi.string().trim().required(),
                    description: Joi.string().trim().allow(''),
                    invitedMembers: Joi.array(),
                    // projectId: Joi.string().required(),
                    type: Joi.string().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                value.createdUser = req.user._id; //Created User
                value.invitedMembers = [];
                if (req.body.invitedMembers) {
                    for (let v of req.body.invitedMembers) {
                        //Verification Token
                        let expiry = '30 days'; //Expires in 30 day

                        const tokenData = { 'email': v, 'groupName': value.groupName };

                        var token = await jwt.sign(tokenData, process.env.SUPER_SECRET, {
                            expiresIn: expiry
                        });
                        value.invitedMembers.push({
                            email: v,
                            invitationToken: token
                        })
                    }
                }

                let lObjCheckUserGroupName = await FocusGroup.find({

                    $and: [{
                        createdUser: req.user._id,
                        groupName: req.body.groupName
                    }]

                })

                if (lObjCheckUserGroupName.length > 0) {
                    return Response.badValues(res, `Another focus group under the name ${req.body.groupName} already exists`);
                }
                await UserBadge.focusGroupPrticipated(req.user._id);
                let lObjFocusGroup = await FocusGroup.create(value)

                //Invitation Email
                if ((lObjFocusGroup.inviteMembers.length) > 0) {
                    for (let v of lObjFocusGroup.invitedMembers) {
                        console.log(lObjFocusGroup.groupName)
                        let mailData = {
                            userName: req.user.userName,
                            email: v.email,
                            groupName: lObjFocusGroup.groupName,
                            link: `${process.env.BASE_URL}focusgroup/${lObjFocusGroup._id}?token=${v.invitationToken}`
                        }
                        mailer.invitationEmail(mailData)
                    }
                }

                //activity Feed Notification


                let notifyObj = await Notification.create({
                    'userId': req.user._id,
                    'focusGroupId': lObjFocusGroup._id,
                    notificationType: 'newFG',
                    message: `Your New Focus Group ${lObjFocusGroup.groupName} is ready.`
                })

                // console.log(notifyObj, "OBJECT")

                // let Notify = await Notification.find({ _id: notifyObj._id })
                // pusherNotif.sendNotification(lNotificaionChannel, Notify);

                return Response.success(res, lObjFocusGroup, `Your focus group ${lObjFocusGroup.groupName} has been created`);
                // }
                // } else {
                //   return Response.forbiddenError(res, 'You cannot create any more focus groups!!');
                // }
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Edit Focus Group
         * Params:(groupId)
         * Input : Modified Data
         */
        editFocusGroup: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    groupName: Joi.string().trim(),
                    description: Joi.string().trim().allow(''),
                    invitedMembers: Joi.array(),
                    type: Joi.string(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                //Group Id
                let lObjGroupId = req.params.groupId;
                let lObjUpdatedFocusGroup = await FocusGroup.findOneAndUpdate({
                    _id: lObjGroupId
                }, {
                    $set: value
                }, {
                    new: true
                });
                lObjUpdatedFocusGroup = sanitize(lObjUpdatedFocusGroup)
                return Response.success(res, lObjUpdatedFocusGroup, 'Focus Group updated succesfully');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * List all focus group(Includes user created groups and joined groups)
         * Input:(header token)
         */
        ListAllFocusGroup: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 15 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit);
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }
                console.log('pagelimit ', pageLimit)

                let lAryQueryCondition
                if (req.query.type == 'all') {
                    lAryQueryCondition = {
                        $or: [
                            { "joinedMembers": ObjectId(req.user._id) },
                            { "invitedMembers.email": req.user.email },
                            { "createdUser": ObjectId(req.user._id) },
                        ]
                    };
                } else if (req.query.type == 'own' && req.query.projectId != undefined) {

                    let isUserExistsInProjectTeamMembers = await ProjectTeamMember.exists({
                        projectId: req.query.projectId,
                        'projectTeamMember.userId': req.user._id
                    });

                    console.log(isUserExistsInProjectTeamMembers)

                    if (isUserExistsInProjectTeamMembers == true) {
                        lAryQueryCondition = {
                            "projectId": ObjectId(req.query.projectId)
                        }
                    }

                } else if (req.query.type == 'own') {
                    lAryQueryCondition = {
                        $or: [
                            { "createdUser": ObjectId(req.user._id) }
                        ]
                    }
                } else if (req.query.type = "invite") {
                    lAryQueryCondition = {
                        $or: [
                            { "invitedMembers.email": req.user.email }
                        ]
                    };
                } else {
                    lAryQueryCondition = {
                        $and: [
                            { "createdUser": ObjectId(req.query.type) },
                            {
                                $or: [{ "invitedMembers.email": req.user.email },
                                    { "joinedMembers": ObjectId(req.user._id) }
                                ]
                            }
                        ]
                    };
                }

                let queryParam = ''
                if (req.query.query) {
                    queryParam = req.query.query
                }
                var status = 1
                if (req.query.status) {
                    status = parseInt(req.query.status)
                }
                let lIntNoOfGroups = await FocusGroup.count({
                    $and: [
                        lAryQueryCondition,
                        {
                            groupstatus: { $eq: status }
                        }
                    ]
                })
                if (req.query.sort == "asc") {
                    var dateParam = { createdAt: 1 }
                } else {
                    var dateParam = { createdAt: -1 }
                }

                //FocusGroup
                console.log(lAryQueryCondition)
                let lAryFocusGroup = await FocusGroup.aggregate([{
                        $match: {
                            $and: [
                                lAryQueryCondition
                            ]
                        }
                    },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $graphLookup: {
                            from: "users",
                            startWith: "$invitedMembers.email",
                            connectFromField: "invitedMembers.email",
                            connectToField: "email",
                            as: "invitedMemberDetails"
                        }
                    },
                    { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'projectId' } },
                    { $unwind: '$projectId' },
                    { $lookup: { from: 'fg_project_screens', localField: '_id', foreignField: 'focusGroupId', as: 'fgProjectScreens' } },
                    { $unwind: { path: '$fgProjectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'project_screens', localField: 'fgProjectScreens.projectScreenId', foreignField: '_id', as: 'projectScreens' } },
                    { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'screens', localField: 'projectScreens.screenId', foreignField: '_id', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "joinedMembers": {
                                "$addToSet": {
                                    '_id': '$joinedMembers._id',
                                    'userName': '$joinedMembers.userName',
                                    'firstName': '$joinedMembers.firstName',
                                    'lastName': '$joinedMembers.lastName',
                                    'email': '$joinedMembers.email',
                                    "profilePicture": { $ifNull: ["", { $concat: [`${process.env.AWS_URL}profilePicture/`, "$joinedMembers.profilePicture"] }] }
                                }
                            },
                            "invitedMembers": {
                                "$addToSet": {
                                    $cond: {
                                        if: { $ne: ["$invitedMembers", null] },
                                        then: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                            userName: "$invitedMemberDetails.userName",
                                            userId: "$invitedMemberDetails._id",
                                            firstName: "$invitedMemberDetails.firstName",
                                            lastName: "$invitedMemberDetails.lastName",
                                            invitedBy: '$invitedMembers.invitedBy',
                                            "profilePicture": { $ifNull: ["", { $concat: [`${process.env.AWS_URL}profilePicture/`, "$invitedMemberDetails.profilePicture"] }] }
                                        },
                                        else: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                        },
                                    }
                                }
                            },
                            "projectId": { $first: "$projectId" },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: "$createdUser" },
                            "createdAt": { $first: "$createdAt" },
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
                                    "description": "$fgProjectScreens.description",
                                    "sequence": "$fgProjectScreens.sequence",
                                    "screenVersionId": "$screens.screenVersionId",
                                    "projectScreenId": "$projectScreens._id"
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            joinedMembers: 1,
                            _id: 1,
                            invitedMembers: 1,
                            groupName: 1,
                            projectId: 1,
                            groupstatus: 1,
                            description: 1,
                            createdUser: {
                                '_id': '$createdUser._id',
                                'userName': '$createdUser.userName',
                                'firstName': '$createdUser.firstName',
                                'lastName': '$createdUser.lastName',
                                'email': '$createdUser.email',
                                "profilePicture": { $ifNull: ["", { $concat: [`${process.env.AWS_URL}profilePicture/`, "$createdUser.profilePicture"] }] }
                            },
                            isHost: {
                                $cond: { if: { $eq: ["$createdUser", ObjectId(req.user._id)] }, then: true, else: false }
                            },
                            createdAt: 1,
                            screensCount: { $size: "$screens" },
                            screens: {
                                $filter: {
                                    input: "$screens",
                                    as: "screen",
                                    cond: { $gte: ["$$screen.screenStatus", 1] }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            joinedMembers: 1,
                            _id: 1,
                            invitedMembers: 1,
                            groupName: 1,
                            groupstatus: 1,
                            projectId: 1,
                            description: 1,
                            createdUser: 1,
                            isHost: 1,
                            createdAt: 1,
                            screensCount: { $size: "$screens" },
                            screens: 1
                        }
                    },
                    { $match: { "groupName": { $regex: queryParam, "$options": "i" } } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'screenversions', localField: 'screens._id', foreignField: 'parentId', as: 'versions' } },
                    // { $lookup: { from: 'unreadchats', localField: '_id', foreignField: 'focusgroupId', as: 'unreadChats' } },
                    // { $unwind: { path: '$unreadChats', 'preserveNullAndEmptyArrays': true } },
                    // {
                    //     $match: {
                    //         "unreadChats.userId": req.user._id
                    //     }
                    // },
                    {
                        $group: {
                            _id: "$_id",
                            "joinedMembers": { $first: "$joinedMembers" },
                            "invitedMembers": { $first: "$invitedMembers" },
                            "groupName": { $first: "$groupName" },
                            "project": { $first: "$projectId" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: "$createdUser" },
                            "createdAt": { $first: "$createdAt" },
                            screensCount: { $first: "$screensCount" },
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
                                    versions: '$versions',
                                    projectScreenId: '$screens.projectScreenId'
                                }
                            },
                            unreadCount: { $first: "$unreadChats.count" }
                        }
                    },
                    {
                        $addFields: {
                            screens: { $slice: ["$screens", 3] }
                        }
                    },
                    { $match: { groupstatus: { $eq: status } } },
                    { $sort: dateParam },
                    { $skip: skipRec },
                    { $limit: pageLimit }
                ])

                for (let lObjRes of lAryFocusGroup) {
                    let unreadCount = await Unread.findOne({ focusgroupId: lObjRes._id, userId: req.user._id });
                    if (unreadCount == null) {
                        lObjRes.unreadCount = 0
                    } else {
                        lObjRes.unreadCount = unreadCount.count;
                    }
                    for (let x of lObjRes.screens) {
                        x.versions = x.versions.slice(1);
                        for (let version of x.versions) {
                            if (version != null || version != undefined) {
                                let result;
                                if (version.inspire != null || version.inspire != undefined) {
                                    result = version.inspire;
                                } else {
                                    result = false;
                                }

                                let url;
                                if (result == false) {
                                    url = process.env.AWS_URL + version.image;
                                    version.image = url;
                                } else {
                                    url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + version.image;
                                    version.image = url;
                                }
                            }
                        }
                    }
                }



                if (req.query.type = "invite") {
                    for (let focus of lAryFocusGroup) {
                        for (let invite of focus.invitedMembers) {
                            if (invite.email == req.user.email) {
                                if (invite.invitedBy) {
                                    let inviteUser = await User.findOne({ _id: invite.invitedBy });
                                    focus["invitedBy"] = {
                                        _id: inviteUser._id,
                                        userName: inviteUser.userName,
                                        firstName: inviteUser.firstName,
                                        lastName: inviteUser.lastName,
                                        email: inviteUser.email
                                    }
                                } else {
                                    focus["invitedBy"] = focus.createdUser
                                }
                            }
                        }
                    }
                }

                lAryFocusGroup = lAryFocusGroup.map(x => {
                    x.joinedMembers = (x.joinedMembers.length === 1 && !x.joinedMembers[0]._id) ? [] : x.joinedMembers;
                    return x;
                })
                for (let lObjRes of lAryFocusGroup) {
                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.filter(lObjRes.screens, function(v) {
                            return v.image;
                        });

                    }
                }

                for (let user of lAryFocusGroup) {
                    let createdUser = [];
                    createdUser.push(user.createdUser);
                    user["members"] = await [...createdUser, ...user.invitedMembers, ...user.joinedMembers]
                }
                let archiveCount = await FocusGroup.count({
                    $and: [
                        lAryQueryCondition,
                        {
                            groupstatus: { $eq: 2 }
                        }
                    ]
                })
                let activeCount = await FocusGroup.count({
                    $and: [
                        lAryQueryCondition,
                        {
                            groupstatus: { $eq: 1 }
                        }
                    ]
                })

                let lObjFocsuGroup = {
                    focsuGroup: lAryFocusGroup,
                    total: Math.ceil(lIntNoOfGroups / (limit ? limit : gIntDataPerPage)),
                    archiveCount: archiveCount,
                    activeCount: activeCount,
                    per_page: limit ? limit : gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, lObjFocsuGroup, 'List of all focus groups');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Check the user is already registered or not
         */
        checkTheUserExistOrNot: async(req, res, next) => {
            try {
                let lObjCheckUserExist = await User.findOne({ email: req.query.email }).lean()
                if (lObjCheckUserExist !== null) next();
                if (lObjCheckUserExist === null) return Response.success(res, {}, 'You are not DoodleFlow User, Please signup first to continue this process')
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        /**
         * Sugandhi Accept the invitation and Join the group
         */
        jointheGroup: async(req, res) => {
            try {
                let token = req.body.token;
                if (token) {
                    let lObjCheckCurrentUser = await FocusGroup.findOne({
                        _id: req.body.groupId,
                        groupstatus: { $ne: 0 },
                        createdUser: req.user._id
                    }).lean()
                    if (lObjCheckCurrentUser !== null) return Response.success(res, "No Active Focus group");
                    let lObjCheckUserInvitedOrNot = await FocusGroup.findOne({
                        _id: req.body.groupId,
                        groupstatus: { $ne: 0 },
                        $and: [
                            { "invitedMembers.email": req.user.email },
                            { "invitedMembers.invitationToken": token }
                        ]
                    }).lean()
                    let lObjJoinendMembers = await FocusGroup.find({ _id: ObjectId(req.body.groupId) })
                    let lArrayJoinedMenebersId = []
                    if (lObjJoinendMembers.joinedMembers) {
                        lArrayJoinedMenebersId = lObjJoinendMembers[0].joinedMembers.map(x => {
                            return x._id
                        })
                    }
                    let lAryTotalMembers = [...lArrayJoinedMenebersId, lObjJoinendMembers[0].createdUser._id].map(String)
                    if (lObjCheckUserInvitedOrNot === null) return Response.forbiddenError(res, "You have not been invited to this focus group")

                    //This is a middleware to compute validity of token

                    let ljwtDecode = await verify.verifyAcceptToken(token)
                    if (ljwtDecode) {
                        await UserBadge.focusGroupPrticipated(req.user._id);
                        let updateQuery = await FocusGroup.findOneAndUpdate({
                            groupName: ljwtDecode.groupName,
                            joinedMembers: { $nin: [req.user._id] },
                            "invitedMembers.email": req.user.email
                        }, {
                            $addToSet: { joinedMembers: req.user._id },
                            $pull: {
                                invitedMembers: { email: req.user.email }
                            }
                        }, {
                            new: true
                        });
                        if (updateQuery == null) {
                            return Response.success(res, updateQuery, `You've already joined this focus group`)
                        } else {
                            let updateNotification = await Notification.update({ _id: ObjectId(req.body.notifyId) }, { $set: { isDeleted: true } })
                            lAryTotalMembers = lAryTotalMembers.map(x => {
                                if (x !== req.user._id.toString()) return x;
                            })
                            lAryTotalMembers = _.compact(lAryTotalMembers)
                            let lAryChannels = [];
                            if (lAryTotalMembers) {
                                for (let i of lAryTotalMembers) {
                                    let lAryChannels = [];
                                    let Notify = await Notification.create({
                                        'userId': i,
                                        'focusGroupId': req.body.groupId,
                                        notificationType: 'updateMembers',
                                        message: `${req.user.userName} has joined the Focus Group ${lObjJoinendMembers[0].groupName}.`
                                    })

                                    lAryChannels.push((await User.findById(i).select('channelName')).channelName);
                                    let lUserDetails = await Notification.find({ _id: ObjectId(Notify._id) })
                                    pusherNotif.sendNotification(lAryChannels, lUserDetails);
                                }

                            }

                            let lObjNotify = await Notification.create({
                                'userId': req.user._id,
                                'focusGroupId': req.body.groupId,
                                notificationType: 'updateMembers',
                                message: `You have Joined the Focus Group ${lObjJoinendMembers[0].groupName}.`
                            })
                            return Response.success(res, updateQuery, 'Joined the group successfully')
                        }
                    }
                } else {
                    return Response.badValuesData(res, "Token Missing")
                }
            } catch (e) {
                console.log(e)
                return Response.errorInternal(e, res)
            }
        },
        /**
         * Decline to join in the group
         */
        declineToJoinGroup: async(req, res) => {
            try {
                let token = req.body.token;
                if (token) {
                    let lObjCheckCurrentUser = await FocusGroup.findOne({
                        _id: req.body.groupId,
                        groupstatus: { $ne: 0 },
                        createdUser: req.user._id
                    }).lean()
                    if (lObjCheckCurrentUser !== null) return Response.success(res, "No Active Focus group");

                    let lObjCheckUserInvitedOrNot = await FocusGroup.findOne({
                        _id: req.body.groupId,
                        groupstatus: { $ne: 0 },
                        $and: [
                            { "invitedMembers.email": req.body.email },
                            { "invitedMembers.invitationToken": token }
                        ]
                    }).lean()
                    let updateQuery = await FocusGroup.findOneAndUpdate({
                        joinedMembers: { $nin: [req.user._id] },
                        "invitedMembers.email": req.user.email
                    }, {
                        $pull: {
                            invitedMembers: { email: req.user.email }
                        }
                    }, {
                        new: true
                    });
                    if (updateQuery == null) {
                        return Response.success(res, updateQuery, 'This user is already a member of the group')
                    } else {
                        let updateNotification = await Notification.update({ _id: ObjectId(req.body.notifyId) }, { $set: { isDeleted: true } })

                        if (lObjCheckUserInvitedOrNot) {

                            let lAryChannels = [];
                            let Notify = await Notification.create({
                                'userId': lObjCheckUserInvitedOrNot.createdUser,
                                'focusGroupId': req.body.groupId,
                                notificationType: 'updateMembers',
                                message: `${req.user.userName} has Declined to Join in Focus Group ${lObjCheckUserInvitedOrNot.groupName}.`
                            })

                            lAryChannels.push((await User.findById(lObjCheckUserInvitedOrNot.createdUser).select('channelName')).channelName);
                            let lUserDetails = await Notification.find({ _id: ObjectId(Notify._id) })
                            pusherNotif.sendNotification(lAryChannels, lUserDetails);
                        }
                        return Response.success(res, updateQuery, 'Declined to the join the group !!')
                    }
                } else {
                    return Response.badValuesData(res, "Token Missing")
                }

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        /**
         * Ramya Accept the invitation and Join the group
         */
        acceptInvitation: async(req, res) => {
            try {
                let token = req.query.token;
                if (token) {

                    let lObjCheckCurrentUser = await FocusGroup.findOne({
                        _id: req.params.groupId,
                        groupstatus: { $ne: 0 },
                        createdUser: req.user._id
                    }).lean()

                    if (lObjCheckCurrentUser !== null) return Response.success(res, "success");

                    let lObjCheckUserInvitedOrNot = await FocusGroup.findOne({
                        _id: req.params.groupId,
                        groupstatus: { $ne: 0 },
                        $and: [
                            { "invitedMembers.email": req.user.email },
                            { "invitedMembers.invitationToken": token }
                        ]
                    }).lean()

                    if (lObjCheckUserInvitedOrNot === null) return Response.forbiddenError(res, "You have not been invited to this focus group")

                    let Notificationstatus = await Notification.findOne({ "_id": ObjectId(req.params.notificationId), "isDeleted": false });

                    if (Notificationstatus) {
                        await Notification.update({ "_id": ObjectId(req.params.notificationId) }, { $set: { "isDeleted": true } });

                        let create = await Notification.create({ "userId": ObjectId(req.user._id), "notificationType": "addMember", "message": `You have joined in the group` });
                        console.log(create, 'create notification')
                    }

                    await UserBadge.focusGroupPrticipated(req.user._id);

                    //This is a middleware to compute validity of token
                    jwt.verify(token, process.env.SUPER_SECRET, (err, decoded) => {
                        if (err) return Response.error(res, 400, err);
                        if (decoded) {
                            console.log(decoded, "decoded ************")
                            FocusGroup.findOneAndUpdate({
                                    groupName: decoded.groupName,
                                    joinedMembers: { $nin: [req.user._id] },
                                    "invitedMembers.email": req.user.email
                                }, {
                                    $addToSet: { joinedMembers: req.user._id },
                                    $pull: {
                                        invitedMembers: { email: req.user.email }
                                    }
                                }, {
                                    new: true
                                },
                                (err, data) => {
                                    if (err) {
                                        console.log(err)
                                        return Response.error(res, 400, err);
                                    } else if (data !== null) {
                                        data = sanitize(data) //Remove Sensitive Data

                                        if (req.body.returnResponse !== false) return Response.success(res, data, 'Joined the group successfully')
                                    } else {
                                        return Response.success(res, data, `You've already joined this focus group`)
                                    }
                                })
                        } else {
                            return Response.notAuthorized(res, "Not a Valid Token")
                        }
                    });
                } else {
                    return Response.badValuesData(res, "Token Missing")
                }
            } catch (e) {
                console.log(e)
                return Response.errorInternal(e, res)
            }
        },

        /**
         * List all the groups while the user was invited and not joined
         */
        getUserInvitedGroups: async(req, res) => {
            try {
                //Pagination
                gIntDataPerPage = req.query.offset == 0 ? 15 : parseInt(req.query.offset)
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let lIntTotalNoOfGroups = await FocusGroup.count({
                    invitedMembers: req.user.email,
                    groupstatus: { $ne: 0 },
                    joinedMembers: { $nin: [ObjectId(req.user._id)] }
                })

                let lAryUserInvitedGroups = await FocusGroup.find({
                    invitedMembers: req.user.email,
                    groupstatus: { $ne: 0 },
                    joinedMembers: { $nin: [ObjectId(req.user._id)] }
                }).skip(skipRec).limit(gIntDataPerPage).select('_id groupName').lean()

                let lObjInvitedGroups = {
                    groups: lAryUserInvitedGroups,
                    total: Math.ceil(lIntTotalNoOfGroups / gIntDataPerPage),
                    per_page: gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, lObjInvitedGroups, 'Invited Groups')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        /**
         * Join the group
         */
        joiningAGroup: async(req, res) => {
            try {
                let lAryUserInvitedGroups = await FocusGroup.update({
                    _id: {
                        $in: req.body.group
                    }
                }, {
                    $addToSet: { joinedMembers: req.user._id }
                }, { multi: true }).select('_id groupName').lean()

                console.log("lAryUserInvitedGroups", lAryUserInvitedGroups)

                return Response.success(res, 'Successfully joined the groups...!')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getMyFocusGroup: async(req, res) => {
            try {
                console.log("getMyFocusGroup");
                //Group Id
                let lObjGroupId = req.params.groupId;

                let checkUser = await FocusGroup.find({ _id: lObjGroupId, "groupstatus": 0 })
                if (checkUser.length) {
                    return Response.forbiddenError(res, { message: "This Focus group is deleted!!" })
                }

                let checkStatus = await FocusGroup.find({ _id: lObjGroupId, groupstatus: { $ne: 0 } });

                if (checkStatus[0].isPublic == false) {
                    if (!req.headers['x-access-token']) {
                        return Response.signout(res, 'Access Denied, If you want to view please login first!!')
                    } else {
                        let token = req.headers['x-access-token'];
                        let userDetail = await verify.verifyAnonymousToken(token);
                        console.log(userDetail, 'user details*************')
                        if (!userDetail.status) {
                            return Response.signout(res)
                        }
                        userDetail = userDetail.msg;

                        /**
                         * Focus Group payment expiry check
                         * 
                         */
                        let unreadMsg = await Unread.findOneAndUpdate({ focusgroupId: lObjGroupId, userId: userDetail._id }, {
                            $set: {
                                count: 0
                            }
                        });
                        let currentDate = moment().utc().format('');
                        let checkPaymentStatus = await FocusGroup.findOne({ _id: lObjGroupId, groupstatus: { $ne: 0 } });
                        let projectDetail = await Project.findOne({ _id: checkPaymentStatus.projectId, projectStatus: 1 });
                        let teamMembers = await ProjectTeamMember.find({ projectId: checkPaymentStatus.projectId, 'projectTeamMember.userId': userDetail._id });
                        if (teamMembers.length == 0 && checkPaymentStatus.invitedMembers.length == 0) {
                            return Response.forbiddenError(res, 'Access Denied, If you want to view please join the group first!!')
                        } else {
                            for (let member of checkPaymentStatus.invitedMembers) {
                                let exist = await FocusGroup.find({
                                    _id: lObjGroupId,
                                    "invitedMembers.email": member.email
                                });

                                if (exist.length == 0) {
                                    return Response.forbiddenError(res, 'Access Denied, If you want to view please join the group first!!')
                                }
                            }
                        }

                        for (let i = 0; i < teamMembers.length; i++) {
                            if (userDetail.email == teamMembers[i].projectTeamMember.email && projectDetail.userId != teamMembers[i].projectTeamMember.userId) {
                                let teamUsers = await TeamUsers.find({ email: teamMembers[i].projectTeamMember.email, createdUser: teamMembers[i].createdBy }).sort({ planExpiryDate: -1 });
                                if (teamUsers.length > 0) {
                                    for (let x of teamUsers) {
                                        let teamUserPayment = await TeamUserPayment.findOne({ teamUserId: x._id }).sort({ endDate: -1 });
                                        let subtract = moment(teamUserPayment.endDate).diff(currentDate, 'day');
                                        // if (subtract < 0) { payment removal
                                        //     return Response.forbiddenError(res, 'Payment Expired for you')
                                        // }
                                    }

                                }
                            }

                            let exist = await FocusGroup.find({
                                _id: lObjGroupId,
                                projectId: ObjectId(teamMembers[i].projectId)
                            });

                            if (exist.length == 0) {
                                return Response.forbiddenError(res, 'Access Denied, If you want to view please join the group first!!')
                            }

                        }
                    }
                }



                let lObjRes = await FocusGroup.aggregate([{
                        $match: { _id: ObjectId(lObjGroupId) }
                    },
                    { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    {
                        $graphLookup: {
                            from: "users",
                            startWith: "$invitedMembers.email",
                            connectFromField: "invitedMembers.email",
                            connectToField: "email",
                            as: "invitedMemberDetails"
                        }
                    },
                    { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'projectId' } },
                    { $unwind: '$projectId' },
                    {
                        $group: {
                            _id: "$_id",
                            "invitedMembers": {
                                "$push": {
                                    $cond: {
                                        if: { $ne: ["$invitedMembers", null] },
                                        then: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                            'firstName': '$invitedMemberDetails.firstName',
                                            'lastName': '$invitedMemberDetails.lastName',
                                            userName: "$invitedMemberDetails.userName",
                                            userId: "$invitedMemberDetails._id",
                                            "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$invitedMemberDetails.profilePicture"] }, ""] }
                                        },
                                        else: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                        },
                                    }
                                }
                            },
                            "groupName": { $first: "$groupName" },
                            "isPublic": { $first: "$isPublic" },
                            "type": { $first: "$type" },
                            "groupstatus": { $first: "$groupstatus" },
                            "projectId": { $first: "$projectId" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': { $first: "$joinedMembers" },
                            "createdAt": { $first: "$createdAt" }
                        }
                    },

                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'fg_project_screens', localField: '_id', foreignField: 'focusGroupId', as: 'fgProjectScreens' } },
                    { $unwind: { path: '$fgProjectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'project_screens', localField: 'fgProjectScreens.projectScreenId', foreignField: '_id', as: 'projectScreens' } },
                    { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'screens', localField: 'projectScreens.screenId', foreignField: '_id', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "invitedMembers": { $first: '$invitedMembers' },
                            "groupName": { $first: "$groupName" },
                            "type": { $first: "$type" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            "isPublic": { $first: "$isPublic" },
                            "projectId": { $first: "$projectId" },
                            'joinedMembers': {
                                "$push": {
                                    '_id': '$joinedMembers._id',
                                    'userName': '$joinedMembers.userName',
                                    'firstName': '$joinedMembers.firstName',
                                    'lastName': '$joinedMembers.lastName',
                                    'email': '$joinedMembers.email',
                                    "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$joinedMembers.profilePicture"] }, ""] },
                                }
                            },
                            "createdAt": { $first: "$createdAt" },
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
                                    "description": "$fgProjectScreens.description",
                                    "sequence": "$fgProjectScreens.sequence",
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
                    { $lookup: { from: 'screenversions', localField: 'screens._id', foreignField: 'parentId', as: 'versions' } },
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
                                            // else: { $ifNull: [{ $concat: [`${process.env.CLOUDURL}screens/`, "$screens.image"] }, ""] }
                                            else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$screens.image"] }, ""] }
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
                                    versions: '$versions',
                                    projectScreenId: '$screens.projectScreenId'
                                }
                            },

                        }
                    },
                    { $sort: { "createdAt": -1 } }
                ])

                lObjRes = lObjRes ? lObjRes[0] : {};

                for (let x of lObjRes.screens) {
                    x.versions = x.versions.slice(1);
                    for (let version of x.versions) {
                        if (version != null || version != undefined) {
                            let result;
                            if (version.inspire != null || version.inspire != undefined) {
                                result = version.inspire;
                            } else {
                                result = false;
                            }

                            let url;
                            if (result == false) {
                                url = process.env.AWS_URL + version.image;
                                version.image = url;
                            } else {
                                url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + version.image;
                                version.image = url;
                            }
                        }
                    }
                }

                let Members = [];
                if (lObjRes && lObjRes.joinedMembers) {
                    lObjRes.joinedMembers = _.filter(lObjRes.joinedMembers, function(v) {
                        return v._id;
                    });
                    lObjRes.invitedMembers = _.filter(lObjRes.invitedMembers, function(v) {
                        return v._id;
                    });

                    let lObjProjectTeamMember = await ProjectTeamMember.find({ projectId: checkStatus[0].projectId }).select('projectTeamMember');

                    lObjProjectTeamMember = lObjProjectTeamMember.map(v => {
                        let obj = {
                            "userId": v.projectTeamMember.userId,
                            "email": v.projectTeamMember.email,
                            "firstName": v.projectTeamMember.firstName,
                            "projectTeamMember": true
                        }

                        if ((v.projectTeamMember.userId).toString() !== (lObjRes.createdUser._id).toString()) {
                            return obj;
                        }
                    });

                    lObjProjectTeamMember = lObjProjectTeamMember.filter(x => {
                        return x != undefined
                    })

                    lObjRes['members'] = [lObjRes.createdUser, ...lObjRes.joinedMembers, ...lObjRes.invitedMembers, ...lObjProjectTeamMember]

                    lObjRes.members = lObjRes.members.map(v => {
                        if (v.hasOwnProperty('projectTeamMember')) {
                            return v;
                        } else {
                            v.projectTeamMember = false;
                            return v;
                        }
                    })

                    lObjRes.invitedMembers = _.filter(lObjRes.invitedMembers, function(o) {
                        for (let v of lObjRes.joinedMembers) {
                            return o.email !== v.email
                        }
                    });
                }

                if (checkStatus[0].isPublic == false) {

                    let lAryTotalMembers = lObjRes.joinedMembers.map(x => {
                        return x._id
                    })
                    lAryTotalMembers.push(lObjRes.createdUser._id)

                    lAryTotalMembers = lAryTotalMembers.map(String)

                    let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET);

                    let user = await User.find({
                        _id: decoded._id,
                        email: decoded.email,
                        userName: decoded.userName,
                        lastLoggedIn: decoded.lastLoggedIn
                    })

                    if (user.length == 0) {
                        return Response.errorInternal('Session Expired', res)
                    }

                    let lResult = await lAryTotalMembers.includes(user[0]._id.toString())

                    let emailResult = [];
                    await lObjRes.members.filter((user) => {
                        if (user.email == user.email) {
                            emailResult.push(user)
                        }
                    })

                    if (lResult || emailResult.length > 0) {
                        if (lObjRes && lObjRes.screens) {
                            lObjRes.screens = _.filter(lObjRes.screens, function(v) {
                                return v.image;
                            });
                        }
                        // console.log(lObjRes, "QWERTYUIASDFGHJXCVBN")
                        if (lObjRes && lObjRes.screens) {
                            lObjRes.screens = _.map(lObjRes.screens, async function(v) {
                                v["hotspot"] = await Hotspot.find({ screenId: ObjectId(v._id), status: 1, focusgroupId: ObjectId(lObjGroupId) }).populate([{
                                    path: "userId",
                                    select: "email _id userName profilePicture profilePic"
                                }, {
                                    path: "commentRes.userId",
                                    select: "email _id userName profilePicture profilePic"
                                }]).lean();

                                for (let y of v["hotspot"]) {
                                    let data = await Ticket.findOne({ hotspotId: ObjectId(y._id), status: 1 }).populate([{
                                        path: "assignedUser",
                                        select: "email _id userName profilePicture profilePic firstName lastName"
                                    }]);

                                    if (data != null) {
                                        let obj = {
                                            email: data.assignedUser.email,
                                            userName: data.assignedUser.userName,
                                            profilePicture: data.assignedUser.profilePicture,
                                            _id: data.assignedUser._id,
                                            firstName: data.assignedUser.firstName,
                                            lastName: data.assignedUser.lastName
                                        }
                                        y.assignedUser = obj;
                                    }
                                }

                                for (let x of v.versions) {
                                    x["hotspot"] = await Hotspot.find({ screenId: ObjectId(x._id), status: 1, focusgroupId: ObjectId(lObjGroupId) }).populate([{
                                        path: "userId",
                                        select: "email _id userName profilePicture profilePic"
                                    }, {
                                        path: "commentRes.userId",
                                        select: "email _id userName profilePicture profilePic"
                                    }]).lean();

                                    for (let y of x["hotspot"]) {
                                        let data = await Ticket.findOne({ hotspotId: ObjectId(y._id), status: 1 }).populate([{
                                            path: "assignedUser",
                                            select: "email _id userName profilePicture profilePic firstName lastName"
                                        }]);

                                        if (data != null) {
                                            let obj = {
                                                email: data.assignedUser.email,
                                                userName: data.assignedUser.userName,
                                                profilePicture: data.assignedUser.profilePicture,
                                                _id: data.assignedUser._id,
                                                firstName: data.assignedUser.firstName,
                                                lastName: data.assignedUser.lastName
                                            }
                                            y.assignedUser = obj;
                                        }
                                    }
                                };
                                return v;
                            });

                            lObjRes.screens = await Promise.all(lObjRes.screens)
                        }
                        await delete lObjRes.invitedMembers;
                        await delete lObjRes.joinedMembers;

                        return Response.success(res, lObjRes, 'Focus Group');
                    } else {
                        return Response.forbiddenError(res, "Access Denied, If you want to view please join this group first");
                    }
                } else {

                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.filter(lObjRes.screens, function(v) {
                            return v.image;
                        });

                    }
                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.map(lObjRes.screens, async function(v) {
                            v["hotspot"] = await Hotspot.find({ screenId: ObjectId(v._id), status: 1, focusgroupId: ObjectId(lObjGroupId) }).populate([{
                                path: "userId",
                                select: "email _id userName profilePicture profilePic"
                            }, {
                                path: "commentRes.userId",
                                select: "email _id userName profilePicture profilePic"
                            }]).lean();

                            for (let y of v["hotspot"]) {
                                let data = await Ticket.findOne({ hotspotId: ObjectId(y._id), status: 1 }).populate([{
                                    path: "assignedUser",
                                    select: "email _id userName profilePicture profilePic firstName lastName"
                                }]);

                                if (data != null) {
                                    let obj = {
                                        email: data.assignedUser.email,
                                        userName: data.assignedUser.userName,
                                        profilePicture: data.assignedUser.profilePicture,
                                        _id: data.assignedUser._id,
                                        firstName: data.assignedUser.firstName,
                                        lastName: data.assignedUser.lastName
                                    }
                                    y.assignedUser = obj;
                                }
                            }

                            for (let x of v.versions) {
                                x["hotspot"] = await Hotspot.find({ screenId: ObjectId(x._id), status: 1, focusgroupId: ObjectId(lObjGroupId) }).populate([{
                                    path: "userId",
                                    select: "email _id userName profilePicture profilePic"
                                }, {
                                    path: "commentRes.userId",
                                    select: "email _id userName profilePicture profilePic"
                                }]).lean();

                                for (let y of x["hotspot"]) {
                                    let data = await Ticket.findOne({ hotspotId: ObjectId(y._id), status: 1 }).populate([{
                                        path: "assignedUser",
                                        select: "email _id userName profilePicture profilePic firstName lastName"
                                    }]);

                                    if (data != null) {
                                        let obj = {
                                            email: data.assignedUser.email,
                                            userName: data.assignedUser.userName,
                                            profilePicture: data.assignedUser.profilePicture,
                                            _id: data.assignedUser._id,
                                            lastName: data.assignedUser.lastName,
                                            firstName: data.assignedUser.firstName
                                        }
                                        y.assignedUser = obj;
                                    }
                                }
                            };
                            return v;
                        });

                        lObjRes.screens = await Promise.all(lObjRes.screens)
                    }

                    return Response.success(res, lObjRes, 'Focus Group');
                }

            } catch (err) {
                console.log(err, 'error details')
                return Response.errorInternal(err, res)
            }
        },
        editMyFocusGroup: async(req, res) => {
            try {
                let lObjGroupId = req.params.groupId;
                let lObjHotspot = await FocusGroup.findOne({ _id: lObjGroupId, createdUser: req.user._id })
                if (lObjHotspot === null) return Response.notAuthorized(res, "You're not authorized to perform this action")
                let lObjRes = await FocusGroup.aggregate([{
                        $match: { _id: ObjectId(lObjGroupId) }
                    },
                    { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    {
                        $graphLookup: {
                            from: "users",
                            startWith: "$invitedMembers.email",
                            connectFromField: "invitedMembers.email",
                            connectToField: "email",
                            as: "invitedMemberDetails"
                        }
                    },
                    { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "invitedMembers": {
                                "$push": {
                                    $cond: {
                                        if: { $ne: ["$invitedMembers", null] },
                                        then: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                            userName: "$invitedMemberDetails.userName",
                                            userId: "$invitedMemberDetails._id",
                                            "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$invitedMemberDetails.profilePicture"] }, ""] }
                                        },
                                        else: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                        },
                                    }
                                }
                            },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': { $first: "$joinedMembers" },
                            "createdAt": { $first: "$createdAt" }
                        }
                    },

                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },

                    { $lookup: { from: 'fg_project_screens', localField: '_id', foreignField: 'focusGroupId', as: 'fgProjectScreens' } },
                    { $unwind: { path: '$fgProjectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'project_screens', localField: 'fgProjectScreens.projectScreenId', foreignField: '_id', as: 'projectScreens' } },
                    { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'screens', localField: 'projectScreens.screenId', foreignField: '_id', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "invitedMembers": { $first: '$invitedMembers' },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': {
                                "$push": {
                                    '_id': '$joinedMembers._id',
                                    'userName': '$joinedMembers.userName',
                                    'email': '$joinedMembers.email',
                                    "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }, ""] },
                                }
                            },
                            "createdAt": { $first: "$createdAt" },
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
                                    "description": "$screens.description",
                                    "sequence": "$fgProjectScreens.sequence",
                                    "screenVersionId": "$screens.screenVersionId"
                                }
                            }
                        }
                    }, {
                        $project: {
                            _id: "$_id",
                            "invitedMembers": 1,
                            "groupName": 1,
                            "groupstatus": 1,
                            "description": 1,
                            "createdUser": {
                                '_id': '$createdUser._id',
                                'isAdmin': true,
                                'userName': '$createdUser.userName',
                                'email': '$createdUser.email',
                                'userId': '$createdUser._id',
                                "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
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
                    }, { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $sort: { "screens.sequence": 1 }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            "invitedMembers": { $first: '$invitedMembers' },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': { $first: '$joinedMembers' },
                            "createdAt": { $first: "$createdAt" },
                            screens: {
                                $push: {
                                    "_id": '$screens._id',
                                    "image": { $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$screens.images"] }, ""] },
                                    "parentId": '$screens.parentScreen',
                                    "screenId": "$screens.parentScreenId",
                                    "screenStatus": "$screens.screenStatus"
                                }
                            }
                        }
                    }
                ])
                lObjRes = lObjRes ? lObjRes[0] : {};

                if (lObjRes && lObjRes.joinedMembers) {
                    lObjRes.joinedMembers = _.filter(lObjRes.joinedMembers, function(v) {
                        return v._id;
                    });
                    lObjRes.invitedMembers = _.filter(lObjRes.invitedMembers, function(v) {
                        return v._id;
                    });

                    lObjRes.joinedMembers = [...lObjRes.joinedMembers, lObjRes.createdUser]

                    lObjRes.invitedMembers = _.filter(lObjRes.invitedMembers, function(o) {
                        for (let v of lObjRes.joinedMembers) {
                            return o.email !== v.email
                        }
                    });
                }
                let lAryTotalMembers = lObjRes.joinedMembers.map(x => {
                    return x._id
                })
                lAryTotalMembers = lAryTotalMembers.map(String)
                let lResult = lAryTotalMembers.includes(req.user._id.toString())
                if (lResult) {
                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.filter(lObjRes.screens, function(v) {
                            return v.image;
                        });

                    }
                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.map(lObjRes.screens, async function(v) {
                            v["hotspot"] = await Hotspot.find({ screenId: v._id, status: 1 }).populate([{
                                path: "userId",
                                select: "email _id userName profilePicture profilePic"
                            }, {
                                path: "commentRes.userId",
                                select: "email _id userName profilePicture profilePic"
                            }]).lean();
                            return v;
                        });
                        lObjRes.screens = await Promise.all(lObjRes.screens)
                    }

                    return Response.success(res, lObjRes, 'Focus Group');
                } else {
                    return Response.forbiddenError(res, "Access Denied, If you want to view please join this group first");
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        /**
         * Delete the Focus Group(Soft delete only)
         */
        deleteFocusGroup: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    groupId: Joi.string().trim().required(),
                    status: Joi.number().optional().default(0)
                });

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let errorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, errorMsg);
                }

                let focusGroup = await FocusGroup.findOne({
                    _id: value.groupId
                });
                let isUserExistsInProjectTeamMembers = await ProjectTeamMember.exists({
                    projectId: focusGroup.projectId,
                    'projectTeamMember.userId': req.user._id
                });

                if (!isUserExistsInProjectTeamMembers) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action");
                }

                let output = await FocusGroup.findOneAndUpdate({
                    _id: value.groupId
                }, {
                    $set: {
                        groupstatus: value.status
                    }
                }, {
                    new: true
                });
                if (value.status == 2) {
                    //Notification(For Socket Purpose)
                    console.log(output, 'focus group details')
                    let lAryTotalMembers = [...output.joinedMembers, output.createdUser] //Send notification to all members in a group including created user
                    for (let i of lAryTotalMembers) {
                        let lObjNotifData = await Notification.create({
                            'userId': i,
                            'focusGroupId': output._id,
                            notificationType: 'deleteFG',
                            message: `${output.groupName} has been Archived.`,
                            createdUser: req.user._id
                        })
                        let channelName = (await User.findById(i).select('channelName')).channelName;
                        pusherNotif.sendNotification(channelName, lObjNotifData);
                    }
                }
                if (output !== null) return Response.success(res, 'Focus Group Updated succesfully');

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        addMembers: async(req, res) => {
            try {
                let lObjFocusGroupId = req.params.groupId;
                let lAryRecentInvitedList = req.body.invitedMembers;

                let lObjFocusGroupDetail = await FocusGroup.findOne({ _id: lObjFocusGroupId, createdUser: req.user._id }).lean()
                console.log(lObjFocusGroupDetail)
                if (lObjFocusGroupDetail == null) {
                    return Response.badValuesData(res, "You do not have the permission to invite a member to this focus group!!");
                }

                let lAryAlreadyInvitedLists = lObjFocusGroupDetail.invitedMembers;
                let lAryAlreadyJoinedMenmberEmail = await FocusGroup.aggregate([{
                        $match: { _id: ObjectId(lObjFocusGroupId) }
                    },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "joinedMembers": {
                                "$push": {
                                    $cond: {
                                        if: { $ne: ["$joinedMembers", null] },
                                        then: {
                                            'email': '$joinedMembers.email'
                                        },
                                        else: {
                                            '_id': '$joinedMembers._id',
                                            'email': '$joinedMembers.email',
                                        },
                                    }
                                }
                            }

                        }
                    }
                ]);
                if (lAryAlreadyJoinedMenmberEmail.length > 0) {
                    lAryAlreadyJoinedMenmberEmail = lAryAlreadyJoinedMenmberEmail[0].joinedMembers
                        //Check the invited member already joined in this group or not, If yes throw the notification to avoid duplicate
                        // let lAryErrMessage = [];

                    for (let x of lAryAlreadyJoinedMenmberEmail) {
                        const index = lAryRecentInvitedList.indexOf(x.email)
                        if (-1 !== index) {
                            delete lAryRecentInvitedList[index];
                        }
                    }
                }
                // if (_.compact(lAryErrMessage).length > 0) return Response.badValuesData(res, _.compact(lAryErrMessage));
                if (!lAryRecentInvitedList[0]) {
                    return Response.badValuesData(res, "Members already is in Joined list");
                } else {

                    let lAryInvitedMembers = [];
                    let lArySendInviteEmail = [];
                    console.log(lAryAlreadyInvitedLists, "lAryAlreadyInvitedLists")
                        //Check the invited member is already invited to this group or not, If yes ignore the existing one and post the new one
                    for (let i in lAryAlreadyInvitedLists) {
                        let x = lAryAlreadyInvitedLists[i];
                        if (lAryRecentInvitedList.includes(x.email)) {

                            //Check the existing user token if it doesn't expire sent the mail to the user onemore time with existing token
                            await jwt.verify(x.invitationToken, process.env.SUPER_SECRET, async(err, decoded) => {
                                if (decoded) {
                                    lArySendInviteEmail.push({
                                        email: x.email,
                                        invitationToken: x.invitationToken
                                    });
                                    lAryRecentInvitedList = _.without(lAryRecentInvitedList, x.email)
                                } else if (err.name === "TokenExpiredError") {
                                    //If the user token expires remove the user from invited member key and add the new one for avoiding duplicates
                                    await FocusGroup.findOneAndUpdate({
                                        _id: lObjFocusGroupId,
                                        "invitedMembers.email": x.email
                                    }, {
                                        $pull: { invitedMembers: { email: x.email } }
                                    }, {
                                        new: true
                                    })
                                }
                            })
                        }
                    }

                    //GENERATE TOKEN FOR NEW USERS
                    for (let v of lAryRecentInvitedList) {
                        let expiry = '30 days'; //Expires in 30 day
                        const { _id, groupName } = lObjFocusGroupDetail,
                        tokenData = { _id, v, groupName };

                        let token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                            expiresIn: expiry
                        });
                        lAryInvitedMembers.push({ email: v, invitationToken: token })
                        lArySendInviteEmail.push({ email: v, invitationToken: token }) // SEND EMAIL TO ALL THE USERS INCLUDING EXISTING USER
                    }

                    let lObjFocusGroup;
                    //UPDATE THE NEW USER DETAILS IN DB 
                    if (lAryInvitedMembers.length > 0) {
                        lObjFocusGroup = await FocusGroup.findOneAndUpdate({
                            _id: lObjFocusGroupId
                        }, {
                            $addToSet: {
                                invitedMembers: lAryInvitedMembers
                            }
                        }, {
                            new: true
                        });

                        await lAryInvitedMembers.filter(async function(invite) {
                            let checkExists = await UserInvite.find({ userId: req.user._id, email: invite.email })
                            if (checkExists.length == 0) {
                                await UserInvite.create({
                                    userId: req.user._id,
                                    email: invite.email
                                })
                            }
                        })

                        //Send Email to all the user who are invited
                        for (let v of lArySendInviteEmail) {
                            let mailData = {
                                userName: req.user.userName,
                                email: v.email,
                                groupName: lObjFocusGroup.groupName,
                                link: `${process.env.BASE_URL}focusgroup/${lObjFocusGroupId}?token=${v.invitationToken}`
                            }
                            mailer.invitationEmail(mailData);

                        }


                        //Notification(For Socket Purpose)

                        let lObjFocusGroupRes = await FocusGroup.aggregate([{
                                $match: { "_id": ObjectId(lObjFocusGroupId) }
                            },
                            { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },

                            { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                            { $unwind: '$createdUser' },
                            {
                                $graphLookup: {
                                    from: "users",
                                    startWith: "$invitedMembers.email",
                                    connectFromField: "invitedMembers.email",
                                    connectToField: "email",
                                    as: "invitedMemberDetails"
                                }
                            },
                            { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
                            {
                                $group: {
                                    _id: "$_id",
                                    "invitedMembers": {
                                        "$push": {
                                            $cond: {
                                                if: { $ne: ["$invitedMembers", null] },
                                                then: {
                                                    '_id': '$invitedMembers._id',
                                                    'email': '$invitedMembers.email',
                                                    userName: "$invitedMemberDetails.userName",
                                                    userId: "$invitedMemberDetails._id",
                                                    invitationToken: '$invitedMembers.invitationToken',
                                                    "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$invitedMemberDetails.profilePicture"] }, ""] }
                                                },
                                                else: {
                                                    '_id': '$invitedMembers._id',
                                                    'email': '$invitedMembers.email',
                                                },
                                            }
                                        }
                                    },
                                    "groupName": { $first: "$groupName" },
                                    "groupstatus": { $first: "$groupstatus" },
                                    "description": { $first: "$description" },
                                    "createdUser": { $first: '$createdUser' },
                                    'joinedMembers': { $first: "$joinedMembers" },
                                    "createdAt": { $first: "$createdAt" }
                                }
                            },

                            { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                            { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                            {
                                $group: {
                                    _id: "$_id",
                                    "invitedMembers": { $first: '$invitedMembers' },
                                    "groupName": { $first: "$groupName" },
                                    "groupstatus": { $first: "$groupstatus" },
                                    "description": { $first: "$description" },
                                    "createdUser": { $first: '$createdUser' },
                                    'joinedMembers': {
                                        "$push": {
                                            '_id': '$joinedMembers._id',
                                            'userName': '$joinedMembers.userName',
                                            'email': '$joinedMembers.email',
                                            "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }, ""] },
                                        }
                                    },
                                    "createdAt": { $first: "$createdAt" },

                                }
                            }, {
                                $project: {
                                    _id: "$_id",
                                    "invitedMembers": 1,
                                    "groupName": 1,
                                    "groupstatus": 1,
                                    "description": 1,
                                    "createdUser": {
                                        '_id': '$createdUser._id',
                                        'isAdmin': true,
                                        'userName': '$createdUser.userName',
                                        'email': '$createdUser.email',
                                        'userId': '$createdUser._id',
                                        "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
                                    },
                                    'joinedMembers': 1,
                                    "createdAt": 1,
                                }
                            }

                        ])
                        lObjFocusGroupRes = (lObjFocusGroupRes) ? lObjFocusGroupRes[0] : {}
                        if (lObjFocusGroupRes) {
                            let lObjInvited = lObjFocusGroupRes.invitedMembers
                            let lObjEmail = lAryInvitedMembers.map(e => e.email)
                            lObjInvited = lObjInvited.filter(v => lObjEmail.includes(v.email))

                            /**
                             * Notification for accepting Focus Group Invite commented by Firnaas
                             */

                            // for (let i of lObjInvited) {
                            //     if (i.userId) {
                            //         console.log({
                            //             'userId': i.userId,
                            //             "invitationToken": i.invitationToken,
                            //             'focusGroupId': lObjFocusGroupRes._id,
                            //             notificationType: 'addMembers',
                            //             message: `${lObjFocusGroup.createdUser.userName} invite you to join in our Focus Group ${lObjFocusGroup.groupName}.`
                            //         })
                            //         let lObjNotifData = await Notification.create({
                            //             'userId': i.userId,
                            //             "invitationToken": i.invitationToken,
                            //             'focusGroupId': lObjFocusGroupRes._id,
                            //             notificationType: 'addMembers',
                            //             message: `${lObjFocusGroup.createdUser.userName} has invited you join their Focus Group ${lObjFocusGroup.groupName}.`
                            //         })
                            //         let lObjNotifChannel = (await User.findById(i.userId).select('channelName')).channelName;
                            //         let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })

                            //         pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                            //     }
                            // }

                        }

                        lObjFocusGroupRes.joinedMembers = [...lObjFocusGroupRes.joinedMembers, lObjFocusGroupRes.createdUser]
                        let lObjFocusGroupResult = sanitize(lObjFocusGroupRes) //Remove Sensitive Data

                        return Response.success(res, lObjFocusGroupResult, 'An invite has been sent to the user');
                    } else {
                        return Response.badValuesData(res, "Members already is in invited list");

                    }
                }
            } catch (err) {
                console.log(err, "Catch ERR");
                return Response.errorInternal(err, res)
            }
        },

        /**
         * Remove Joined Memebers
         **/
        removeMember: async(req, res) => {
            try {
                if (!req.params.groupId) return Response.badValuesData(res, "GroupId missing");
                const schema = Joi.object().keys({
                    memberId: Joi.string(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjCheckData = await FocusGroup.findOne({
                    _id: req.params.groupId,
                    createdUser: req.user._id
                }).lean()

                let lObjfocusGroup = {}
                if (lObjCheckData === null) return Response.forbiddenError(res, "You don't have the permission to remove the user.")

                // if (req.query.userType === "joined") {
                lObjfocusGroup = await FocusGroup.findOneAndUpdate({
                        _id: req.params.groupId,
                        createdUser: req.user._id
                    }, {
                        $pull: {
                            joinedMembers: req.body.memberId
                        }
                    }, { new: true })
                    // } else if (req.query.userType === "invited") {
                lObjfocusGroup = await FocusGroup.findOneAndUpdate({
                        _id: req.params.groupId,
                        createdUser: req.user._id
                    }, {
                        $pull: { invitedMembers: { _id: req.body.memberId } },
                    }, { new: true })
                    // }
                console.log(lObjfocusGroup, "before")
                await methods.getMyFocusGroup(req, res);
                console.log(lObjfocusGroup, "after")
                    //return Response.success(res, lObjfocusGroup, 'User removed successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        /* 
         *Get FocusGroup Details 
         *Input : focusGroupId
         */
        getFocusGroupById: async(req, res) => {
            try {
                let lObjGroupId = req.params.focusId;
                console.log(lObjGroupId)
                let lObjRes = await FocusGroup.aggregate([{
                        $match: { _id: ObjectId(lObjGroupId) }
                    },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $project: {
                            _id: "$_id",
                            screens: 1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            screens: {
                                $push: {
                                    "_id": '$screens._id',
                                    "image": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/screens/", "$screens.image"] }, ""] },
                                    "screenStatus": "$screens.screenStatus"
                                }
                            }
                        }
                    }
                ])

                return Response.success(res, lObjRes, 'Focus Group Details Loaded succesfully');
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        focusGroupList: async(req, res) => {
            try {
                console.log("req.user", req.user._id)

                let lObjRes = await FocusGroup.aggregate([{
                        $match: { createdUser: ObjectId(req.user._id), groupstatus: { $ne: 0 } }
                    },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $project: {
                            _id: "$_id",
                            screens: 1,
                            groupName: 1,
                            projectId: 1
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            "groupName": { $first: "$groupName" },
                            "projectId": { $first: "$projectId" },
                            "screens": {
                                $push: {
                                    "_id": '$screens._id',
                                    "screenName": { $ifNull: ["$screens.screenName", ""] },
                                    "image": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/screens/", "$screens.image"] }, ""] },
                                    "screenStatus": "$screens.screenStatus"
                                }
                            }
                        }
                    },
                ])
                if (lObjRes) {
                    lObjRes = _.map(lObjRes, async function(v) {
                        v.screens = _.filter(v.screens, function(x) {
                            return x.image
                        })

                        if (v.screens.length > 0) return v
                    });
                }

                lObjRes = await Promise.all(lObjRes);
                lObjRes = lObjRes.filter(Boolean);
                return Response.success(res, lObjRes, 'Focus Group Details Loaded succesfully');
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        collaboratorsList: async(req, res) => {
            try {
                let lObjRes = await FocusGroup.aggregate([{
                        $match: {
                            $and: [{ groupstatus: { $ne: 0 } }, {
                                $or: [
                                    { "joinedMembers": ObjectId(req.user._id) },
                                    { "invitedMembers.email": req.user.email }
                                ]
                            }]

                        }
                    },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    {
                        $project: {
                            _id: 1,
                            createdUser: {
                                '_id': '$createdUser._id',
                                'userName': '$createdUser.userName',
                                'email': '$createdUser.email',
                                'firstName': '$createdUser.firstName',
                                'lastName': '$createdUser.lastName',
                                'profilePicture': { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
                            }

                        }
                    },
                ])
                let finalArray = []
                for (let result of lObjRes) {
                    let createdUserList = result.createdUser
                    finalArray.push(createdUserList)
                }
                let finalArrayRes = _.uniqBy(finalArray, 'userName');
                return Response.success(res, finalArrayRes, 'Focus Group Details Loaded succesfully');
            } catch (error) {
                console.log(error)
                return Response.errorInternal(error, res)
            }
        },
        /*
         * Get recent five focus group members
         */
        recentFGMembers: async(req, res) => {
            try {
                let inviteMailId = [],
                    joinedMailId = [];

                let recentMember = await FocusGroup.findById({ _id: req.params.groupId });
                if (recentMember && recentMember != null) {
                    await recentMember.invitedMembers.filter(function(member) {
                        if (member) {
                            inviteMailId.unshift(member.email);
                        }
                    })
                    await recentMember.joinedMembers.filter(function(member) {
                        if (member) {
                            joinedMailId.push(member.email);
                        }
                    })
                    let email = await inviteMailId.concat(joinedMailId);
                    email = email.slice(0, 5);
                    return Response.success(res, email, 'Recently invited members');
                } else {
                    return Response.message(res, 200, 'Not Found');
                }
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        },

        updatedFGList: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 15 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let lAryQueryCondition
                if (req.query.type == 'all') {
                    lAryQueryCondition = {
                        $or: [
                            { "joinedMembers": ObjectId(req.user._id) },
                            { "createdUser": ObjectId(req.user._id) },
                        ]
                    };
                } else if (req.query.type == 'own') {
                    lAryQueryCondition = {
                        $or: [
                            { "createdUser": ObjectId(req.user._id) }
                        ]
                    }
                } else {
                    lAryQueryCondition = {
                        $and: [
                            { "createdUser": ObjectId(req.query.type) },
                            { "joinedMembers": ObjectId(req.user._id) }
                        ]
                    };
                }

                let queryParam = ''
                if (req.query.query) {
                    queryParam = req.query.query
                }
                var status = 1
                if (req.query.status) {
                    status = parseInt(req.query.status)
                }
                let lIntNoOfGroups = await FocusGroup.count({
                        $and: [
                            lAryQueryCondition,
                            {
                                groupstatus: { $eq: status }
                            }
                        ]
                    })
                    // if (req.query.sort == "asc") {
                    //   var dateParam = { updatedAt: 1 }
                    // } else {
                var dateParam = { updatedAt: -1 }
                    // }


                //FocusGroup
                console.log(lAryQueryCondition)
                let lAryFocusGroup = await FocusGroup.aggregate([{
                        $match: {
                            $and: [
                                lAryQueryCondition
                            ]
                        }

                    },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } },
                    {
                        $group: {
                            _id: "$_id",
                            "joinedMembers": {
                                "$push": {

                                    '_id': '$joinedMembers._id',
                                    'userName': '$joinedMembers.userName',
                                    'firstName': '$joinedMembers.firstName',
                                    'lastName': '$joinedMembers.lastName',
                                    'email': '$joinedMembers.email',
                                    "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }, ""] }
                                }
                            },
                            "invitedMembers": { $first: "$invitedMembers" },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: "$createdUser" },
                            "createdAt": { $first: "$createdAt" },
                            "screens": { $first: "$screens" }
                        }
                    },
                    {
                        $project: {
                            joinedMembers: 1,
                            _id: 1,
                            invitedMembers: 1,
                            groupName: 1,
                            groupstatus: 1,
                            description: 1,
                            createdUser: {
                                '_id': '$createdUser._id',
                                'userName': '$createdUser.userName',
                                'firstName': '$createdUser.firstName',
                                'lastName': '$createdUser.lastName',
                                'email': '$createdUser.email'
                            },
                            isHost: {
                                $cond: { if: { $eq: ["$createdUser", ObjectId(req.user._id)] }, then: true, else: false }
                            },
                            createdAt: 1,
                            screensCount: { $size: "$screens" },
                            screens: {
                                $filter: {
                                    input: "$screens",
                                    as: "screen",
                                    cond: { $gte: ["$$screen.screenStatus", 1] }
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            joinedMembers: 1,
                            _id: 1,
                            invitedMembers: 1,
                            groupName: 1,
                            groupstatus: 1,
                            description: 1,
                            createdUser: 1,
                            isHost: 1,
                            createdAt: 1,
                            screensCount: { $size: "$screens" },
                            screens: 1

                        }
                    },
                    { $match: { "groupName": { $regex: queryParam, "$options": "i" } } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "joinedMembers": { $first: "$joinedMembers" },
                            "invitedMembers": { $first: "$invitedMembers" },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: "$createdUser" },
                            "createdAt": { $first: "$createdAt" },
                            screensCount: { $first: "$screensCount" },
                            screens: {
                                $push: {
                                    "_id": '$screens._id',
                                    "image": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/screens/", "$screens.image"] }, ""] },
                                    "screenStatus": "$screens.screenStatus"
                                }
                            }
                        }
                    },
                    {
                        $addFields: {
                            screens: { $slice: ["$screens", 3] }
                        }
                    },
                    { $match: { groupstatus: { $eq: status } } },
                    { $sort: dateParam },
                    { $skip: skipRec },
                    { $limit: gIntDataPerPage }
                ])
                console.log(status)
                lAryFocusGroup = lAryFocusGroup.map(x => {
                    x.joinedMembers = (x.joinedMembers.length === 1 && !x.joinedMembers[0]._id) ? [] : x.joinedMembers;
                    return x;
                })
                for (let lObjRes of lAryFocusGroup) {
                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.filter(lObjRes.screens, function(v) {
                            return v.image;
                        });

                    }
                }
                // console.log("lAryFocusGroup", lAryFocusGroup)
                let archiveCount = await FocusGroup.count({
                    $and: [
                        lAryQueryCondition,
                        {
                            groupstatus: { $eq: 2 }
                        }
                    ]
                })
                let activeCount = await FocusGroup.count({
                    $and: [
                        lAryQueryCondition,
                        {
                            groupstatus: { $eq: 1 }
                        }
                    ]
                })

                let lObjFocsuGroup = {
                    focsuGroup: lAryFocusGroup,
                    total: Math.ceil(lIntNoOfGroups / gIntDataPerPage),
                    archiveCount: archiveCount,
                    activeCount: activeCount,
                    per_page: gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, lObjFocsuGroup, 'List of all focus groups');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        createNew: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    groupName: Joi.string().trim(),
                    description: Joi.string().trim().allow(''),
                    // invitedMembers: Joi.array(),
                    projectId: Joi.string().required(),
                    type: Joi.string().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                console.log(value, 'focusgroup values')
                value.createdUser = req.user._id; //Created User

                let lObjCheckUserGroupName = await FocusGroup.find({

                    $and: [{
                        createdUser: req.user._id,
                        groupName: req.body.groupName
                    }]

                })

                if (lObjCheckUserGroupName.length > 0) {
                    return Response.badValues(res, `Another focus group under the name ${req.body.groupName} already exists`);
                }
                await UserBadge.focusGroupPrticipated(req.user._id);
                let lObjFocusGroup;
                if (value.groupName) {
                    value.invitedMembers = [];
                    lObjFocusGroup = await FocusGroup.create(value)
                } else {
                    let check = await FocusGroup.find({
                        $and: [{
                            groupName: { $regex: 'Untitiled', $options: 'i' },
                            userId: req.user._id,
                            groupstatus: 1
                        }]
                    })

                    let value = {
                        groupName: `Untitiled${check.length + 1}`,
                        description: '',
                        userId: req.user._id,
                        invitedMembers: []
                    }
                    lObjFocusGroup = await FocusGroup.create(value)
                }

                //Invitation Email
                // for (let v of lObjFocusGroup.invitedMembers) {
                //   console.log(lObjFocusGroup.groupName)
                //   let mailData = {
                //     userName: req.user.userName,
                //     email: v.email,
                //     groupName: lObjFocusGroup.groupName,
                //     link: `${process.env.BASE_URL}focusgroup/${lObjFocusGroup._id}?token=${v.invitationToken}`
                //   }
                //   mailer.invitationEmail(mailData)
                // }

                await activityFeed.create({
                    projectId: req.body.projectId,
                    userId: req.user._id,
                    message: `${req.user.userName} has created ${lObjFocusGroup.groupName}`
                })

                let lAryChannels = [];
                lAryChannels.push((await User.findById(req.user._id).select('channelName')).channelName);

                pusherNotif.chatSocket(lAryChannels, output);
                return Response.success(res, lObjFocusGroup, `Your focus group ${lObjFocusGroup.groupName} has been created`);

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        shareLink: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim().required(),
                    status: Joi.number().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let focusGroup = await FocusGroup.findOne({
                    _id: value.focusGroupId
                });
                let isUserExistsInProjectTeamMembers = await ProjectTeamMember.exists({
                    projectId: focusGroup.projectId,
                    'projectTeamMember.userId': req.user._id
                });
                let checkStatus = await FocusGroup.find({
                    $and: [{
                        _id: ObjectId(req.body.focusGroupId)
                    }, {
                        groupstatus: { $ne: 0 }
                    }, {
                        $or: [{
                            joinedMembers: req.user._id
                        }, {
                            createdUser: req.user._id
                        }]
                    }]
                })

                if (checkStatus.length > 0 || isUserExistsInProjectTeamMembers) {
                    let updateStatus = await FocusGroup.findOneAndUpdate({ _id: ObjectId(req.body.focusGroupId) }, { $set: { status: req.body.status } })
                    let link = `${process.env.BASE_URL}focusgroup/${req.body.focusGroupId}`
                    return Response.success(res, '', `${checkStatus[0].groupName} has updated as ${req.body.status}`)
                } else {
                    return Response.badValues(res, 'Access Denied!!')
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        inviteMembers: async(req, res) => {
            try {
                let lObjFocusGroupId = req.params.groupId;
                let lAryRecentInvitedList = req.body.invitedMembers;

                let lObjFocusGroupDetail = await FocusGroup.aggregate([{
                        $match: { "_id": ObjectId(lObjFocusGroupId) },
                    },
                    { $lookup: { from: 'projectteammembers', localField: 'projectId', foreignField: 'projectId', as: 'projectTeamMembers' } },
                    // { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } }
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUsers' } },
                    { $unwind: { path: '$createdUsers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: {
                            $or: [
                                { createdUser: req.user._id },
                                { joinedMembers: req.user._id },
                                { 'invitedMembers.email': req.user.email },
                                { 'projectTeamMembers.projectTeamMember.email': req.user.email },
                            ]
                        }
                    }
                ])


                if (lObjFocusGroupDetail.length == 0) {
                    return Response.badValuesData(res, "You do not have the permission to invite a member to this focus group!!");
                }
                if ((lAryRecentInvitedList.length) > 0) {
                    let checkOwnGroup = await lAryRecentInvitedList.indexOf(lObjFocusGroupDetail[0].createdUsers.email)
                    if (checkOwnGroup != -1) {
                        return Response.badValuesData(res, "Members already is in Joined list");
                    }

                    lObjFocusGroupDetail[0].projectTeamMembers.forEach(async(v) => {
                        let teamMembers = await lAryRecentInvitedList.indexOf(v.projectTeamMember.email)
                        if (teamMembers != -1) {
                            return Response.badValuesData(res, "Project Team members can't be invited");
                        }
                    })

                }


                let checkExists = lObjFocusGroupDetail[0].invitedMembers;
                let joinedMembers = lObjFocusGroupDetail[0].joinedMembers;
                let Emails = [];
                let addEmail = [];
                for (let user of joinedMembers) {
                    let email = await User.findById(user).select('email');
                    Emails.push(email.email)
                }
                for (let user of checkExists) {
                    Emails.push(user.email)
                }
                let oldUsers = [];

                for (let user of lAryRecentInvitedList) {
                    let index = Emails.includes(user)
                    addEmail.push({
                        email: user,
                        invitedBy: req.user._id
                    })

                    if (index) {
                        oldUsers.push(index)
                    }
                }

                if (oldUsers.length > 0) {
                    return Response.badValuesData(res, "Members already is in Joined list");
                }

                let inviteMembers = await FocusGroup.findByIdAndUpdate({ _id: lObjFocusGroupId }, {
                    $push: {
                        invitedMembers: addEmail
                    }
                })

                if (req.body.removedMembers) {
                    for (let user of req.body.removedMembers) {
                        await FocusGroup.findOneAndUpdate({ _id: lObjFocusGroupId }, {
                            $pull: {
                                invitedMembers: { email: user }
                            }
                        })
                    }
                }

                // Send Email to all the user who are invited
                for (let v of lAryRecentInvitedList) {
                    let mailData = {
                        userName: req.user.userName,
                        email: v,
                        groupName: lObjFocusGroupDetail[0].groupName,
                        link: `${process.env.BASE_URL}focusgroup/${lObjFocusGroupId}`
                    }
                    mailer.invitationEmail(mailData);

                    //activity Feed
                    let createActivity = await activityFeed.create({
                        projectId: lObjFocusGroupDetail[0].projectId,
                        focusGroupId: lObjFocusGroupId,
                        userId: req.user._id,
                        message: ` invited ${v} to the Focus Group '${lObjFocusGroupDetail[0].groupName}'`,
                        type: 'activity'
                    })

                    let activity = await activityFeed.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${lObjFocusGroupId}`, activity)
                }

                await lAryRecentInvitedList.filter(async function(invite) {
                    console.log(invite, 'invite user')
                    let checkExists = await UserInvite.find({ userId: req.user._id, email: invite })
                    if (checkExists.length == 0) {
                        await UserInvite.create({
                            userId: req.user._id,
                            email: invite
                        })
                    }
                })

                let lObjFocusGroupRes = await FocusGroup.aggregate([{
                        $match: { "_id": ObjectId(lObjFocusGroupId) }
                    },
                    { $lookup: { from: 'projectteammembers', localField: 'projectId', foreignField: 'projectId', as: 'TeamMembers' } },
                    { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },

                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    {
                        $graphLookup: {
                            from: "users",
                            startWith: "$invitedMembers.email",
                            connectFromField: "invitedMembers.email",
                            connectToField: "email",
                            as: "invitedMemberDetails"
                        }
                    },
                    { $unwind: { path: "$invitedMemberDetails", 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "teamMembers": { $first: "$TeamMembers" },
                            "invitedMembers": {
                                "$push": {
                                    $cond: {
                                        if: { $ne: ["$invitedMembers", null] },
                                        then: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                            userName: "$invitedMemberDetails.userName",
                                            userId: "$invitedMemberDetails._id",
                                            firstName: "$invitedMemberDetails.firstName",
                                            lastName: "$invitedMemberDetails.lastName",
                                            invitationToken: '$invitedMembers.invitationToken',
                                            "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$invitedMemberDetails.profilePicture"] }, ""] }
                                        },
                                        else: {
                                            '_id': '$invitedMembers._id',
                                            'email': '$invitedMembers.email',
                                        },
                                    }
                                }
                            },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': { $first: "$joinedMembers" },
                            "createdAt": { $first: "$createdAt" }
                        }
                    },

                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "teamMembers": { $first: "$teamMembers" },
                            "invitedMembers": { $first: '$invitedMembers' },
                            "groupName": { $first: "$groupName" },
                            "groupstatus": { $first: "$groupstatus" },
                            "description": { $first: "$description" },
                            "createdUser": { $first: '$createdUser' },
                            'joinedMembers': {
                                "$push": {
                                    '_id': '$joinedMembers._id',
                                    'userName': '$joinedMembers.userName',
                                    'firstName': '$joinedMembers.firstName',
                                    'lastName': '$joinedMembers.lastName',
                                    'email': '$joinedMembers.email',
                                    "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }, ""] },
                                }
                            },
                            "createdAt": { $first: "$createdAt" },
                        }
                    }, {
                        $project: {
                            _id: "$_id",
                            "teamMembers": 1,
                            "invitedMembers": 1,
                            "groupName": 1,
                            "groupstatus": 1,
                            "description": 1,
                            "createdUser": {
                                '_id': '$createdUser._id',
                                'isAdmin': true,
                                'userName': '$createdUser.userName',
                                'firstName': '$createdUser.firstName',
                                'lastName': '$createdUser.lastName',
                                'email': '$createdUser.email',
                                'userId': '$createdUser._id',
                                "profilePicture": { $ifNull: ["", { $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }] },
                            },
                            'joinedMembers': 1,
                            "createdAt": 1,
                        }
                    }

                ])

                let createdUser = [{
                    _id: lObjFocusGroupRes[0].createdUser._id,
                    email: lObjFocusGroupRes[0].createdUser.email,
                    profilePicture: lObjFocusGroupRes[0].createdUser.profilePicture,
                    'isAdmin': true,
                    'firstName': lObjFocusGroupRes[0].createdUser.firstName,
                    'lastName': lObjFocusGroupRes[0].createdUser.lastName,
                    'userName': lObjFocusGroupRes[0].createdUser.userName,
                    'userId': lObjFocusGroupRes[0].createdUser._id,
                }]

                if (lObjFocusGroupRes[0].joinedMembers.length > 0) {
                    if (lObjFocusGroupRes[0].joinedMembers[0]._id == undefined) {
                        lObjFocusGroupRes[0].joinedMembers = []
                    }
                }

                if (lObjFocusGroupRes[0].invitedMembers.length > 0) {
                    if (lObjFocusGroupRes[0].invitedMembers[0]._id == undefined) {
                        lObjFocusGroupRes[0].invitedMembers = []
                    }
                }
                lObjFocusGroupRes = (lObjFocusGroupRes) ? lObjFocusGroupRes[0] : {}
                let teamMembersData = lObjFocusGroupRes.teamMembers.map(v => {
                    return v.projectTeamMember;
                })
                lObjFocusGroupRes["members"] = [...lObjFocusGroupRes.invitedMembers, ...lObjFocusGroupRes.joinedMembers, ...teamMembersData]

                delete lObjFocusGroupRes.invitedMembers;
                delete lObjFocusGroupRes.joinedMembers;

                let updateStatus = await FocusGroup.findOneAndUpdate({ _id: ObjectId(lObjFocusGroupId) }, { $set: { isPublic: req.body.isPublic } })

                let currentDate = moment().utc().format('');
                let notificationEmail = lObjFocusGroupDetail[0].projectTeamMembers.map(async(v) => {
                    let projectId = await Project.findOne({ _id: v.projectId, projectStatus: 1 }).select('userId');
                    if (v.projectTeamMember.userId.toString() !== req.user._id.toString()) {
                        let teamUsers = await TeamUsers.findOne({ email: v.projectTeamMember.userId, createdUser: projectId.userId }).sort({ planExpiryDate: -1 });
                        if (teamUsers != null) {
                            let teamUserPayment = await TeamUserPayment.findOne({ teamUserId: teamUsers._id }).sort({ endDate: -1 });
                            let subtract = moment(teamUserPayment.endDate).diff(currentDate, 'day');
                            if (subtract > 0) {
                                return v.projectTeamMember.email;
                            }
                        }
                    }
                });

                notificationEmail = await Promise.all(notificationEmail);

                notificationEmail = notificationEmail.filter(v => {
                    return v != undefined
                })

                notificationEmail = [...notificationEmail, ...lAryRecentInvitedList];
                /**
                 * Notification for accepting Focus Group Invite commented by Firnaas
                 */


                for (let i of notificationEmail) {
                    let userData = await User.findOne({ email: i })
                    if (userData) {
                        let lObjNotifData = await Notification.create({
                            'userId': userData._id,
                            'focusGroupId': lObjFocusGroupRes._id,
                            'projectId': (await FocusGroup.findOne({ _id: lObjFocusGroupId, groupstatus: 1 }).select('projectId')).projectId,
                            notificationType: 'focusGroupNotification',
                            message: `${req.user.userName} has invited ${userData.userName} to Focus Group ${lObjFocusGroupRes.groupName}.`
                        })
                        let lObjNotifChannel = userData.channelName
                        let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })
                        pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                    }
                }

                return Response.success(res, lObjFocusGroupRes, 'An invite has been sent to the user');
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        addScreenToFocusGroup: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim().required(),
                    screenId: Joi.array().required(),
                    screenName: Joi.string(),
                    projectId: Joi.string().required(),
                    projectScreenId: Joi.array().required()
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let projectTeamMembers = await ProjectTeamMember.find({ projectId: req.body.projectId });

                let checkUser = await FocusGroup.find({ _id: req.body.focusGroupId, "createdUser": { $in: projectTeamMembers.map(p => p.projectTeamMember.userId.toString()) }, groupstatus: 1 })
                if (!checkUser.length) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to change the screens!!" })
                }
                let screens = req.body.screenId;
                let projectScreenId = req.body.projectScreenId;
                let fgProjectScreen;

                for (let screen of screens) {
                    // for (let x of projectScreenId) {
                    let isScreenExsist = await FGScreen.findOne({ screenId: screen, focusGroupId: req.body.focusGroupId });
                    let projectSID = await ProjectScreen.findOne({ screenId: screen, projectId: req.body.projectId });
                    if (isScreenExsist == null) {
                        let detail = await Screens.findOne({ _id: screen, screenStatus: 1 });
                        fgProjectScreen = await FGScreen.create({
                            projectScreenId: projectSID._id,
                            focusGroupId: req.body.focusGroupId,
                            screenId: screen,
                            screenName: req.body.screenName,
                            sequence: detail.sequence,
                            description: detail.description
                        });
                    } else {
                        return Response.badValuesData(res, "Screens added already");
                    }
                    // }
                }

                // activity Feed for FG

                let createActivity = await Activity.create({
                    projectId: req.body.projectId,
                    userId: req.user._id,
                    message: `added ${screens.length} New screen(s) to ${checkUser[0].groupName}`,
                    type: 'activity'
                })
                let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                pusherNotif.activitySocket(`ch-${value.projectId}`, activity)

                return Response.success(res, fgProjectScreen, 'Screens created succesfully');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        createAnonymous: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    'email': Joi.string().required(),
                    'name': Joi.string().required(),
                    'focusGroupId': Joi.string().required()
                });

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let checkSignupUser = await User.find({ email: req.body.email });
                if (checkSignupUser.length > 0) {
                    return Response.badValuesData(res, "You are already registered user. if you want to continue please login");
                }

                let channelName = `FG-${crypto(6)}`;

                let checkExistsUser = await Anonymous.find({ email: req.body.email }).lean()

                if (checkExistsUser.length > 0) {
                    const { _id, userName, email, channelName } = checkExistsUser[0],
                        tokenData = { _id, email, userName, channelName };

                    var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                        expiresIn: 60 * 60 * 24
                    });

                    checkExistsUser[0].name = checkExistsUser[0].userName

                    lObjResponse = {
                        token: token,
                        data: checkExistsUser[0]
                    }
                    await FocusGroup.update({ _id: ObjectId(req.body.focusGroupId) }, {
                        $addToSet: { anonymousId: ObjectId(checkExistsUser[0]._id) }
                    })
                } else {

                    let data = {
                        userName: req.body.name,
                        email: req.body.email,
                        channelName: channelName
                    }
                    console.log(data, 'req data');
                    let createAnonymous = await Anonymous.create(data)
                    const { _id, userName, email } = createAnonymous.toObject(),
                        tokenData = { _id, email, userName, channelName };

                    var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                        expiresIn: 60 * 60 * 24
                    });

                    createAnonymous.name = createAnonymous.userName

                    lObjResponse = {
                        token: token,
                        data: {
                            _id: createAnonymous._id,
                            name: createAnonymous.name,
                            email: createAnonymous.email,
                            channelName: createAnonymous.channelName
                        }
                    }

                    await FocusGroup.update({ _id: ObjectId(req.body.focusGroupId) }, { $push: { anonymousId: ObjectId(createAnonymous._id) } })
                }
                Response.success(res, lObjResponse, 'Your account has been created!')
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        deleteScreens: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim(),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                FGScreen.deleteMany({
                    focusGroupId: req.params.focusGroupId,
                }, (err, result) => {
                    if (err) {
                        return Response.error(res, 400, err)
                    } else if (!!result) {
                        return Response.success(res, 'Screen Deleted successfully')
                    } else {
                        return Response.error(res, 400, "Screen not not deleted")
                    }
                });
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        createFG: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectId: Joi.string().trim().required(),
                    groupName: Joi.string(),
                    description: Joi.string(),
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let teamMembers = await ProjectTeamMember.find({
                    projectId: value.projectId,
                    'projectTeamMember.userId': req.user._id
                }).select('projectId').lean();

                for (let member of teamMembers) {
                    let lObgroupId = await FocusGroup.aggregate([{
                        $match: {
                            projectId: ObjectId(member.projectId),
                            groupStatus: 1,
                        }
                    }, { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } }, {
                        $project: {
                            // screensCount: { $size: "$screens" },
                            _id: 1,
                            screens: {
                                $filter: {
                                    input: "$screens",
                                    as: "screen",
                                    cond: { $gte: ["$$screen.screenStatus", 1] }
                                }
                            }

                        }
                    }])

                    if (lObgroupId.length > 0) {
                        if (lObgroupId[0].screens.length == 0) {
                            let lObjResult = {
                                _id: lObgroupId[0]._id
                            }
                            return Response.successEmpty(res, lObjResult, "There is an incomplete Focus Group!!");
                        }
                    }

                }
                let focusGroup;
                let notificationIds = [];

                let project = await Project.findOne({ _id: value.projectId }).lean();
                let projectCreatedby = await User.findOne({ _id: project.userId }).lean();
                let projectTeamMembers = await ProjectTeamMember.find({
                    projectId: value.projectId
                });

                if (value.groupName) {
                    let isFocusGroupAlreadyExist = await FocusGroup.exists({
                        projectId: ObjectId(value.projectId),
                        groupName: value.groupName,
                        groupstatus: 1
                    });

                    if (isFocusGroupAlreadyExist) {
                        return Response.badValues(res, `Another Focus Group under the name ${req.body.projectName} already exists`);
                    }
                    value.createdUser = req.user._id;
                    value.inviteMembers = [];
                    focusGroup = await FocusGroup.create(value);
                } else {
                    let projectNameArray = ["Blue", "Diamond", "Falcon", "Phoenix", "Eagle", "Lion"]
                    let rand = projectNameArray[Math.floor(Math.random() * projectNameArray.length)];
                    let focusGroups = await FocusGroup.find({
                        groupName: { $regex: `${rand}`, $options: 'i' },
                        projectId: ObjectId(req.body.projectId),
                        groupstatus: 1
                    });

                    let name = ""
                    if (focusGroups.length > 0) {
                        name = `${focusGroups.length}`;
                    }

                    focusGroup = await new FocusGroup({
                        groupName: `${rand}` + name,
                        description: value.description || '',
                        createdUser: project.userId,
                        /**Project Creted User Id for Focus created User */
                        invitedMembers: [],
                        projectId: ObjectId(value.projectId)
                    }).save();

                    if (projectTeamMembers.length > 0) {
                        let emails = [];
                        emails.push(projectCreatedby.email);
                        for (let member of projectTeamMembers) {
                            emails.push(member.projectTeamMember.email);
                        }

                        let mailData = {
                            projectName: project.projectName,
                            userName: req.user.firstName,
                            link: `${process.env.BASE_URL}focusgroup/${focusGroup._id}`,
                            emails,
                            groupName: focusGroup.groupName
                        }
                        mailer.fgCreationMail(mailData);
                    }

                    // activity Feed for FG

                    let createActivity = await Activity.create({
                        projectId: value.projectId,
                        userId: req.user._id,
                        message: `created a '${focusGroup.groupName} focus group'`,
                        type: 'activity'
                    })
                    let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${value.projectId}`, activity)
                }

                //chat socket
                let lAryChannels = [];
                lAryChannels.push((await User.findById(req.user._id).select('channelName')).channelName);
                pusherNotif.chatSocket(lAryChannels, focusGroup);

                /**
                 * Notification for FG Creation
                 */

                let projectTeam = await ProjectTeamMember.find({
                    projectId: req.body.projectId
                })
                let currentDate = moment().utc().format('');
                let notificationEmail = projectTeam.map(async(v) => {
                    let projectId = await Project.findOne({ _id: v.projectId, projectStatus: 1 }).select('userId');
                    if (v.projectTeamMember.userId.toString() !== req.user._id.toString()) {
                        let teamUsers = await TeamUsers.findOne({ email: v.projectTeamMember.userId, createdUser: projectId.userId }).sort({ planExpiryDate: -1 });
                        if (teamUsers != null) {
                            let teamUserPayment = await TeamUserPayment.findOne({ teamUserId: teamUsers._id }).sort({ endDate: -1 });
                            let subtract = moment(teamUserPayment.endDate).diff(currentDate, 'day');
                            if (subtract > 0) {
                                return v.projectTeamMember.email;
                            }
                        }
                    }
                });

                notificationEmail = await Promise.all(notificationEmail);

                notificationEmail = notificationEmail.filter(v => {
                    return v != undefined
                })

                notificationEmail = [...notificationEmail];

                for (let i of notificationEmail) {
                    let userData = await User.findOne({ email: i })
                    if (userData) {
                        let lObjNotifData = await Notification.create({
                            'userId': userData._id,
                            'focusGroupId': focusGroup._id,
                            'projectId': req.body.projectId,
                            notificationType: 'focusGroupNotification',
                            message: `${req.user.userName} has created a '${focusGroup.groupName} focus group.`
                        })
                        let lObjNotifChannel = userData.channelName
                        let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })
                        pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                    }
                }

                return Response.success(res, focusGroup, 'Focus Group created succesfully');

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        presenceAuth: async(req, res) => {
            var socketId = req.body.socket_id;
            var channelName = req.body.channel_name;
            // var user = await User.findOne({channelName: channel});
            // if(!user) {
            //   var user = await Anonymous.findOne({channelName: channel})
            // }
            let user = await jwt.verify(req.headers["x-access-token"], process.env.SUPER_SECRET)

            var channelData = {
                user_id: user._id,
                user_info: {
                    firstName: user.firstName,
                    userName: user.userName,
                    lastName: user.lastName,
                    channelName: user.channelName,
                    email: user.email
                }
            };
            var auth = await pusherNotif.authenticate(socketId, channelName, channelData);
            res.send(auth)
        },

        checkFocusgroupMapping: async(req, res) => {
            try {
                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 15 : parseInt(req.query.offset)

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let limit = Number(req.query.limit);
                let pageLimit;
                if (limit) {
                    pageLimit = limit;
                } else {
                    pageLimit = gIntDataPerPage;
                }

                let obj = {
                    $and: [{
                            createdUser: ObjectId(req.user._id)
                        },
                        {
                            projectId: { $exists: false }
                        },
                        {
                            groupstatus: { $eq: 1 }
                        }
                    ]
                }
                let checkFocusGroup = await FocusGroup.aggregate([
                    { $match: obj },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$_id',
                            groupName: { $first: '$groupName' },
                            description: { $first: '$description' },
                            invitedMembers: { $first: '$invitedMembers' },
                            groupStatus: { $first: '$groupstatus' },
                            createdUser: { $first: '$createdUser' },
                            createdAt: { $first: '$createdAt' },
                            screens: {
                                $addToSet: {
                                    _id: '$screens._id',
                                    screenName: '$screens.screenName',
                                    image: '$screens.image'
                                }
                            }
                        }
                    },
                    { $skip: skipRec },
                    { $limit: pageLimit }
                ])

                for (let focusgroup of checkFocusGroup) {
                    if (focusgroup.screens[0]._id) {
                        for (let screen of focusgroup.screens) {
                            if (screen._id) {
                                screen.image = `${process.env.CLOUDURL}screens/${screen.image}`
                            }
                        }
                    } else {
                        focusgroup.screens = []
                    }
                    focusgroup['screensCount'] = await focusgroup.screens.length
                }

                return Response.success(res, checkFocusGroup, 'Focus group list')

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        mapFGToProject: async(req, res) => {
            try {
                let Projects = require('../project/project.model')
                let focusGroupId = req.body.focusGroupId;
                let projectId = req.body.projectId;

                let checkProject = await Projects.findOne({ _id: ObjectId(projectId), projectStatus: { $ne: 0 } })
                if (!checkProject) {
                    return Response.badValuesData(res, 'You could not map this project')
                }

                for (let focusgroup of focusGroupId) {
                    await FocusGroup.update({ _id: focusgroup }, { $set: { projectId: projectId } })
                }

                return Response.success(res, 'Focusgroup mapped to project successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = focusGroupComponentCtrl()