const Response = require('../../utils/response');
const Chat = require('../chat/chat.model');
const unreadChat = require('../chat/unreadchat.model');
const Screen = require('../screens/screens.model');
const User = require('../user/user.model')
const Joi = require('joi');
const FocusGroup = require('../focusGroup/focusGroup.model');
const _ = require('lodash');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const jwt = require('jsonwebtoken')
const mailer = require('../../utils/mailService')
const Notification = require('../notification/notification.model');
const fgScreens = require('../focusGroup/fgProjectScreen.model');
const projectTeam = require('../project/projectTeamMember.model');
const pusherNotif = require('../../utils/pusher')
const userChatrack = require('../chatcountrack/chatcountrack.model')
const Anonymous = require('../anonymous/anonymous.model')
let moment = require('moment');

let gIntDataPerPage = 10;

async function unReadChatCount(fg, onlineMembers) {
    let membersData = await FocusGroup.aggregate([
        { $match: { _id: ObjectId(fg) } },
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
        { $lookup: { from: 'projectteammembers', localField: 'projectId', foreignField: 'projectId', as: 'projectTeamMembers' } },
        { $unwind: { path: '$projectTeamMembers', 'preserveNullAndEmptyArrays': true } },
        { $lookup: { from: 'users', localField: 'projectTeamMembers.projectTeamMember.userId', foreignField: '_id', as: 'teamMember' } },
        { $unwind: '$teamMember' },
        {
            $group: {
                _id: "$_id",
                "joinedMembers": {
                    "$addToSet": {
                        '_id': '$joinedMembers._id'
                    }
                },
                "invitedMembers": {
                    "$addToSet": {
                        $cond: {
                            if: { $ne: ["$invitedMembers._id", null] },
                            then: {
                                '_id': '$invitedMembers._id'
                            },
                            else: {
                                '_id': '$invitedMembers._id'
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
                "teamMembers": {
                    "$addToSet": {
                        '_id': '$teamMember._id',
                    }
                }
            }
        },
    ]);

    membersData = membersData[0];

    let tM, inM;
    if (membersData.teamMembers.length > 0) {
        tM = membersData.teamMembers.map(v => {
            return v._id;
        });
    }

    if (membersData.invitedMembers.length > 0) {
        inM = membersData.invitedMembers.map(v => {
            return v._id;
        })
    }

    membersData = [...tM, ...inM];

    membersData = membersData.filter(v => {
        return v !== undefined;
    })

    for (let x of onlineMembers) {
        for (let y of membersData) {
            if (x.toString() !== y.toString()) {
                let data = await unreadChat.findOne({ focusgroupId: fg, userId: y });
                if (data == null) {
                    let obj = {
                        focusgroupId: fg,
                        userId: y,
                        count: 1
                    }
                    let datass = await unreadChat.create(obj);
                } else {
                    let count = data.count + 1;
                    let datass = await unreadChat.findOneAndUpdate({
                        focusgroupId: fg,
                        userId: y
                    }, {
                        $set: {
                            count: count
                        }
                    })
                }
            }
        }
    }
}

function componentOneCtrl() {
    const methods = {
        /*
          Chating in the Focus Group Members
          Input: screenId
         */
        startChat: async(req, res) => {
            console.log("Start Chat")

            try {
                const validate = Joi.object().keys({
                    'screenId': Joi.string().alphanum().length(24).required(),
                    'parentId': Joi.string().trim().allow(''),
                    'focusgroupId': Joi.string().trim().allow(''),
                    'message': Joi.string().required(),
                    'anonymousId': Joi.string(),
                    'onlineMembers': Joi.array().allow('')
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, validate);

                if (error) {
                    let lAryMessge = _.map(error.details, "message");
                    return Response.badValuesData(res, lAryMessge);
                }

                let onlineMembers = req.body.onlineMembers;

                let focusGroupDetails = await fgScreens.findOne({ "screenId": ObjectId(req.body.screenId) });
                if (focusGroupDetails == null) {
                    focusGroupDetails = await fgScreens.findOne({ "screenId": ObjectId(req.body.parentId) });
                }
                let focusGroupStatus = await FocusGroup.findOne({ _id: ObjectId(focusGroupDetails.focusGroupId) })



                if (focusGroupStatus.isPublic == false) {

                    let accessToken = req.headers['x-access-token'];
                    let decord = await jwt.verify(accessToken, process.env.SUPER_SECRET);
                    let user = await User.findOne({ _id: ObjectId(decord._id) });
                    if (!user) {
                        return Response.forbiddenError(res, { message: 'Access Denied, If you want to share your comment please login first!!!' })
                    }

                    //Check whether the user is a member or not in focus group

                    let lAryCheckMemberOrNot;
                    let memberDetail = await fgScreens.findOne({ "screenId": ObjectId(req.body.screenId) });
                    if (memberDetail == null) {
                        lAryCheckMemberOrNot = await fgScreens.aggregate([
                            { $match: { screenId: ObjectId(req.body.parentId) } },
                            { $lookup: { from: 'focusgroups', localField: 'focusGroupId', foreignField: '_id', as: 'focusGroupId' } },
                            { $unwind: '$focusGroupId' },
                            { $lookup: { from: 'projectteammembers', localField: 'focusGroupId.projectId', foreignField: 'projectId', as: 'projectTeamMembers' } },
                            { $unwind: { path: '$projectTeamMembers', 'preserveNullAndEmptyArrays': true } },
                            {
                                $match: {
                                    $or: [{
                                            "focusGroupId.joinedMembers": {
                                                $in: [ObjectId(user._id)]
                                            }
                                        }, {
                                            "focusGroupId.createdUser": ObjectId(user._id)
                                        }, {
                                            "focusGroupId.invitedMembers.email": user.email
                                        },
                                        {
                                            "projectTeamMembers.projectTeamMember.email": user.email
                                        }
                                    ]
                                }
                            }
                        ]);
                    } else {
                        lAryCheckMemberOrNot = await fgScreens.aggregate([
                            { $match: { screenId: ObjectId(req.body.screenId) } },
                            { $lookup: { from: 'focusgroups', localField: 'focusGroupId', foreignField: '_id', as: 'focusGroupId' } },
                            { $unwind: '$focusGroupId' },
                            { $lookup: { from: 'projectteammembers', localField: 'focusGroupId.projectId', foreignField: 'projectId', as: 'projectTeamMembers' } },
                            { $unwind: { path: '$projectTeamMembers', 'preserveNullAndEmptyArrays': true } },
                            {
                                $match: {
                                    $or: [{
                                            "focusGroupId.joinedMembers": {
                                                $in: [ObjectId(user._id)]
                                            }
                                        }, {
                                            "focusGroupId.createdUser": ObjectId(user._id)
                                        }, {
                                            "focusGroupId.invitedMembers.email": user.email
                                        },
                                        {
                                            "projectTeamMembers.projectTeamMember.email": user.email
                                        }
                                    ]
                                }
                            }
                        ]);
                    }


                    if (lAryCheckMemberOrNot.length === 0) return Response.forbiddenError(res, "Access Denied, If you want to share your comment please join this group first");
                    let updateFocusGroup = await FocusGroup.updateOne({ _id: lAryCheckMemberOrNot[0].focusGroupId._id }, {
                        $set: {
                            $currentDate: {
                                updatedAt: true
                            }
                        }
                    })

                    // let focusGroupId = await fgScreens.findOne({ "screenId": ObjectId(req.body.screenId) }).select('focusGroupId').lean()

                    value.userId = user._id;
                    value.focusgroupId = req.body.focusgroupId;
                    let lAryRes = await Chat.create(value);

                    let a = {};

                    for (const key in lAryRes) {
                        if (lAryRes.hasOwnProperty(key)) {
                            const element = lAryRes[key];
                            a[key] = element;
                        }
                    }
                    a._doc.userId = {
                        '_id': user._id,
                        "userName": user.userName,
                        "firstName": user.firstName,
                        "lastName": user.lastName
                    }
                    a._doc.focusGroupId = focusGroupStatus._id
                    lAryCheckMemberOrNot = lAryCheckMemberOrNot[0];
                    let lAryChannels = [];
                    let teamMembers = await projectTeam.find({ projectId: ObjectId(focusGroupStatus.projectId) }).select('projectTeamMember');
                    teamMembers = teamMembers.map(v => {
                        return v.projectTeamMember.userId;
                    });
                    //Notification(For Socket Purpose)
                    let lAryTotalMembers = [...lAryCheckMemberOrNot.focusGroupId.joinedMembers, lAryCheckMemberOrNot.focusGroupId.createdUser, ...teamMembers] //Send notification to all members in a group including created user
                    lAryTotalMembers = lAryTotalMembers.map(x => {
                        if (x.toString() !== user._id.toString()) return x;
                    }); // Notification won't be send to the user who posted the chat


                    lAryTotalMembers = _.compact(lAryTotalMembers)
                    let inviteMembers = focusGroupStatus.invitedMembers;

                    for (let i of inviteMembers) {
                        if (user.email != i.email) {
                            let channel = await User.find({ email: i.email });

                            if (channel.length > 0) {
                                lAryChannels.push(channel[0].channelName);
                            }
                        }
                    }
                    console.log(lAryChannels, 'bedore')
                    console.log(lAryTotalMembers, 'members')
                    for (let i of lAryTotalMembers) {
                        lAryChannels.push((await User.findById(i).select('channelName')).channelName);
                    }
                    console.log(lAryChannels, 'channel')
                    let _id = lAryCheckMemberOrNot.focusGroupId._id;
                    let groupName = lAryCheckMemberOrNot.focusGroupId.groupName
                    let tokenData = { _id, groupName }
                    let expiry = '30 days'
                    let token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                        expiresIn: expiry
                    });

                    let joinedMembersMailId = await FocusGroup.find({ _id: ObjectId(_id) })
                    let mails = joinedMembersMailId[0].joinedMembers;

                    pusherNotif.chatSocket(lAryChannels, lAryRes);

                    // unread chat count -  per user - per FG
                    let fgId = req.body.focusgroupId
                    unReadChatCount(fgId, onlineMembers);

                    return Response.success(res, lAryRes, "chat");

                } else {
                    console.log('anonymous user')
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let accessToken = req.headers['x-access-token'];
                    let decord = await jwt.verify(accessToken, process.env.SUPER_SECRET);
                    let user = await decord;

                    let checkUser = await User.find({ _id: ObjectId(user._id) })

                    if (checkUser.length > 0) {
                        value.userId = user._id
                    } else {
                        value.anonymousId = user._id;
                    }
                    let focusGroupId = await fgScreens.findOne({ "screenId": ObjectId(req.body.screenId) }).select('focusGroupId').lean();
                    if (focusGroupId == null) {
                        focusGroupId = await fgScreens.findOne({ "screenId": ObjectId(req.body.parentId) });
                    }
                    let focusGroupStatus = await FocusGroup.findOne({ _id: ObjectId(focusGroupId.focusGroupId) })
                    let projectTeams = await FocusGroup.findOne({ _id: ObjectId(focusGroupId.focusGroupId) }).select('projectId');
                    let teamMembers = await projectTeam.find({ projectId: ObjectId(projectTeams.projectId) }).select('projectTeamMember');

                    let lAryRes = await Chat.create(value);
                    let a = {};

                    for (const key in lAryRes) {
                        if (lAryRes.hasOwnProperty(key)) {
                            const element = lAryRes[key];
                            a[key] = element;
                        }
                    }
                    a._doc.focusGroupId = focusGroupId.focusGroupId

                    if (checkUser.length > 0) {
                        a._doc.userId = {
                            '_id': user._id,
                            "userName": user.userName,
                            "firstName": checkUser[0].firstName,
                            "lastName": checkUser[0].lastName
                        }
                    } else {
                        a._doc.anonymousId = {
                            '_id': user._id,
                            "name": user.userName,
                            "email": user.email
                        }
                    }

                    let lAryChannels = [];
                    let inviteMembers = focusGroupStatus.invitedMembers;
                    let joinedMembers = focusGroupStatus.joinedMembers;
                    let anonymousMembers = focusGroupStatus.anonymousId;
                    let createduser = focusGroupStatus.createdUser;

                    if (user._id != createduser.email) {
                        let createdUserChannel = await User.find({ email: createduser.email }).select('channelName');
                        lAryChannels.push(createdUserChannel[0].channelName);
                    }

                    for (let i of inviteMembers) {
                        if (user.email != i.email) {
                            let channel = await User.find({ email: i.email }).select('channelName');

                            if (channel.length > 0) {
                                lAryChannels.push(channel[0].channelName);
                            }
                        }
                    }
                    for (let i of joinedMembers) {
                        let channel = await User.find({ _id: i }).select('channelName');
                        lAryChannels.push(channel[0].channelName);
                    }
                    for (let i of anonymousMembers) {
                        if (user.email != i.email) {
                            lAryChannels.push(i.channelName);
                        }
                    }

                    for (let x of teamMembers) {
                        if (createduser._id != x.projectTeamMember.id) {
                            let data = await User.find({ email: x.projectTeamMember.email }).select('channelName');
                            lAryChannels.push(data[0].channelName);
                        }
                    }
                    console.log(lAryChannels, 'channels')
                    pusherNotif.chatSocket(lAryChannels, lAryRes);

                    return Response.success(res, lAryRes, "chat");
                }
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        /*
          List of all chats in particular screen in FocusGroup
         */
        listAllChatForSpecifiedScreen: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required(),
                    'focusgroupId': Joi.string().trim().allow(''),
                };

                let { error, value } = Joi.validate(req.params, validate);
                if (error) {
                    let lAryMessge = _.map(error.details, "message");
                    return Response.badValuesData(res, lAryMessge);
                }

                //Pagination
                let page = req.query.page || 1;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let fgId = req.query.focusgroupId

                let lAryChat = await Chat.find({ screenId: req.params.screenId, 'focusgroupId': fgId }).populate('userId', 'firstName lastName userName email').populate('anonymousId', 'userName email').lean()
                let dlAryChat = await Chat.aggregate([{
                        $match: {
                            screenId: ObjectId(req.params.screenId),
                            'focusgroupId': ObjectId(fgId)
                        }
                    },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    { $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true } },
                ]);

                await lAryChat.filter((chat) => {
                    if (chat.userId) {
                        chat.userId = {
                            "_id": chat.userId._id,
                            "userName": chat.userId.userName,
                            "email": chat.userId.email,
                            "firstName": chat.userId.firstName,
                            "lastName": chat.userId.lastName,
                            "userId": chat.userId._id
                        }
                    }
                    if (chat.anonymousId) {
                        chat.anonymousId = {
                            _id: chat.anonymousId._id,
                            name: chat.anonymousId.userName,
                            email: chat.anonymousId.email,
                            userId: chat.anonymousId._id
                        }
                    }

                })

                return Response.success(res, lAryChat, "chat list");
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        /**
         * Consolidated mail for chats 
         */

        listOfChats: async(req, res) => {
            try {
                let chats = await Chat.aggregate([
                    { $match: { mailSent: 0 } },
                    { $sort: { 'createdAt': -1 } },
                    {
                        $group: {
                            _id: '$screenId',
                            message: {
                                $push: {
                                    chat: '$message',
                                    userId: '$userId',
                                    chatId: '$_id'
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
                            message: { $first: "$message" },
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
                            message: { $first: "$message" },
                            mailSent: { $first: "$mailSent" },
                            // screenName: { $last: "$Screens.screenName" },
                            focusGroupDetail: {
                                $first: {
                                    focusGroupId: "$FocusGroups._id",
                                    projectId: "$FocusGroups.projectId",
                                    focusGroupName: "$FocusGroups.groupName",
                                    invitedMembers: "$FocusGroups.invitedMembers",
                                    joinedMembers: "$FocusGroups.joinedMembers",
                                    anonymousId: "$FocusGroups.anonymousId",
                                    projectTeamMembers: "$FocusGroups.projectTeamMembers"
                                }

                            }

                        }
                    },
                ])
                let userData = {};
                chats.forEach(element => {
                    let data = element.focusGroupDetail;
                    let emailDatas = [].concat(data.invitedMembers, data.joinedMembers, data.projectTeamMembers);
                    userData.groupName = element.focusGroupDetail.focusGroupName;
                    userData.chatCount = element.message.length;
                    userData.emails = emailDatas;
                    if ((userData.chatCount) > 5) {
                        mailer.focusGroupChatEmail(userData);
                        element.message.map(async(v) => {
                            await Chat.findOneAndUpdate({ _id: v.chatId }, { mailSent: 1 })
                        })
                    }
                })



                // return Response.success(res, chats, "chat list");
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        }

    }
    return Object.freeze(methods)
}



module.exports = componentOneCtrl()