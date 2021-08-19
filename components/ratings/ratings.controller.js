require("dotenv").config();
const Comments = require('../comments/comments.model');
const Ratings = require('./ratings.model');
const Screens = require('../screens/screens.model');
const RatingsType = require('../ratingType/ratingType.model');
const Response = require('../../utils/response');
const FocusGroup = require('../focusGroup/focusGroup.model');
const Notification = require('../notification/notification.model');
const Chat = require('../chat/chat.model')
const mongoose = require('mongoose');
const Joi = require('joi');
const jwt = require('jsonwebtoken')
const mailer = require('../../utils/mailService')
const _ = require('lodash');
const ObjectId = mongoose.Types.ObjectId;
const User = require('../user/user.model');
const pusherNotif = require('../../utils/pusher')
const Anonymous = require('../anonymous/anonymous.model');
const projectTeam = require('../project/projectTeamMember.model');
const fgScreen = require('../focusGroup/fgProjectScreen.model');
let gIntDataPerPage = 10;

let ratingValues = new Map();
ratingValues.set('designThinking', 'Design Thinking');
ratingValues.set('easeOfUse', 'Ease of Use');
ratingValues.set('aesthetics&visual', 'Aesthetics & Visual');


function avgAggregate(screenId) {
    return [
        { $match: { screenId: ObjectId(screenId) } },
        {
            $lookup: {
                from: 'ratingtypes',
                localField: 'ratingTypeId',
                foreignField: '_id',
                as: 'ratingTypeId'
            }
        },
        { $unwind: '$ratingTypeId' },
        {
            $group: {
                _id: {
                    screenId: ObjectId(screenId),
                    vote: { $avg: '$vote' }
                }
            }
        },
        { $project: { "_id": 0, vote: "$_id.vote" } }
    ]
}

async function updateAverage(avgCmt, screenId) {
    console.log("updateAverage*******")
    let obj = {};

    let lIntSum = _.sumBy(avgCmt, 'vote');
    obj['avgRating'] = Math.round(lIntSum / 3);

    //Get how many number of users vote for this specific screen and update the value in screen collection
    obj['noOfVotes'] = await Ratings.aggregate([
        { $match: { 'screenId': ObjectId(screenId) } },
        { $group: { _id: "$userId" } }
    ])
    obj['noOfVotes'] = obj['noOfVotes'].length
    return obj;
}

function validateSchema(input, obj) {
    let { error } = Joi.validate(input, Joi.object().keys(obj));

    if (error)
        return _.map(error.details, "message");
}

function commentComponentCtrl(model) {
    const methods = {
        ratings: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required(),
                    'page': Joi.string().required(),
                    'limit': Joi.string().required()
                };

                let error = validateSchema(req.query, validate);
                if (error) return Response.badValuesData(res, error);

                gIntDataPerPage = (req.query.offset && req.query.offset != 0) ? parseInt(gIntDataPerPage) : req.query.offset == 0 ? 10 : 10;
                let page = req.query.page;
                let skipRec = page - 1;

                let condition = {};
                condition["screenId"] = ObjectId(req.query.screenId);

                let lObjQueryCondition = (req.params.type !== 'all') ? {
                    name: ratingValues.get(req.params.type)
                } : {};

                if ((req.params.type !== 'all')) {
                    let lObjCommentTypeId = await RatingsType.findOne(lObjQueryCondition).lean();
                    condition["ratingTypeId"] = ObjectId(lObjCommentTypeId._id);
                }

                let totalCount = await Ratings.count({ screenId: req.query.screenId });
                let ratings = await Ratings.find(condition).sort({ _id: -1 }).skip(skipRec).limit(gIntDataPerPage);

                let ObjResponse = {
                    ratings: ratings,
                    total: Math.ceil(totalCount / gIntDataPerPage),
                    per_page: gIntDataPerPage,
                    currentPage: page
                }

                return Response.success(res, ObjResponse, 'Ratings');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        postRatingFG: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required(),
                    'ratingType': Joi.string().required(),
                    "parentId": Joi.string().trim().allow(''),
                    'focusgroupId': Joi.string().trim().allow(''),
                };

                let error = validateSchema(req.body, validate);
                if (error) return Response.badValuesData(res, error);

                let screenId = req.body.screenId;
                let userId;
                let user;
                let lArrFocusGroupId = await fgScreen.findOne({ "screenId": req.body.screenId }).lean()

                if (lArrFocusGroupId == null) {
                    lArrFocusGroupId = await fgScreen.findOne({ "screenId": req.body.parentId }).lean();
                }

                let lObjCheckOwnedGroup = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId, groupstatus: 2 })
                if (lObjCheckOwnedGroup) return Response.forbiddenError(res, "You can't give ratings on the Archived group!!")

                // let lAryTotalMembers;
                let getFocusGroupDetails = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId });

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
                        listinviteMembers.push(mem._id);
                    }
                }

                let lArrayJoinedMenebersId = lJoinedMembers.map(x => {
                    return x._id
                })
                let lAryTotalMembers = [...lArrayJoinedMenebersId, getFocusGroupDetails.createdUser._id, ...listinviteMembers].map(String)

                if (getFocusGroupDetails.isPublic == false) {

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
                    await getFocusGroupDetails.invitedMembers.filter((userDetails) => {
                        if (user.email == userDetails.email) {
                            emailResult.push(userDetails)
                        }
                    })

                    let lResult = lAryTotalMembers.includes(user._id.toString())

                    if (!lResult && emailResult.length == 0) return Response.forbiddenError(res, "Access Denied, If you want to share your Ratings please join this group first");

                    let v = req.body.ratingType
                    let comment = await Ratings.findOneAndUpdate({
                        'screenId': screenId,
                        'focusGroupId': req.body.focusgroupId,
                        'userId': userId
                    }, {
                        $set: {
                            'screenId': screenId,
                            'focusGroupId': req.body.focusgroupId,
                            'userId': userId,
                            'ratingTypeId': v,
                            'vote': 1,
                            'mailSent': 0
                        }
                    }, { upsert: true, new: true })

                } else {
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let accessToken = req.headers['x-access-token'];
                    let decode = await jwt.verify(accessToken, process.env.SUPER_SECRET);
                    user = await decode;
                    let checkUser = await User.find({ _id: ObjectId(user._id) })

                    if (checkUser.length > 0) {
                        console.log('existing user')
                        let v = req.body.ratingType
                        let comment = await Ratings.findOneAndUpdate({
                            'screenId': screenId,
                            'focusGroupId': req.body.focusgroupId,
                            'userId': user._id
                        }, {
                            $set: {
                                'screenId': screenId,
                                'userId': user._id,
                                'focusGroupId': req.body.focusgroupId,
                                'ratingTypeId': v,
                                'vote': 1,
                                'mailSent': 0
                            }
                        }, { upsert: true, new: true })
                        console.log(comment, "Commnetsssss")

                    } else {
                        console.log('anonymous user')
                        let v = req.body.ratingType

                        let comment = await Ratings.findOneAndUpdate({
                            'screenId': screenId,
                            'focusGroupId': req.body.focusgroupId,
                            'anonymousId': user._id
                        }, {
                            $set: {
                                'screenId': screenId,
                                'focusgroupId': req.body.focusgroupId,
                                'anonymousId': user._id,
                                'ratingTypeId': v,
                                'vote': 1,
                                'mailSent': 0
                            }
                        }, { upsert: true, new: true })

                    }
                }
                let rating = await Ratings.aggregate([
                    { $match: { "screenId": ObjectId(screenId), 'focusGroupId': ObjectId(req.body.focusgroupId), } },
                    { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                    { $unwind: '$ratingTypeId' },
                    // { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    // { $unwind: '$userId' },
                    {
                        $group: {
                            _id: { "screenId": "$screenId", ratingTypeId: '$ratingTypeId._id' },
                            'ratingTypeId': { $first: '$ratingTypeId' },
                            "count": { $sum: 1 }
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            "ratings": {
                                "$push": {
                                    'ratingType': '$ratingTypeId.name',
                                    'ratingId': '$ratingTypeId._id',
                                    "vote": "$count"
                                }
                            },

                        }
                    }

                ])
                console.log(rating[0])
                rating = rating[0].ratings
                    // let ratings = [];
                    // await rating.filter(async rate => {
                    //   await delete rate._id;
                    //   let data = await rate.ratings[0];
                    //   console.log(data)
                    //   ratings.push(data)
                    // })

                // let data = await { ratings }
                return Response.success(res, rating, 'Rating Posted Successfully');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        postRating: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required(),
                    'ratings': Joi.array().required()
                };

                let error = validateSchema(req.body, validate);
                if (error) return Response.badValuesData(res, error);

                let screenId = req.body.screenId;
                let userId;
                let user;
                let lArrFocusGroupId = await Screens.findOne({ "_id": req.body.screenId }).populate({
                    path: "focusGroupId",
                    populate: {
                        path: 'joinedMembers'
                    }
                }).lean()

                let lObjCheckOwnedGroup = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId._id, groupstatus: 2 })
                if (lObjCheckOwnedGroup) return Response.forbiddenError(res, "You can't give ratings on the Archived group!!")

                let getFocusGroupDetails = await FocusGroup.findOne({ _id: lArrFocusGroupId.focusGroupId })

                let lJoinedMembers = lArrFocusGroupId.focusGroupId.joinedMembers;

                let lArrayJoinedMenebersId = lJoinedMembers.map(x => {
                    return x._id
                })
                let lAryTotalMembers = [...lArrayJoinedMenebersId, lArrFocusGroupId.focusGroupId.createdUser].map(String)

                if (getFocusGroupDetails.isPublic == false) {

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
                    await getFocusGroupDetails.invitedMembers.filter((user) => {
                        if (user.email == user.email) {
                            emailResult.push(user)
                        }
                    })

                    let lResult = lAryTotalMembers.includes(user._id.toString())

                    if (!lResult && emailResult.length == 0) return Response.forbiddenError(res, "Access Denied, If you want to share your Ratings please join this group first");

                    let lObjFirstRating = await Ratings.find({ 'screenId': screenId, 'userId': userId })
                    let lObjFocusGroupId = '';
                    for (let v of req.body.ratings) {

                        let comment = await Ratings.findOneAndUpdate({
                            'screenId': screenId,
                            'userId': userId,
                            'ratingTypeId': v["ratingTypeId"]
                        }, {
                            $set: {
                                'screenId': screenId,
                                'userId': userId,
                                'ratingTypeId': v["ratingTypeId"],
                                'comment': v["comment"],
                                'vote': v["vote"]
                            }
                        }, { upsert: true, new: true })
                        let avgCmt = await Ratings.aggregate(avgAggregate(screenId)).sort({ _id: -1 });
                        if (avgCmt.length != 0) {
                            let updateQuery = await updateAverage(avgCmt, screenId)
                            comment = await Screens.findOneAndUpdate({ _id: screenId }, { $set: updateQuery }, { new: true });
                            lObjFocusGroupId = comment.focusGroupId;
                        }
                    }
                } else {
                    if (!req.headers['x-access-token']) {
                        return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                    }
                    let accessToken = req.headers['x-access-token'];
                    let decord = await jwt.verify(accessToken, process.env.SUPER_SECRET);
                    user = await decord;
                    let checkUser = await User.find({ _id: ObjectId(user._id) })

                    if (checkUser.length > 0) {
                        console.log('existing user')
                        let lObjFocusGroupId = '';
                        for (let v of req.body.ratings) {
                            let comment = await Ratings.findOneAndUpdate({
                                'screenId': screenId,
                                'userId': user._id,
                                'ratingTypeId': v["ratingTypeId"]
                            }, {
                                $set: {
                                    'screenId': screenId,
                                    'userId': user._id,
                                    'ratingTypeId': v["ratingTypeId"],
                                    'comment': v["comment"],
                                    'vote': v["vote"]
                                }
                            }, { upsert: true, new: true })
                            let avgCmt = await Ratings.aggregate(avgAggregate(screenId)).sort({ _id: -1 });
                            if (avgCmt.length != 0) {
                                let updateQuery = await updateAverage(avgCmt, screenId)
                                comment = await Screens.findOneAndUpdate({ _id: screenId }, { $set: updateQuery }, { new: true });
                                lObjFocusGroupId = comment.focusGroupId;
                            }
                        }
                    } else {
                        console.log('anonymous user')
                        let lObjFocusGroupId = '';
                        for (let v of req.body.ratings) {

                            let comment = await Ratings.findOneAndUpdate({
                                'screenId': screenId,
                                'anonymousId': user._id,
                                'ratingTypeId': v["ratingTypeId"]
                            }, {
                                $set: {
                                    'screenId': screenId,
                                    'anonymousId': user._id,
                                    'ratingTypeId': v["ratingTypeId"],
                                    'comment': v["comment"],
                                    'vote': v["vote"]
                                }
                            }, { upsert: true, new: true })
                            let avgCmt = await Ratings.aggregate(avgAggregate(screenId)).sort({ _id: -1 });
                            if (avgCmt.length != 0) {
                                let updateQuery = await updateAverage(avgCmt, screenId)
                                comment = await Screens.findOneAndUpdate({ _id: screenId }, { $set: updateQuery }, { new: true });
                                lObjFocusGroupId = comment.focusGroupId;
                            }
                        }
                    }
                }

                let updateFocusGroup = await FocusGroup.updateOne({ _id: lArrFocusGroupId.focusGroupId._id }, {
                    $set: {
                        $currentDate: {
                            updatedAt: true
                        }
                    }
                })
                let lAryRatings = await Ratings.aggregate([
                    { $match: { "screenId": ObjectId(screenId) } },
                    { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                    { $unwind: '$ratingTypeId' },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    { $unwind: '$userId' },
                    { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                    { $unwind: '$screenId' },
                    { $lookup: { from: 'anonymous', localField: 'anonymousId', foreignField: '_id', as: 'anonymous' } },
                    { $unwind: { path: '$anonymous', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: { "screenId": "$screenId._id", "userId": "$userId._id" },
                            "ratings": {
                                "$push": {
                                    'ratingType': '$ratingTypeId.name',
                                    'ratingId': '$ratingTypeId._id',
                                    'comment': '$comment',
                                    'vote': '$vote',
                                    'date': '$createdAt',
                                    'color': '$ratingTypeId.colorCode',
                                    'pointerBg': '$ratingTypeId.pointerBg'
                                }
                            },
                            "createdAt": { $first: '$screenId.createdAt' },
                            userId: {
                                $addToSet: {
                                    _id: '$userId._id',
                                    userName: '$userId.userName',
                                    firstName: '$userId.firstName',
                                    lastName: '$userId.lastName'
                                }
                            },
                            anonymousId: {
                                $addToSet: {
                                    _id: '$anonymous._id',
                                    name: '$anonymous.userName',
                                    email: '$anonymous.email'
                                }
                            },
                            avgRating: { $avg: "$vote" },
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.userId',
                            screenId: { $first: '$_id.screenId' },
                            createdAt: { $first: '$createdAt' },
                            anonymousId: { $first: '$anonymousId' },
                            ratings: { $first: "$ratings" },
                            "userId": { $first: '$userId' },
                            avgRating: { $first: "$avgRating" }
                        }
                    }
                ])
                let avg = _.meanBy(lAryRatings, 'avgRating');
                let lFloatAvgRating = avg ? avg.toFixed(1) : 0.0;
                let myRating = [];
                lAryRatings = lAryRatings.map(x => {
                    x.userId = x.userId[0];
                    x.anonymousId = x.anonymousId[0]
                        // if(String(x.userId) == String(user._id)) {                                        
                        //  delete x._id
                        //   myRating.push(x);
                        // }
                    x.avgRating = x.avgRating ? x.avgRating.toFixed(1) : 0.0;
                    return x;
                })
                let lObjRatingData = {
                        "ratings": lAryRatings,
                        "noOfVotes": lAryRatings.length,
                        "overAllRating": parseFloat(lFloatAvgRating)
                    }
                    /**************************/

                lAryTotalMembers = lAryTotalMembers.map(x => {
                    if (x !== user._id.toString()) return x;
                })
                lAryTotalMembers = _.compact(lAryTotalMembers)

                let lInvitedMembers = lArrFocusGroupId.focusGroupId.invitedMembers;
                let listInvitedMembers = [];
                for (let user of lInvitedMembers) {
                    let channel = await User.findOne({ email: user.email })

                    if (channel) {
                        listInvitedMembers.push(channel.channelName)
                    }

                }

                let lAryChannels = [];
                lAryChannels = [...listInvitedMembers]
                if (getFocusGroupDetails.isPublic == true) {
                    let channels = []
                    let anonymousChannels = getFocusGroupDetails.anonymousId;
                    for (let anonymous of anonymousChannels) {
                        channels.push(anonymous.channelName)
                    }
                    lAryChannels = [...lAryChannels, ...channels]
                }

                for (let i of lAryTotalMembers) {
                    let lNotify = []
                        // if (lObjFirstRating.length == 0) {
                    var lObjNotifData = await Notification.create({
                        'userId': i,
                        'focusGroupId': lArrFocusGroupId.focusGroupId._id,
                        notificationType: 'addRating',
                        message: `${user.userName} has posted new rating.`,
                        createdUser: req.user._id
                    })

                    lNotify.push((await User.findById(i).select('channelName')).channelName)
                    lAryChannels = [...lAryChannels, ...lNotify];
                    lNotifyMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })

                    pusherNotif.sendNotification(lNotify, lNotifyMsg);
                    // }
                }
                console.log(lAryChannels, 'channels')

                let membersMails = lArrFocusGroupId.focusGroupId.joinedMembers;
                let group = await FocusGroup.find({ _id: ObjectId(lArrFocusGroupId.focusGroupId._id) }).lean()
                let groupName = group[0].groupName
                let id = lArrFocusGroupId.focusGroupId._id;

                for (let email of membersMails) {
                    let tokenData = { id, groupName }
                    let expiry = '30 days'
                    let token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                        expiresIn: expiry
                    });

                    let mailData = {
                            email: email.email,
                            userName: email.userName,
                            groupName: groupName,
                            url: `${process.env.BASE_URL}focusgroup/${id}`
                        }
                        // mailer.invitationEmail(mailData)
                }

                pusherNotif.sendratings(lAryChannels, lObjRatingData)
                    /**************************/

                return Response.success(res, lObjRatingData, 'Rating Posted Successfully');
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        },
        postProjectRating: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required(),
                    'ratings': Joi.array().required()
                };

                let error = validateSchema(req.body, validate);
                if (error) return Response.badValuesData(res, error);
                let lObjCommentDisable = await Screens.find({ _id: ObjectId(req.body.screenId) })
                if (lObjCommentDisable[0].disableComments == true) {
                    return Response.forbiddenError(res, "Comments are not accepted for this screen")
                }
                let screenId = req.body.screenId;
                let userId = req.user._id;
                let lObjBody = {
                    screenId: screenId,
                    userId: userId
                }
                let lObjFirstRating = await Ratings.find({ 'screenId': screenId, 'userId': userId })
                let lObjCommentId
                if (lObjFirstRating.length == 0) {
                    let lObjComment = await Comments.create(lObjBody)
                    lObjCommentId = lObjComment._id
                } else {
                    lObjCommentId = lObjFirstRating[0].commentId
                }
                for (let v of req.body.ratings) {

                    let comment = await Ratings.findOneAndUpdate({
                        'screenId': screenId,
                        'userId': userId,
                        'ratingTypeId': v["ratingTypeId"]
                    }, {
                        $set: {
                            'screenId': screenId,
                            'userId': userId,
                            'ratingTypeId': v["ratingTypeId"],
                            'comment': v["comment"],
                            'vote': v["vote"],
                            'commentId': lObjCommentId
                        }
                    }, { upsert: true, new: true })
                    let avgCmt = await Ratings.aggregate(avgAggregate(screenId)).sort({ _id: -1 });
                    if (avgCmt.length != 0) {
                        let updateQuery = await updateAverage(avgCmt, screenId)
                        comment = await Screens.findOneAndUpdate({ _id: screenId }, { $set: updateQuery }, { new: true });
                        lObjFocusGroupId = comment.focusGroupId;
                    }
                }

                let lAryRatings = await Ratings.aggregate([
                    { $match: { "screenId": ObjectId(screenId) } },
                    { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                    { $unwind: '$ratingTypeId' },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    { $unwind: '$userId' },
                    { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                    { $unwind: '$screenId' },
                    {
                        $group: {
                            _id: { "screenId": "$screenId._id", "userId": "$userId._id" },
                            "ratings": {
                                "$push": {
                                    'ratingType': '$ratingTypeId.name',
                                    'ratingId': '$ratingTypeId._id',
                                    'comment': '$comment',
                                    'vote': '$vote',
                                    'date': '$createdAt',
                                    'color': '$ratingTypeId.colorCode',
                                    'pointerBg': '$ratingTypeId.pointerBg'
                                }
                            },
                            "createdAt": { $first: '$screenId.createdAt' },
                            "userId": { $first: '$userId._id' },
                            "userName": { $first: '$userId.userName' },
                            avgRating: { $avg: "$vote" },
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.userId',
                            screenId: { $first: '$_id.screenId' },
                            createdAt: { $first: '$createdAt' },
                            userName: { $first: "$userName" },
                            ratings: { $first: "$ratings" },
                            "userId": { $first: '$userId' },
                            avgRating: { $first: "$avgRating" }
                        }
                    }
                ])
                let avg = _.meanBy(lAryRatings, 'avgRating');
                let lFloatAvgRating = avg ? avg.toFixed(1) : 0.0;

                lAryRatings = lAryRatings.map(x => {
                    x.avgRating = x.avgRating ? x.avgRating.toFixed(1) : 0.0;
                    return x;
                })
                let lObjRatingData = {
                    "ratings": lAryRatings,
                    "noOfVotes": lAryRatings.length,
                    "overAllRating": parseFloat(lFloatAvgRating)
                }
                pusherNotif.postratings('notification', lObjRatingData)
                return Response.success(res, lObjRatingData, 'Rating Posted Successfully');
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        },
        updateRating: async(req, res) => {
            try {
                if (!req.params.screenId) return Response.badValuesData(res, 'screenId missing');
                let validate = {
                    ratings: Joi.array()
                };

                let { error, value } = Joi.validate(req.body, validate);
                if (error) {
                    let lAryMessge = _.map(error.details, "message");
                    return Response.badValuesData(res, lAryMessge);
                }

                let screenDetails = await Screens.findOne({ _id: ObjectId(req.params.screenId) })
                console.log(screenDetails, 'screen details')
                for (let v of req.body.ratings) {
                    let condition = {
                        _id: v._id,
                        userId: req.user._id
                    };

                    let updateCmt = await Ratings.findOneAndUpdate(condition, {
                        $set: v
                    }, { new: true });

                    let avgCmt = await Ratings.aggregate(avgAggregate(req.params.screenId)).sort({ _id: -1 });
                    if (avgCmt.length != 0) {
                        let updateQuery = await updateAverage(avgCmt, req.params.screenId)
                        updateCmt = await Screens.findOneAndUpdate({ _id: req.params.screenId }, { $set: updateQuery }, { new: true });
                    }
                }
                updateCmt = await Screens.findById(req.params.screenId)
                return Response.success(res, updateCmt, 'Rating Updated Successfully');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        deleteRating: async(req, res) => {
            try {
                let validate = {
                    'screenId': Joi.string().alphanum().length(24).required()
                };

                let error = validateSchema(req.params, validate);
                if (error) return Response.badValuesData(res, error);

                let deleteCmt = await Ratings.deleteMany({ screenId: req.params.screenId, userId: req.user._id });

                if (deleteCmt != null) {
                    let avgCmt = await Ratings.aggregate(avgAggregate(req.params.screenId)).sort({ _id: -1 });

                    if (avgCmt.length != 0) {
                        let updateQuery = await updateAverage(avgCmt, req.params.screenId)
                        await Screens.findOneAndUpdate({ _id: screenId }, { $set: updateQuery }, { new: true });
                    }

                    return Response.success(res, {}, 'Rating Deleted Successfully');
                } else
                    return Response.message(res, 503, 'No data deleted');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        listAllRatingsType: async(req, res) => {
            try {
                let lAryRatingsType = await RatingsType.find().lean()
                return Response.success(res, lAryRatingsType, 'Ratings Type');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        getMyScreenRatings: async(req, res) => {
            try {

                let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET)

                let userId = decoded._id;
                let userDetails = await User.find({ _id: userId });
                let lAryRatings;

                if (userDetails.length > 0) {

                    lAryRatings = await Ratings.aggregate([{
                            $match: {
                                "screenId": ObjectId(req.params.screenId),
                                "userId": ObjectId(userId),
                                "focusGroupId": ObjectId(req.query.focusgroupId)
                            }
                        },
                        // {
                        //   $group: {
                        //     _id: "$screenId",
                        //     "ratings": {
                        //       "vote": "$vote",
                        //       "ratingTypeId": "$ratingTypeId",
                        //       "_id": "$_id"

                        //     }
                        //   }
                        // }, 
                        {
                            $project: { _id: 1, "ratingTypeId": 1, "vote": 1, "screenId": 1 }
                        }
                    ])
                } else {
                    lAryRatings = await Ratings.aggregate([{
                            $match: {
                                "screenId": ObjectId(req.params.screenId),
                                "anonymousId": ObjectId(userId),
                                "focusGroupId": ObjectId(req.query.focusgroupId)
                            }
                        },
                        // {
                        //   $group: {
                        //     _id: "$screenId",
                        //     "ratings": {
                        //       "vote": "$vote",
                        //       "ratingTypeId": "$ratingTypeId",
                        //       "_id": "$_id"

                        //     }
                        //   }
                        // }, 
                        {
                            $project: { _id: 1, "ratingTypeId": 1, "vote": 1, "screenId": 1 }
                        }
                    ])
                }


                return Response.success(res, lAryRatings[0] || {}, 'My Ratings');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },

        getAllCurrentScreenRatings: async(req, res) => {
            try {
                console.log("getAllCurrentScreenRatings")
                let lObjScreenId = ObjectId(req.params.screenId);
                let lAryRatings = await Ratings.aggregate([
                    { $match: { "screenId": lObjScreenId } },
                    { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                    { $unwind: '$ratingTypeId' },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    { $unwind: '$userId' },
                    { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                    { $unwind: '$screenId' },
                    {
                        $group: {
                            _id: { "screenId": "$screenId._id", "userId": "$userId._id" },
                            "ratings": {
                                "$push": {
                                    'ratingType': '$ratingTypeId.name',
                                    'ratingId': '$ratingTypeId._id',
                                    'comment': '$comment',
                                    'vote': '$vote',
                                    'date': '$createdAt',
                                    'color': '$ratingTypeId.colorCode',
                                    'pointerBg': '$ratingTypeId.pointerBg'
                                }
                            },
                            "createdAt": { $first: '$createdAt' },
                            userId: {
                                $addToSet: {
                                    _id: '$userId._id',
                                    userName: '$userId.userName',
                                    firstName: '$userId.firstName',
                                    lastName: '$userId.lastName'
                                }
                            },
                            avgRating: { $sum: "$vote" },
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.userId',
                            screenId: { $first: '$_id.screenId' },
                            createdAt: { $first: '$createdAt' },
                            ratings: { $first: "$ratings" },
                            "userId": { $first: '$userId' },
                            count: { $first: "$avgRating" }
                        }
                    }
                ])

                for (let user of lAryRatings) {
                    user.userId = user.userId[0]
                }

                let anonymousRating = await Ratings.aggregate([
                    { $match: { "screenId": lObjScreenId, anonymousId: { $exists: true } } },
                    { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                    { $unwind: '$ratingTypeId' },
                    { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                    { $unwind: '$screenId' },
                    { $lookup: { from: 'anonymous', localField: 'anonymousId', foreignField: '_id', as: 'anonymous' } },
                    { $unwind: { path: '$anonymous', "preserveNullAndEmptyArrays": true } },
                    {
                        $group: {
                            _id: { "screenId": "$screenId._id", "anonymousId": "$anonymous._id" },
                            "ratings": {
                                "$push": {
                                    'ratingType': '$ratingTypeId.name',
                                    'ratingId': '$ratingTypeId._id',
                                    'comment': '$comment',
                                    'vote': '$vote',
                                    'date': '$createdAt',
                                    'color': '$ratingTypeId.colorCode',
                                    'pointerBg': '$ratingTypeId.pointerBg'
                                }
                            },
                            "createdAt": { $first: '$createdAt' },
                            anonymousId: {
                                $addToSet: {
                                    _id: '$anonymous._id',
                                    name: '$anonymous.userName'
                                }
                            },
                            avgRating: { $avg: "$vote" },
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.anonymousId',
                            screenId: { $first: '$_id.screenId' },
                            createdAt: { $first: '$createdAt' },
                            ratings: { $first: "$ratings" },
                            "anonymousId": { $first: '$anonymousId' },
                            avgRating: { $first: "$avgRating" }
                        }
                    }
                ])

                for (let user of anonymousRating) {
                    user.anonymousId = user.anonymousId[0]
                }

                lAryRatings = [...lAryRatings, ...anonymousRating]
                let avg = _.meanBy(lAryRatings, 'avgRating');
                let lFloatAvgRating = avg ? avg.toFixed(1) : 0.0;

                lAryRatings = lAryRatings.map(x => {
                    x.avgRating = x.avgRating ? x.avgRating.toFixed(1) : 0.0;
                    return x;
                })
                let lObjRatingData = {
                    "ratings": lAryRatings,
                    "noOfVotes": lAryRatings.length,
                    "overAllRating": parseFloat(lFloatAvgRating)
                }

                return Response.success(res, lObjRatingData, 'Ratings');
            } catch (err) {
                return Response.errorInternal(err, res);
            }
        },
        getAllCurrentFGScreenRatings: async(req, res) => {
            try {
                let lObjScreenId = req.params.screenId;
                let parentId = req.query.parentId;
                let fgId = req.query.focusgroupId;
                console.log(fgId, ":WERTYUIOSDFGHJKL")
                if (Object.keys(req.query.parentId).length !== 0) {
                    let lObjRating = await Ratings.aggregate([
                        { $match: { "screenId": ObjectId(lObjScreenId), focusGroupId: ObjectId(fgId) } },
                        { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $lookup: { from: 'screenversions', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                        { $unwind: '$screenId' },
                        { $unwind: '$ratingTypeId' },
                        {
                            $group: {
                                _id: { "screenId": "$screenId._id", "ratingId": "$ratingTypeId._id" },
                                'ratingId': { $first: '$ratingTypeId._id' },

                                count: { $sum: "$vote" },
                            }
                        },
                        {
                            $group: {
                                _id: '$_id',
                                screenId: { $first: '$_id.screenId' },
                                ratingId: { $first: "$ratingId" },
                                count: { $first: "$count" }
                            }
                        }
                    ])
                    let userDetails = await Ratings.aggregate([
                        { $match: { "screenId": ObjectId(lObjScreenId), focusGroupId: ObjectId(fgId) } },
                        { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $lookup: { from: 'screenversions', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                        { $unwind: '$screenId' },
                        { $unwind: '$ratingTypeId' },
                        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                        { $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'anonymous', localField: 'anonymousId', foreignField: '_id', as: 'anonymous' } },
                        { $unwind: { path: '$anonymous', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: { "screenId": "$screenId._id", "ratingId": "$ratingTypeId._id", 'userId': '$userId._id' },
                                'ratingId': { $first: '$ratingTypeId._id' },
                                "createdAt": { $first: '$createdAt' },
                                userId: {
                                    $first: {
                                        _id: '$userId._id',
                                        userName: '$userId.userName',
                                        firstName: '$userId.firstName',
                                        lastName: '$userId.lastName'
                                    }
                                },
                                anonymousId: {
                                    $first: {
                                        _id: '$anonymous._id',
                                        name: '$anonymous.userName',
                                        email: '$anonymous.email'
                                    }
                                },
                            }
                        },
                        {
                            $group: {
                                _id: '$_id',
                                screenId: { $first: '$_id.screenId' },
                                createdAt: { $first: '$createdAt' },
                                anonymousId: { $first: "$anonymousId" },
                                ratingId: { $first: "$ratingId" },
                                "userId": { $first: '$userId' }
                            }
                        },
                        {
                            $project: {
                                screenId: 1,
                                createdAt: 1,
                                ratingId: 1,
                                userId: 1,
                                anonymousId: 1
                            }

                        }
                    ])
                    let resultObj = {
                        count: lObjRating,
                        ratings: userDetails
                    }

                    return Response.success(res, resultObj, 'All Ratings');

                } else {

                    let lObjRating = await Ratings.aggregate([
                        { $match: { "screenId": ObjectId(lObjScreenId), focusGroupId: ObjectId(fgId) } },
                        { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                        { $unwind: '$screenId' },
                        { $unwind: '$ratingTypeId' },
                        {
                            $group: {
                                _id: { "screenId": "$screenId._id", "ratingId": "$ratingTypeId._id" },
                                'ratingId': { $first: '$ratingTypeId._id' },

                                count: { $sum: "$vote" },
                            }
                        },
                        {
                            $group: {
                                _id: '$_id',
                                screenId: { $first: '$_id.screenId' },
                                ratingId: { $first: "$ratingId" },
                                count: { $first: "$count" }
                            }
                        }
                    ])
                    let userDetails = await Ratings.aggregate([
                        { $match: { "screenId": ObjectId(lObjScreenId), focusGroupId: ObjectId(fgId) } },
                        { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                        { $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screenId' } },
                        { $unwind: '$screenId' },
                        { $unwind: '$ratingTypeId' },
                        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                        { $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'anonymous', localField: 'anonymousId', foreignField: '_id', as: 'anonymous' } },
                        { $unwind: { path: '$anonymous', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: { "screenId": "$screenId._id", "ratingId": "$ratingTypeId._id", 'userId': '$userId._id' },
                                'ratingId': { $first: '$ratingTypeId._id' },
                                "createdAt": { $first: '$createdAt' },
                                userId: {
                                    $first: {
                                        _id: '$userId._id',
                                        userName: '$userId.userName',
                                        firstName: '$userId.firstName',
                                        lastName: '$userId.lastName'
                                    }
                                },
                                anonymousId: {
                                    $first: {
                                        _id: '$anonymous._id',
                                        name: '$anonymous.userName',
                                        email: '$anonymous.email'
                                    }
                                },
                            }
                        },
                        {
                            $group: {
                                _id: '$_id',
                                screenId: { $first: '$_id.screenId' },
                                createdAt: { $first: '$createdAt' },
                                anonymousId: { $first: "$anonymousId" },
                                ratingId: { $first: "$ratingId" },
                                "userId": { $first: '$userId' }
                            }
                        },
                        {
                            $project: {
                                screenId: 1,
                                createdAt: 1,
                                ratingId: 1,
                                userId: 1,
                                anonymousId: 1
                            }

                        }
                    ])
                    let resultObj = {
                        count: lObjRating,
                        ratings: userDetails
                    }
                    return Response.success(res, resultObj, 'All Ratings');
                }
            } catch (error) {
                return Response.errorInternal(error, res);
            }
        },

        listOfRatings: async(req, res) => {
            try {

                let ratings = await Ratings.aggregate([
                    { $match: { mailSent: 0 } },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userDetails' } },
                    { $unwind: { path: '$userDetails', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$screenId',
                            ratingId: { $first: '$_id' },
                            userDetails: {
                                $push: {
                                    name: '$userDetails.firstName',
                                    mailSent: '$mailSent',
                                    email: '$userDetails.email',
                                    userId: '$userDetails._id'
                                }
                            }
                        }
                    },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: '_id', as: 'screenDetails' } },
                    { $unwind: { path: '$screenDetails', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'focusgroups', localField: 'screenDetails.focusGroupId', foreignField: '_id', as: 'focusgroupDetails' } },
                    { $unwind: { path: '$focusgroupDetails', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'projects', localField: 'focusgroupDetails.projectId', foreignField: '_id', as: 'Projects' } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'Projects.projectStatus': 1 } },
                    { $sort: { 'Projects.createdAt': -1 } }
                ]);

                let userData = {};
                ratings.forEach(async(element) => {
                    if (element.focusgroupDetails) {
                        userData.screenName = element.screenDetails.screenName;
                        userData.groupName = element.focusgroupDetails.groupName;
                        userData.name = element.userDetails[0].name;
                        let userCount = element.userDetails.length - 1;
                        userData.emails = element.userDetails.map(v => {
                            return v.email;
                        });
                        userData.emails = userData.emails.filter(x => {
                            return x != undefined;
                        })
                        userData.projectName = element.Projects.projectName;
                        let len = element.userDetails.length;
                        if (len > 5) {
                            mailer.focusGroupRatingEmail(userData);
                            await Ratings.findOneAndUpdate({ _id: element.ratingId }, { mailSent: 1 })

                            // Notification for ratings
                            for (let i of element.userDetails) {
                                let lNotify;
                                var lObjNotifData = await Notification.create({
                                    'userId': i.userId,
                                    'focusGroupId': element.focusgroupDetails._id,
                                    notificationType: 'generalNotification',
                                    message: `${userData.name} and ${userCount} others has posted rating in ${userData.groupName} group for the screen ${userData.screenName}.`,
                                })

                                lNotify = ((await User.findById(i.userId).select('channelName')).channelName);
                                lNotifyMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })
                                pusherNotif.sendNotification(lNotify, lNotifyMsg);
                            }
                        }
                    }

                })

                return Response.success(res, ratings, 'All Ratings');
            } catch (error) {
                return Response.errorInternal(error, res);
            }
        }
    }
    return Object.freeze(methods);
}

module.exports = commentComponentCtrl();