let Projects = require('../project/project.model');
let Focusgroup = require('../focusGroup/focusGroup.model')
let Response = require('../../utils/response')
let TeamUsers = require('../teamUsers/teamUsers.model');
let Users = require('../user/user.model');
let Hotspot = require('../hotspot/hotspot.model');
let Ticket = require('../hotspot/ticketAssign.model');
let HotspotAction = require('../hotspotActions/hotspotAction.model');
let Screens = require('../screens/screens.model');
let Items = require('../flaggedItems/flaggedItems.model');
let moment = require('moment');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const _ = require('lodash');
const Joi = require('joi');
const ProjectTeamMember = require('../project/projectTeamMember.model');
const unreadChat = require('../chat/unreadchat.model');
const ProjectScreen = require('../project/projectScreen.model');
// const errorLog = require('../../utils/errorLogging');

function dashBoardController() {
    const Methods = {
        getMyProjects: async(req, res) => {
            try {
                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                let currentDate = moment().utc().format('');
                let projectDetails = await ProjectTeamMember.aggregate([{
                        $match: {
                            'projectTeamMember.userId': req.user._id
                        }
                    },
                    { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projects" } },
                    { $unwind: { path: '$projects', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'projects.projectStatus': 1 } },
                    // { $lookup: { from: "teamusers", localField: "projectTeamMember.email", foreignField: "email", as: "teamUsers" } },
                    // { $unwind: { path: '$teamUsers', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "teamuserpayments", localField: "teamUsers.lastPaymentId", foreignField: "_id", as: "teamUserPayments" } },
                    // { $unwind: { path: '$teamUserPayments', 'preserveNullAndEmptyArrays': true } },
                    // {
                    //     $group: {
                    //         // _id: "$_id",
                    //         // "projectName": { $first: "$projectName" },
                    //         // "description": { $first: "$description" },
                    //         // "createdAt": { $first: "$createdAt" },
                    //         // "userId": { $first: "$userId" },
                    //         // 'teamUsers': { $first: '$teamUsers.email' },
                    //         // "teamMembers": { $push: "$teamMembers" }
                    //     }
                    // },
                    { $lookup: { from: "project_screens", localField: "projectId", foreignField: "projectId", as: "project_screens" } },
                    { $unwind: { path: '$project_screens', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'project_screens.forfocusgroup': false } },
                    { $lookup: { from: "screens", localField: "project_screens.screenId", foreignField: "_id", as: "screens" } },

                    // {
                    //     "$project": {
                    //         "projectName": 1,
                    //         "industry": 1,
                    //         "createdAt": 1,
                    //         "description": 1,
                    //         "userId": 1,
                    //         "teamMembers": 1,
                    //         "views_size": { "$size": "$screens" },
                    //         "screens": 1,
                    //     }
                    // },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    // { $match: { 'screens.screenStatus': 1 } },
                    {
                        $group: {
                            _id: "$projectId",
                            "projectName": { $first: "$projects.projectName" },
                            "description": { $first: "$projects.description" },
                            "createdAt": { $first: "$projects.createdAt" },
                            "userId": { $first: "$projects.userId" },
                            // 'planExpiryDate': { $first: '$teamUserPayments.endDate' },
                            "count": { "$first": "$views_size" },
                            screens: {
                                $push: {
                                    "_id": '$screens._id',
                                    image: {
                                        $cond: {
                                            if: { $eq: ['$screens.inspire', false] },
                                            then: { $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$screens.image"] }, ""] },
                                            else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$screens.image"] }, ""] }
                                        }
                                    },
                                    "screenStatus": "$screens.screenStatus"
                                }
                            }
                        }
                    },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "projectCreatedUser" } },
                    { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $project: {
                            _id: 1,
                            projectName: 1,
                            description: 1,
                            createdAt: 1,
                            userId: 1,
                            // planExpiryDate: 1,
                            count: { "$size": "$screens" },
                            screens: 1,
                            projectCreatedUser: {
                                "_id": "$projectCreatedUser._id",
                                "firtsName": "$projectCreatedUser.firtsName",
                                "lastName": "$projectCreatedUser.lastName",
                                "email": "$projectCreatedUser.email",
                                "userName": "$projectCreatedUser.userName",
                                "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$projectCreatedUser.profilePicture"] }, ""] },
                            }
                        }
                    },
                    {
                        $sort: { "createdAt": -1 }
                    },
                    { $skip: skipRec },
                    { $limit: pageLimit },
                ])

                let subtract;
                for (let project of projectDetails) {
                    let lObjFocusGroupCount = await Focusgroup.find({ projectId: project._id, groupstatus: 1 }).select('groupName').lean()
                        // let lObjTeamMmeberCount = await Projects.count({ projectId: project._id })
                    if (!project.screens[0]._id) {
                        project.screens = [];
                    }
                    let fgCount = {
                        count: lObjFocusGroupCount.length,
                        items: lObjFocusGroupCount
                    }
                    project.fgCount = fgCount
                    project.screens = project.screens.filter(v => {
                        if (v._id != null || v._id != undefined) {
                            return v.screenStatus !== 0;
                        }
                    })


                    let userId = project.userId;
                    let projectTeamMember = await ProjectTeamMember.find({ projectId: project._id }).sort({ createdAt: 1 }).lean();
                    projectTeamMember = projectTeamMember.filter(v => {
                        return v.projectTeamMember.userId.toString() != userId.toString();
                    });

                    for (let x of projectTeamMember) {
                        x.userId = x.projectTeamMember;
                        delete x.projectTeamMember;
                        let data_user = await Users.findOne({ _id: x.userId.userId }).lean();
                        x.userId.lastName = data_user.lastName;
                        x.userId.profilePicture = data_user.profilePicture;
                        x.userId.userName = data_user.userName;
                        let data = await TeamUsers.find({ email: x.userId.email, createdUser: userId }).sort({ planExpiryDate: -1 });
                        if (data.length > 0) {
                            for (let y of data) {
                                x.endDate = y.planExpiryDate;
                            }
                        }
                    }
                    project.teamMember = projectTeamMember;
                }

                //payment removal
                // projectDetails = projectDetails.filter((project) => {
                //     let userId = (req.user._id).toString();
                //     let projectUserId = (project.userId).toString();
                //     if (userId === projectUserId) {
                //         return project;
                //     } else {
                //         for (let x of project.teamMember) {
                //             if (x.hasOwnProperty("endDate") && x.endDate !== null) {
                //                 subtract = moment(x.endDate).diff(currentDate, 'day')
                //                 if (subtract >= 0) {
                //                     return project;
                //                 }
                //             } else {
                //                 return project;
                //             }
                //         }
                //     }
                // })

                // let lIntNoOfGroups = await Projects.count({ _id: req.user._id, projectStatus: 1 });

                let lIntNoOfGroups = await ProjectTeamMember.aggregate([{
                        $match: { "projectTeamMember.userId": req.user._id }
                    },
                    { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'projects' } },
                    { $unwind: { path: '$projects', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'projects.projectStatus': 1 } },
                    {
                        $group: {
                            _id: "$projects._id",
                            count: { $sum: 1 }
                        }
                    }
                ])

                lIntNoOfGroups = lIntNoOfGroups.filter(v => {
                    return v._id != null
                })


                if (projectDetails === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    let lObjIndusty = {
                        items: projectDetails,
                        total: Math.round(projectDetails.length / (limit ? limit : gIntDataPerPage)),
                        totalProjects: projectDetails.length,
                        per_page: limit ? limit : gIntDataPerPage,
                        currentPage: page
                    }

                    return Response.success(res, lObjIndusty, "Project Details")
                }

            } catch (err) {
                // if (Object.keys(err).length === 0) {
                //     msg = 'Oops! error occured'
                //     errorLog.errorLogging(req, res, msg);
                // } else {
                //     errorLog.errorLogging(req, res, err);
                // }

                return Response.errorInternal(err, res)
            }
        },
        getMyFocusgroup: async(req, res) => {
            try {
                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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
                let lAryQueryCondition;
                if (req.query.type == 'all') {
                    lAryQueryCondition = {
                        $or: [
                            { "joinedMembers": req.user._id },
                            { "invitedMembers.email": req.user.email },
                            { "createdUser": req.user._id },
                        ]
                    };
                } else if (req.query.type == 'own') {
                    lAryQueryCondition = {
                        $or: [
                            { "createdUser": req.user._id }
                        ]
                    }
                } else {
                    lAryQueryCondition = {
                        $and: [
                            { "createdUser": req.query.type },
                            {
                                $or: [{ "invitedMembers.email": req.user.email },
                                    { "joinedMembers": req.user._id }
                                ]
                            }
                        ]
                    };
                }

                let focusGroupList = await Focusgroup.aggregate([{
                        $match: {
                            $and: [
                                lAryQueryCondition
                            ]
                        }

                    },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'joinedMembers', foreignField: '_id', as: 'joinedMembers' } },
                    { $unwind: { path: '$joinedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'invitedMembers.email', foreignField: 'email', as: 'invitedMembers' } },
                    { $unwind: { path: '$invitedMembers', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'createdUser', foreignField: '_id', as: 'createdUser' } },
                    { $unwind: '$createdUser' },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } },
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
                                    "profilePicture": { $ifNull: ["", { $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$joinedMembers.profilePicture"] }] }
                                }
                            },
                            "invitedMembers": {
                                "$addToSet": {
                                    '_id': '$invitedMembers._id',
                                    'userName': '$invitedMembers.userName',
                                    'firstName': '$invitedMembers.firstName',
                                    'lastName': '$invitedMembers.lastName',
                                    'email': '$invitedMembers.email',
                                    "profilePicture": { $ifNull: ["", { $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$invitedMembers.profilePicture"] }] }
                                }
                            },
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
                                'email': '$createdUser.email',
                                "profilePicture": { $ifNull: ["", { $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }] }
                            },
                            isHost: {
                                $cond: { if: { $eq: ["$createdUser._id", req.user._id] }, then: true, else: false }
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
                            isHost: { $first: "$isHost" },
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
                    { $match: { groupstatus: { $eq: 1 } } },
                    { $skip: skipRec },
                    { $limit: pageLimit },
                    { $sort: { isHost: -1 } }
                ])

                for (let focusgroup of focusGroupList) {
                    if (!focusgroup.screens[0]._id) {
                        focusgroup.screens = []
                    }
                    if (!focusgroup.invitedMembers[0]._id) {
                        focusgroup.invitedMembers = []
                    }
                    if (!focusgroup.joinedMembers[0]._id) {
                        focusgroup.joinedMembers = []
                    }
                    focusgroup.members = [...focusgroup.invitedMembers, ...focusgroup.joinedMembers]
                    delete focusgroup.invitedMembers;
                    delete focusgroup.joinedMembers;
                }


                let lIntNoOfGroups = await Focusgroup.count({
                    $and: [
                        lAryQueryCondition
                    ]
                })
                if (focusGroupList === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    let lObjIndusty = {
                        items: focusGroupList,
                        total: Math.ceil(lIntNoOfGroups / (limit ? limit : gIntDataPerPage)),
                        totalFocusGroup: lIntNoOfGroups,
                        per_page: limit ? limit : gIntDataPerPage,
                        currentPage: page
                    }
                    return Response.success(res, lObjIndusty, "Focusgroup Details")
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        getInvitedProjectList: async(req, res) => {
            try {
                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                let projectDetails = await Projects.aggregate([{
                        $match: {
                            teamMembers: { $in: [req.user.email] },
                            projectStatus: 1
                        }
                        // $match: {
                        //     $or: [{
                        //             teamMembers: { $in: [req.user.email] },
                        //             projectStatus: 1
                        //         },
                        //         {
                        //             userId: req.user._id,
                        //             projectStatus: 1
                        //         },
                        //     ]
                        // }

                    },
                    {
                        $group: {
                            _id: "$_id",
                            "projectName": { $first: "$projectName" },
                            "description": { $first: "$description" },
                            "createdAt": { $first: "$createdAt" },
                            "userId": { $first: "$userId" }
                        }
                    },
                    { $lookup: { from: "screens", localField: "_id", foreignField: "projectId", as: "screens" } },
                    {
                        "$project": {
                            "projectName": 1,
                            "industry": 1,
                            "createdAt": 1,
                            "description": 1,
                            "userId": 1,
                            "views_size": { "$size": "$screens" },
                            "screens": 1,
                        }
                    },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'screens.screenStatus': { $ne: 0 } } },
                    {
                        $group: {
                            _id: "$_id",
                            "projectName": { $first: "$projectName" },
                            "description": { $first: "$description" },
                            "createdAt": { $first: "$createdAt" },
                            "userId": { $first: "$userId" },
                            "count": { "$first": "$views_size" },
                            screens: {
                                $push: {
                                    "_id": '$screens._id',
                                    image: {
                                        $cond: {
                                            if: { $eq: ['$screens.inspire', false] },
                                            then: { $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$screens.image"] }, ""] },
                                            else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$screens.image"] }, ""] }
                                        }
                                    },
                                    "screenStatus": "$screens.screenStatus"
                                }
                            }
                        }
                    },
                    {
                        $sort: { "createdAt": -1 }
                    },
                    { $skip: skipRec },
                    { $limit: pageLimit },
                ])

                for (let project of projectDetails) {
                    let lObjFocusGroupCount = await Focusgroup.find({ projectId: project._id, groupstatus: 1 }).select('groupName').lean()
                        // let lObjTeamMmeberCount = await Projects.count({ projectId: project._id })
                    if (!project.screens[0]._id) {
                        project.screens = [];
                    }
                    let fgCount = {
                        count: lObjFocusGroupCount.length,
                        items: lObjFocusGroupCount
                    }
                    project.fgCount = fgCount
                }
                let lIntNoOfGroups = await Projects.count({ userId: req.user._id, projectStatus: 1 })
                if (projectDetails === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    let lObjIndusty = {
                        items: projectDetails,
                        total: Math.round(lIntNoOfGroups / (limit ? limit : gIntDataPerPage)),
                        totalProjects: lIntNoOfGroups,
                        per_page: limit ? limit : gIntDataPerPage,
                        currentPage: page
                    }
                    return Response.success(res, lObjIndusty, "Project Details")
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getHotspotsCount: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned'];
                let time1, time2;
                const schema = Joi.object().keys({
                    member: Joi.string().trim().allow(''),
                    assigned: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    focusgroupId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let searchQuery = {
                    $or: [{
                            "teamMember.projectTeamMember.userId": req.user._id
                        },
                        {
                            "Focusgroup.invitedMembers.email": req.user.email
                        }
                    ],
                    "Projects.projectStatus": 1,
                    "Focusgroup.groupstatus": 1
                }


                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                            case 'focusgroupId':
                                searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                        }
                    }
                });

                let lObjHotspot = await Hotspot.aggregate([
                    { $match: { status: 1 } },
                    { $sort: { createdAt: -1 } },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "HotspotAction" } },
                    { $unwind: { path: '$HotspotAction', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "fg_project_screens", localField: "screenId", foreignField: "screenId", as: "FGScreens" } },
                    // { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                    // { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "screens", localField: "screenId", foreignField: "_id", as: "Screens" } },
                    // { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "screenversions", localField: "screenId", foreignField: "_id", as: "version" } },
                    // { $unwind: { path: '$version', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    // { $lookup: { from: "ticketassigns", localField: "_id", foreignField: "hotspotId", as: "Ticket" } },
                    // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                    // {
                    //     $match: { "Ticket.status": 1 }
                    // },
                    { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                    { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: "$HotspotAction.name",
                            count: { $sum: 1 },
                            actionId: { $first: '$actionId' }
                        }
                    },
                    { $sort: { count: 1 } },
                ]);

                let lObjFlagItems = await Hotspot.aggregate([
                    { $match: { status: 1, flagStatus: true } },
                    { $sort: { createdAt: -1 } },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "flaggeditems", localField: "flagId", foreignField: "_id", as: "Flaggeditems" } },
                    { $unwind: { path: '$Flaggeditems', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "fg_project_screens", localField: "screenId", foreignField: "screenId", as: "FGScreens" } },
                    // { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                    // { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "screens", localField: "projectScreens.screenId", foreignField: "_id", as: "Screens" } },
                    // { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "ticketassigns", localField: "Hotspot._id", foreignField: "hotspotId", as: "Ticket" } },
                    // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                    // {
                    //     $match: { "Ticket.status": 1 }
                    // },
                    { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                    { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: "$Flaggeditems.groupBy",
                            count: { $sum: 1 },
                            // flagId: { $first: '$flagId' }
                        }
                    },
                ]);

                let lObjAssigned = await Ticket.aggregate([
                    { $match: { status: 1, assignedUser: ObjectId(req.user._id) } },
                    { $sort: { createdAt: -1 } },
                    { $lookup: { from: "hotspots", localField: "hotspotId", foreignField: "_id", as: "hotspots" } },
                    { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                    { $match: { "hotspots.status": 1 } },
                    { $lookup: { from: "users", localField: "hotspots.userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "hostspotactions", localField: "hotspots.actionId", foreignField: "_id", as: "HotspotAction" } },
                    { $unwind: { path: '$HotspotAction', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "hotspots.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    { $lookup: { from: "users", localField: "assignedUser", foreignField: "_id", as: "assignedUser" } },
                    { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: "$groupBy",
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { count: 1 } },
                ]);

                let lUnreadMsg = await unreadChat.find({ userId: req.user._id });

                let rchat = {};

                for (let i = 0; i < lUnreadMsg.length; i++) {
                    if (i == 0) {
                        rchat.count = lUnreadMsg[i].count;
                    } else {
                        rchat.count = rchat.count + lUnreadMsg[i].count;
                    }
                }

                rchat._id = "Unread"

                let demoChat = [];
                demoChat.push(rchat);

                lObjHotspot = [...lObjHotspot, ...lObjFlagItems, ...demoChat, ...lObjAssigned];

                lObjHotspot = lObjHotspot.filter(v => {
                    return v._id != null
                })


                return Response.success(res, lObjHotspot, "Hotspot Details")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getActionTypeDetails: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                console.log('pageLimit ', pageLimit)

                let actionId = req.params.actionId;
                let groupBy = req.query.groupby;
                let type = req.query.type;

                let lAryQueryCondition
                if (type == 'all') {
                    lAryQueryCondition = {
                        "status": 1,
                        "actionId": ObjectId(actionId)
                    };
                } else if (type == 'own') {
                    lAryQueryCondition = {
                        "userId": ObjectId(req.user._id),
                        "status": 1,
                        "actionId": ObjectId(actionId)
                    }
                } else {
                    lAryQueryCondition = {
                        "userId": ObjectId(type),
                        "status": 1,
                        "actionId": ObjectId(actionId)
                    }
                }

                //Get all Action Details
                if (groupBy == 'projects') {
                    // let lObjHotspot = await Hotspot.find({ actionTypeId: actionId, status: 1 })
                    let lObjHotspot = await Hotspot.aggregate([{
                            $match: lAryQueryCondition
                        },
                        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "Actions" } },
                        { $unwind: { path: '$Actions', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "fg_project_screens", localField: "screenId", foreignField: "screenId", as: "FGScreens" } },
                        { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                        { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "projectScreens.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "FGScreens.focusGroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Projects.userId", foreignField: "_id", as: "projectCreatedUser" } },
                        { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                        // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                "teamMember.projectTeamMember.userId": { $in: [req.user._id] },
                                "Projects.projectStatus": 1
                            }

                        },
                        {
                            $group: {
                                _id: '$Focusgroup._id',
                                userId: { $first: "$userId" },
                                user: { $first: '$Users' },
                                actionType: { $first: '$Actions.name' },
                                count: { $sum: 1 },
                                screenId: { $first: '$screenId' },
                                createdAt: { $first: "$createdAt" },
                                projectName: { $first: '$Projects.projectName' },
                                projectId: { $first: '$Projects._id' },
                                projectCreatedUser: { $first: '$Projects._id' },
                                focusGroup: {
                                    $first: '$Focusgroup'
                                }

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "actionType": 1,
                                "screenId": 1,
                                "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                "projectName": 1,
                                "projectId": 1,
                                "focusGroup": {
                                    _id: '$focusGroup._id',
                                    name: '$focusGroup.groupName',
                                    count: '$count',
                                },
                                "userDetail": {
                                    '_id': '$user._id',
                                    'userName': '$user.userName',
                                    'firstName': '$user.firstName',
                                    'lastName': '$user.lastName',
                                    'email': '$user.email',
                                    "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$user.profilePicture"] }, ""] },
                                },
                                "projectCreatedUser": 1
                            }
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                actionType: { $first: '$actionType' },
                                screenId: { $first: '$screenId' },
                                createdAt: { $first: "$createdAt" },
                                projectCreatedUser: { $first: "$projectCreatedUser" },
                                projectDetails: {
                                    $push: {
                                        projectName: '$projectName',
                                        projectId: '$projectId',
                                    }
                                },
                                focusGroup: {
                                    $push: '$focusGroup',
                                },
                                users: {
                                    $push: '$userDetail'
                                },

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "actionType": 1,
                                "screenId": 1,
                                "createdAt": 1,
                                "projectDetails": 1,
                                "focusGroup": 1,
                                "users": 1,
                                "projectCreatedUser": 1
                            }
                        },

                        { $sort: { 'userDetail.firstName': -1, 'projectName': -1 } },
                        { $skip: skipRec },
                        { $limit: pageLimit }

                    ]);

                    lObjHotspot = lObjHotspot.map(v => {
                        let data = [];
                        v.focusGroup.forEach(x => {
                            data.push(x.count);
                        })
                        v.users = _.uniqBy(v.users, 'userName');
                        v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                        let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                        v.totalCount = total;
                        return v;
                    })

                    return Response.success(res, lObjHotspot, "Hotspot Details")
                } else if (groupBy == 'focusgroup') {
                    let lObjHotspot = await Hotspot.aggregate([{
                            $match: lAryQueryCondition
                        },
                        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "Actions" } },
                        { $unwind: { path: '$Actions', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "fg_project_screens", localField: "screenId", foreignField: "screenId", as: "FGScreens" } },
                        { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                        { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "projectScreens.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "FGScreens.focusGroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Projects.userId", foreignField: "_id", as: "projectCreatedUser" } },
                        { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                        // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                "teamMember.projectTeamMember.userId": { $in: [req.user._id] },
                                "Projects.projectStatus": 1
                            }

                        },

                        {
                            $group: {
                                _id: '$Focusgroup._id',
                                userId: { $first: "$userId" },
                                actionType: { $first: '$Actions.name' },
                                count: { $sum: 1 },
                                screenId: { $first: '$screenId' },
                                createdAt: { $first: "$createdAt" },
                                projectCreatedUser: { $first: "$projectCreatedUser" },
                                projectName: { $first: '$Projects.projectName' },
                                projectId: { $first: '$Projects._id' },
                                focusGroup: {
                                    $first: '$Focusgroup'
                                },
                                users: {
                                    $push: {
                                        '_id': '$Users._id',
                                        'userName': '$Users.userName',
                                        'firstName': '$Users.firstName',
                                        'lastName': '$Users.lastName',
                                        'email': '$Users.email',
                                        "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$Users.profilePicture"] }, ""] },
                                    }
                                },

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "actionType": 1,
                                "screenId": 1,
                                "projectCreatedUser": 1,
                                "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                "projectName": 1,
                                "projectId": 1,
                                "focusGroup": {
                                    _id: '$focusGroup._id',
                                    name: '$focusGroup.groupName',
                                    count: '$count',
                                },
                                "users": 1
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                actionType: { $first: '$actionType' },
                                screenId: { $first: '$screenId' },
                                createdAt: { $first: "$createdAt" },
                                projectCreatedUser: { $first: "$projectCreatedUser" },
                                projectDetails: {
                                    $push: {
                                        projectName: '$projectName',
                                        projectId: '$projectId',
                                    }
                                },
                                focusGroup: {
                                    $push: '$focusGroup',
                                },
                                users: {
                                    $first: '$users'
                                },

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "actionType": 1,
                                "projectCreatedUser": 1,
                                "screenId": 1,
                                "createdAt": 1,
                                "projectDetails": 1,
                                "focusGroup": 1,
                                "users": 1
                            }
                        },

                        { $sort: { 'userDetail.firstName': -1, 'projectName': -1, 'createdAt': -1 } },
                        { $skip: skipRec },
                        { $limit: pageLimit }

                    ]);


                    lObjHotspot = lObjHotspot.map(v => {
                        let data = [];
                        v.focusGroup.forEach(x => {
                            data.push(x.count);
                        })
                        v.users = _.uniqBy(v.users, 'userName');
                        v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                        let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                        v.totalCount = total;
                        return v;
                    })

                    return Response.success(res, lObjHotspot, "Hotspot Details")
                }



            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        getFlaggedItemDetails: async(req, res) => {
            try {

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                console.log('pageLimit ', pageLimit)

                let groupBy = req.query.groupby;
                let type = req.query.type;
                let action = req.query.action.toLowerCase();

                let lAryQueryCondition = {
                    "groupBy": action
                };

                if (groupBy == 'projects') {
                    let lObjFlaggedItems = await Items.aggregate([{
                            $match: lAryQueryCondition
                        },
                        { $lookup: { from: "hotspots", localField: "_id", foreignField: "flagId", as: "hotspots" } },
                        { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                        { $match: { 'hotspots.flagStatus': true } },
                        { $lookup: { from: "flaggeditems", localField: "hotspots.flagId", foreignField: "_id", as: "flags" } },
                        { $unwind: { path: '$flags', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "hotspots.userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "fg_project_screens", localField: "hotspots.screenId", foreignField: "screenId", as: "FGScreens" } },
                        { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                        { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "projectScreens.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "FGScreens.focusGroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Projects.userId", foreignField: "_id", as: "projectCreatedUser" } },
                        { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                        // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                "teamMember.projectTeamMember.userId": { $in: [req.user._id] },
                                "Projects.projectStatus": 1
                            }

                        },

                        {
                            $group: {
                                _id: '$Focusgroup._id',
                                userId: { $first: "$hotspots.userId" },
                                flagType: { $first: "$flags.name" },
                                user: { $first: '$Users' },
                                count: { $sum: 1 },
                                screenId: { $first: '$hotspots.screenId' },
                                createdAt: { $first: "$hotspots.createdAt" },
                                projectName: { $first: '$Projects.projectName' },
                                projectId: { $first: '$Projects._id' },
                                focusGroup: {
                                    $first: '$Focusgroup'
                                },
                                projectCreatedUser: {
                                    $first: '$projectCreatedUser'
                                }

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "screenId": 1,
                                "flagType": 1,
                                "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                "projectName": 1,
                                "projectId": 1,
                                "projectCreatedUser": 1,
                                "focusGroup": {
                                    _id: '$focusGroup._id',
                                    name: '$focusGroup.groupName',
                                    count: '$count',
                                },
                                "userDetail": {
                                    '_id': '$user._id',
                                    'userName': '$user.userName',
                                    'firstName': '$user.firstName',
                                    'lastName': '$user.lastName',
                                    'email': '$user.email',
                                    "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$user.profilePicture"] }, ""] },
                                },
                            }
                        },
                        {
                            $group: {
                                _id: "$projectId",
                                screenId: { $first: '$screenId' },
                                flagType: { $first: '$flagType' },
                                projectCreatedUser: { $first: '$projectCreatedUser' },
                                createdAt: { $first: "$createdAt" },
                                projectDetails: {
                                    $push: {
                                        projectName: '$projectName',
                                        projectId: '$projectId',
                                    }
                                },
                                focusGroup: {
                                    $push: '$focusGroup',
                                },
                                users: {
                                    $push: '$userDetail'
                                },

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "screenId": 1,
                                "flagType": 1,
                                "createdAt": 1,
                                "projectDetails": 1,
                                "focusGroup": 1,
                                "users": 1,
                                "projectCreatedUser": 1
                            }
                        },

                        { $sort: { 'users.firstName': -1, 'projectName': -1 } },
                        { $skip: skipRec },
                        { $limit: pageLimit }
                    ])

                    lObjFlaggedItems = lObjFlaggedItems.map(v => {
                        let data = [];
                        v.focusGroup.forEach(x => {
                            data.push(x.count);
                        })
                        v.users = _.uniqBy(v.users, 'userName');
                        v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                        let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                        v.totalCount = total;
                        return v;
                    })

                    return Response.success(res, lObjFlaggedItems, "Flagged item Details");

                } else if (groupBy == 'focusgroup') {

                    let lObjFlaggedItems = await Items.aggregate([{
                            $match: lAryQueryCondition
                        },
                        { $lookup: { from: "hotspots", localField: "_id", foreignField: "flagId", as: "hotspots" } },
                        { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                        { $match: { 'hotspots.flagStatus': true } },
                        { $lookup: { from: "flaggeditems", localField: "hotspots.flagId", foreignField: "_id", as: "flags" } },
                        { $unwind: { path: '$flags', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "hotspots.userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "fg_project_screens", localField: "hotspots.screenId", foreignField: "screenId", as: "FGScreens" } },
                        { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                        { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "projectScreens.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "FGScreens.focusGroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Projects.userId", foreignField: "_id", as: "projectCreatedUser" } },
                        { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                        // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                "teamMember.projectTeamMember.userId": { $in: [req.user._id] },
                                "Projects.projectStatus": 1
                            }

                        },
                        {
                            $group: {
                                _id: '$Focusgroup._id',
                                userId: { $first: "$hotspots.userId" },
                                flagType: { $first: "$flags.name" },
                                user: { $first: '$Users' },
                                count: { $sum: 1 },
                                screenId: { $first: '$hotspots.screenId' },
                                createdAt: { $first: "$hotspots.createdAt" },
                                projectName: { $first: '$Projects.projectName' },
                                projectId: { $first: '$Projects._id' },
                                focusGroup: {
                                    $first: '$Focusgroup'
                                },
                                projectCreatedUser: {
                                    $first: '$projectCreatedUser'
                                }

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "screenId": 1,
                                "flagType": 1,
                                "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                                "projectName": 1,
                                "projectId": 1,
                                "projectCreatedUser": 1,
                                "focusGroup": {
                                    _id: '$focusGroup._id',
                                    name: '$focusGroup.groupName',
                                    count: '$count',
                                },
                                "userDetail": {
                                    '_id': '$user._id',
                                    'userName': '$user.userName',
                                    'firstName': '$user.firstName',
                                    'lastName': '$user.lastName',
                                    'email': '$user.email',
                                    "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$user.profilePicture"] }, ""] },
                                },
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                screenId: { $first: '$screenId' },
                                flagType: { $first: '$flagType' },
                                createdAt: { $first: "$createdAt" },
                                projectCreatedUser: { $first: "$projectCreatedUser" },
                                projectDetails: {
                                    $push: {
                                        projectName: '$projectName',
                                        projectId: '$projectId',
                                    }
                                },
                                focusGroup: {
                                    $push: '$focusGroup',
                                },
                                users: {
                                    $push: '$userDetail'
                                },

                            }
                        },
                        {
                            "$project": {
                                "_id": 1,
                                "screenId": 1,
                                "flagType": 1,
                                "createdAt": 1,
                                "projectDetails": 1,
                                "focusGroup": 1,
                                "users": 1,
                                "projectCreatedUser": 1
                            }
                        },

                        { $sort: { 'users.firstName': -1, 'projectName': -1 } },
                        { $skip: skipRec },
                        { $limit: pageLimit }
                    ]);

                    lObjFlaggedItems = lObjFlaggedItems.map(v => {
                        let data = [];
                        v.focusGroup.forEach(x => {
                            data.push(x.count);
                        })
                        v.users = _.uniqBy(v.users, 'userName');
                        v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                        let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                        v.totalCount = total;
                        return v;
                    })

                    return Response.success(res, lObjFlaggedItems, "Flagged item Details");
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        byProjectFilter: async(req, res) => {
            try {

                let projectTeamMember = await ProjectTeamMember.find({
                    "projectTeamMember.userId": req.user._id
                }).select('projectId');

                let projectList = [];
                if (projectTeamMember.length > 0) {
                    for (let x of projectTeamMember) {
                        let data = await Projects.findOne({ _id: x.projectId, projectStatus: 1 }).select('projectName');
                        projectList.push(data);
                    }

                    projectList = projectList.filter(v => {
                        return v != null;
                    })

                    return Response.success(res, projectList, "project list");
                } else {
                    return Response.badValuesData(res, "You haven't created a project or invited to a project");
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }

        },

        byFocusGroupFilter: async(req, res) => {
            try {

                let fgList;
                let projectId = req.query.projectId;
                if (projectId == null || projectId == '' || projectId == undefined) {

                    fgList = await Focusgroup.aggregate([{
                            $match: { "groupstatus": 1 }
                        },
                        { $lookup: { from: "projectteammembers", localField: "projectId", foreignField: "projectId", as: "teamMembers" } },
                        // { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                $or: [
                                    { "invitedMembers.email": req.user.email },
                                    { "createdUser": req.user._id },
                                    { "teamMembers.projectTeamMember.userId": req.user._id }
                                ],
                                "groupstatus": 1
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                "groupName": { $first: "$groupName" },
                                "projectId": { $first: "$projectId" }
                            }
                        }
                    ]);

                } else {

                    fgList = await Focusgroup.aggregate([{
                            $match: { "groupstatus": 1 }
                        },
                        { $lookup: { from: "projectteammembers", localField: "projectId", foreignField: "projectId", as: "teamMembers" } },
                        // { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                $or: [
                                    { "invitedMembers.email": req.user.email },
                                    { "createdUser": req.user._id },
                                    { "teamMembers.projectTeamMember.userId": req.user._id }
                                ],
                                "groupstatus": 1,
                                "projectId": ObjectId(projectId)
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                "groupName": { $first: "$groupName" },
                                "projectId": { $first: "$projectId" }
                            }
                        }
                    ]);
                }


                return Response.success(res, fgList, "FG list");


            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        byRaisedFilter: async(req, res) => {
            try {

                let fgList = await Hotspot.aggregate([{
                        $match: { "status": 1 }
                    },
                    { $lookup: { from: "focusgroups", localField: "focusgroupId", foreignField: "_id", as: "FG" } },
                    { $unwind: { path: '$FG', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "FG.projectId", foreignField: "projectId", as: "teamMembers" } },
                    // { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: {
                            $or: [
                                { "FG.invitedMembers.email": req.user.email },
                                { "FG.createdUser": req.user._id },
                                { "teamMembers.projectTeamMember.userId": req.user._id }
                            ],
                            "FG.groupstatus": 1
                        }
                    },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$Users._id",
                            "groupName": { $first: "$FG.groupName" },
                            "projectId": { $first: "$FG.projectId" },
                            "userName": { $first: "$Users.firstName" },
                            "userId": { $first: "$Users._id" },
                            "email": { $first: "$Users.email" }
                        }
                    }
                ]);

                fgList = fgList.filter(v => {
                    return v.userId != null && v.userName != null;
                });



                let elements = fgList.reduce(function(previous, current) {
                    var object = previous.filter(object => object.email === current.email);
                    if (object.length == 0) {
                        previous.push(current);
                    }
                    return previous;
                }, []);


                return Response.success(res, elements, "Raised Member list");


            } catch (err) {
                return Response.errorInternal(err, res)
            }

        },

        getActionTypeDetail: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned', 'sort', 'dueDate'];
                let time1, time2, dueDateSort;
                const schema = Joi.object().keys({
                    member: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    focusgroupId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                    offset: Joi.string().trim().allow(''),
                    page: Joi.string().trim().allow(''),
                    type: Joi.string().trim().allow(''),
                    limit: Joi.string().trim().allow(''),
                    groupby: Joi.string().trim().allow(''),
                    sort: Joi.string().trim().allow(''),
                    dueDate: Joi.string().trim().allow('')
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let searchQuery = {
                    $or: [{
                            "teamMember.projectTeamMember.userId": req.user._id
                        },
                        {
                            "Focusgroup.invitedMembers.email": req.user.email
                        }
                    ],
                    "Projects.projectStatus": 1,
                    "Focusgroup.groupstatus": 1
                        // "Ticket.status": 1
                }

                console.log("req.query.sort", req.query.sort);

                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                            case 'focusgroupId':
                                searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                            case 'sort':
                                if (req.query.sort && req.query.sort === 'desc') {
                                    dueDateSort = -1
                                } else {
                                    dueDateSort = 1
                                }
                                break;
                            case 'dueDate':
                                let gtDate = moment(req.query.dueDate).subtract(1, 'days').format('YYYY-MM-DD[T00:00:00.000Z]');
                                let ltDate = moment(req.query.dueDate).add(1, 'days').format('YYYY-MM-DD[T00:00:00.000Z]');
                                searchQuery["dueDate"] = { $gte: new Date(gtDate), $lt: new Date(ltDate) }
                                break;
                        }

                    }
                });

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                console.log('pageLimit ', pageLimit)

                let actionId = req.params.actionId;
                let groupBy = req.query.groupby;
                let type = req.query.type;

                let lAryQueryCondition = {
                    "status": 1,
                    "actionId": ObjectId(actionId)
                };

                //Get all Action Details

                // let lObjHotspot = await Hotspot.find({ actionTypeId: actionId, status: 1 })
                let lObjHotspot = await Hotspot.aggregate([{
                        $match: lAryQueryCondition
                    },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "Actions" } },
                    { $unwind: { path: '$Actions', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "fg_project_screens", localField: "screenId", foreignField: "screenId", as: "FGScreens" } },
                    // { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                    // { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "screens", localField: "screenId", foreignField: "_id", as: "Screens" } },
                    // { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "screenversions", localField: "screenId", foreignField: "_id", as: "version" } },
                    // { $unwind: { path: '$version', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "users", localField: "Projects.userId", foreignField: "_id", as: "projectCreatedUser" } },
                    { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    // { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "ticketassigns", localField: "_id", foreignField: "hotspotId", as: "Ticket" } },
                    // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                    // { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: '$Focusgroup._id',
                            userId: { $first: "$userId" },
                            user: { $first: '$Users' },
                            dueDate: { $first: "$dueDate" },
                            actionType: { $first: '$Actions.name' },
                            count: { $sum: 1 },
                            screenId: { $first: '$screenId' },
                            createdAt: { $first: "$createdAt" },
                            projectName: { $first: '$Projects.projectName' },
                            projectId: { $first: '$Projects._id' },
                            projectCreatedUser: { $first: '$Projects._id' },
                            focusGroup: {
                                $first: '$Focusgroup'
                            }

                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "actionType": 1,
                            "screenId": 1,
                            "dueDate": 1,
                            "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            "projectName": 1,
                            "projectId": 1,
                            "focusGroup": {
                                _id: '$focusGroup._id',
                                name: '$focusGroup.groupName',
                                count: '$count',
                            },
                            "userDetail": {
                                '_id': '$user._id',
                                'userId': '$user._id',
                                'userName': '$user.userName',
                                'firstName': '$user.firstName',
                                'lastName': '$user.lastName',
                                'email': '$user.email',
                                "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$user.profilePicture"] }, ""] },
                            },
                            "projectCreatedUser": 1
                        }
                    },
                    {
                        $group: {
                            _id: "$projectId",
                            actionType: { $first: '$actionType' },
                            screenId: { $first: '$screenId' },
                            dueDate: { $first: "$dueDate" },
                            createdAt: { $first: "$createdAt" },
                            projectCreatedUser: { $first: "$projectCreatedUser" },
                            projectDetails: {
                                $addToSet: {
                                    projectName: '$projectName',
                                    projectId: '$projectId',
                                }
                            },
                            focusGroup: {
                                $addToSet: '$focusGroup',
                            },
                            users: {
                                $addToSet: '$userDetail'
                            },

                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "actionType": 1,
                            "dueDate": 1,
                            "screenId": 1,
                            "createdAt": 1,
                            "projectDetails": 1,
                            "focusGroup": 1,
                            "users": 1,
                            "projectCreatedUser": 1
                        }
                    },

                    { $sort: { 'userDetail.firstName': -1, 'projectName': -1, 'dueDate': dueDateSort || -1 } },
                    { $skip: skipRec },
                    { $limit: pageLimit }

                ]);

                lObjHotspot = lObjHotspot.map(v => {
                    let data = [];
                    v.focusGroup.forEach(x => {
                        data.push(x.count);
                    })
                    v.users = _.uniqBy(v.users, 'userName');
                    v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                    let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                    v.totalCount = total;
                    return v;
                })

                return Response.success(res, lObjHotspot, "Hotspot Details")




            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getFlaggedItemDetail: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned'];
                let time1, time2;
                const schema = Joi.object().keys({
                    member: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    focusgroupId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                    offset: Joi.string().trim().allow(''),
                    page: Joi.string().trim().allow(''),
                    type: Joi.string().trim().allow(''),
                    limit: Joi.string().trim().allow(''),
                    groupby: Joi.string().trim().allow(''),
                    action: Joi.string().trim().required()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let searchQuery = {
                    $or: [{
                            "teamMember.projectTeamMember.userId": req.user._id
                        },
                        {
                            "Focusgroup.invitedMembers.email": req.user.email
                        }
                    ],
                    "Projects.projectStatus": 1,
                    "hotspots.status": 1,
                    "Focusgroup.groupstatus": 1
                        // "Ticket.status": 1
                }


                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                            case 'focusgroupId':
                                searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                        }
                    }
                });

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                console.log('pageLimit ', pageLimit)

                let groupBy = req.query.groupby;
                let type = req.query.type;
                let action = req.query.action;

                let lAryQueryCondition = {
                    "groupBy": action
                };

                let lObjFlaggedItems = await Items.aggregate([{
                        $match: lAryQueryCondition
                    },
                    { $lookup: { from: "hotspots", localField: "_id", foreignField: "flagId", as: "hotspots" } },
                    { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                    { $match: { 'hotspots.flagStatus': true } },
                    { $lookup: { from: "flaggeditems", localField: "hotspots.flagId", foreignField: "_id", as: "flags" } },
                    { $unwind: { path: '$flags', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "users", localField: "hotspots.userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "fg_project_screens", localField: "hotspots.screenId", foreignField: "screenId", as: "FGScreens" } },
                    // { $unwind: { path: '$FGScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "project_screens", localField: "FGScreens.projectScreenId", foreignField: "_id", as: "projectScreens" } },
                    // { $unwind: { path: '$projectScreens', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "screens", localField: "projectScreens.screenId", foreignField: "_id", as: "Screens" } },
                    // { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "hotspots.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "users", localField: "Projects.userId", foreignField: "_id", as: "projectCreatedUser" } },
                    // { $unwind: { path: '$projectCreatedUser', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "ticketassigns", localField: "hotspots._id", foreignField: "hotspotId", as: "Ticket" } },
                    // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                    // { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                    // { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },

                    {
                        $group: {
                            _id: '$Focusgroup._id',
                            userId: { $first: "$hotspots.userId" },
                            flagType: { $first: "$flags.name" },
                            user: { $first: '$Users' },
                            count: { $sum: 1 },
                            screenId: { $first: '$hotspots.screenId' },
                            createdAt: { $first: "$hotspots.createdAt" },
                            projectName: { $first: '$Projects.projectName' },
                            projectId: { $first: '$Projects._id' },
                            focusGroup: {
                                $first: '$Focusgroup'
                            },
                            // projectCreatedUser: {
                            //     $first: '$projectCreatedUser'
                            // }

                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "screenId": 1,
                            "flagType": 1,
                            "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            "projectName": 1,
                            "projectId": 1,
                            // "projectCreatedUser": 1,
                            "focusGroup": {
                                _id: '$focusGroup._id',
                                name: '$focusGroup.groupName',
                                count: '$count',
                            },
                            "userDetail": {
                                '_id': '$user._id',
                                'userName': '$user.userName',
                                'firstName': '$user.firstName',
                                'lastName': '$user.lastName',
                                'email': '$user.email',
                                "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$user.profilePicture"] }, ""] },
                            },
                        }
                    },
                    {
                        $group: {
                            _id: "$projectId",
                            screenId: { $first: '$screenId' },
                            flagType: { $first: '$flagType' },
                            // projectCreatedUser: { $first: '$projectCreatedUser' },
                            createdAt: { $first: "$createdAt" },
                            projectDetails: {
                                $push: {
                                    projectName: '$projectName',
                                    projectId: '$projectId',
                                }
                            },
                            focusGroup: {
                                $push: '$focusGroup',
                            },
                            users: {
                                $push: '$userDetail'
                            },

                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "screenId": 1,
                            "flagType": 1,
                            "createdAt": 1,
                            "projectDetails": 1,
                            "focusGroup": 1,
                            "users": 1,
                            // "projectCreatedUser": 1
                        }
                    },

                    { $sort: { 'users.firstName': -1, 'projectName': -1 } },
                    { $skip: skipRec },
                    { $limit: pageLimit }
                ])

                lObjFlaggedItems = lObjFlaggedItems.map(v => {
                    let data = [];
                    v.focusGroup.forEach(x => {
                        data.push(x.count);
                    })
                    v.users = _.uniqBy(v.users, 'userName');
                    v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                    let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                    v.totalCount = total;
                    return v;
                })

                return Response.success(res, lObjFlaggedItems, "Flagged item Details");

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getFGDetail: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned'];
                let time1, time2;

                const schema = Joi.object().keys({
                    focusgroupId: Joi.string().trim().allow(''),
                    type: Joi.string().trim().allow(''),
                    member: Joi.string().trim().allow(''),
                    assigned: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let focusgroupId = req.query.focusgroupId;
                let type = req.query.type;

                let searchQuery = {
                    "Hotspot.focusgroupId": ObjectId(focusgroupId),
                    "Hotspot.status": 1,
                    "Focusgroup.groupstatus": 1
                        // $or: [{
                        //     "teamMember.projectTeamMember.userId": req.user._id
                        // },
                        // {
                        //     "Focusgroup.invitedMembers.email": req.user.email
                        // }
                        // ],
                        // "Projects.projectStatus": 1,
                }


                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                                // case 'focusgroupId':
                                //     searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                //     break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["Hotspot.createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery["Hotspot.createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery["Hotspot.createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery["Hotspot.createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                        }
                    }
                });


                //Get all FG Details
                if (type == 'Flagged') {
                    let lFGDetail = await Items.aggregate([{
                            $match: {
                                "groupBy": type
                            }
                        },
                        { $lookup: { from: "hotspots", localField: "_id", foreignField: "flagId", as: "Hotspot" } },
                        { $unwind: { path: '$Hotspot', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Hotspot.userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "Hotspot.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "Hotspot.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screenversions", localField: "Hotspot.screenId", foreignField: "_id", as: "version" } },
                        { $unwind: { path: '$version', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "ticketassigns", localField: "Hotspot._id", foreignField: "hotspotId", as: "Ticket" } },
                        // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                        // {
                        //     $match: { "Ticket.status": 1 }
                        // },
                        // { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                        // { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: searchQuery
                        },
                        {
                            $group: {
                                _id: '$Hotspot.screenId',
                                screens: { $first: "$Screens" },
                                version: { $first: "$version" },
                                focusgroup: { $first: "$Focusgroup" },
                                project: { $first: "$Projects" },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $project: {
                                "_id": 1,
                                "screens": 1,
                                "version": 1,
                                "focusgroup": 1,
                                "count": 1,
                                "project": 1
                            }
                        },
                        {
                            $group: {
                                _id: '$focusgroup._id',
                                groupName: { $first: '$focusgroup.groupName' },
                                projectName: { $first: '$project.projectName' },
                                screenDetail: {
                                    $addToSet: {
                                        _id: "$_id",
                                        "screenName": { $ifNull: ["$screens.screenName", "$version.screenName"] },
                                        "count": "$count"
                                    }
                                }
                            }
                        },
                        { $sort: { "screenName": 1 } }
                    ]);

                    return Response.success(res, lFGDetail, "Hotspot Details")
                } else if (type == 'Ticket') {
                    let lFGDetail = await Ticket.aggregate([{
                            $match: {
                                "groupBy": type,
                                "assignedUser": ObjectId(req.user._id),
                                "status": 1
                            }
                        },
                        { $lookup: { from: "hotspots", localField: "hotspotId", foreignField: "_id", as: "Hotspot" } },
                        { $unwind: { path: '$Hotspot', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Hotspot.userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "Hotspot.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "Hotspot.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screenversions", localField: "Hotspot.screenId", foreignField: "_id", as: "version" } },
                        { $unwind: { path: '$version', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "assignedUser", foreignField: "_id", as: "assignedUser" } },
                        { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: searchQuery
                        },
                        {
                            $group: {
                                _id: '$Hotspot.screenId',
                                screens: { $first: "$Screens" },
                                version: { $first: "$version" },
                                focusgroup: { $first: "$Focusgroup" },
                                count: { $sum: 1 },
                                project: { $first: "$Projects" }
                            }
                        },
                        {
                            $project: {
                                "_id": 1,
                                "screens": 1,
                                "version": 1,
                                "focusgroup": 1,
                                "count": 1,
                                "project": 1
                            }
                        },
                        {
                            $group: {
                                _id: '$focusgroup._id',
                                groupName: { $first: '$focusgroup.groupName' },
                                projectName: { $first: '$project.projectName' },
                                screenDetail: {
                                    $addToSet: {
                                        _id: "$_id",
                                        "screenName": { $ifNull: ["$screens.screenName", "$version.screenName"] },
                                        "count": "$count"
                                    }
                                }
                            }
                        },
                        { $sort: { "screenName": 1 } }
                    ]);

                    return Response.success(res, lFGDetail, "Hotspot Details")
                } else {
                    let lFGDetail = await HotspotAction.aggregate([{
                            $match: {
                                "name": type
                            }
                        },
                        { $lookup: { from: "hotspots", localField: "_id", foreignField: "actionId", as: "Hotspot" } },
                        { $unwind: { path: '$Hotspot', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "users", localField: "Hotspot.userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        // { $lookup: { from: "ticketassigns", localField: "Hotspot._id", foreignField: "hotspotId", as: "Ticket" } },
                        // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                        // {
                        //     $match: { "Ticket.status": 1 }
                        // },
                        // { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                        // { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "focusgroups", localField: "Hotspot.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                        { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                        { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screens", localField: "Hotspot.screenId", foreignField: "_id", as: "Screens" } },
                        { $unwind: { path: '$Screens', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "screenversions", localField: "Hotspot.screenId", foreignField: "_id", as: "version" } },
                        { $unwind: { path: '$version', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: searchQuery
                        },
                        {
                            $group: {
                                _id: '$Hotspot.screenId',
                                screens: { $first: "$Screens" },
                                version: { $first: "$version" },
                                focusgroup: { $first: "$Focusgroup" },
                                count: { $sum: 1 },
                                project: { $first: "$Projects" }
                            }
                        },
                        {
                            $project: {
                                "_id": 1,
                                "screens": 1,
                                "version": 1,
                                "focusgroup": 1,
                                "count": 1,
                                "project": 1
                            }
                        },
                        {
                            $group: {
                                _id: '$focusgroup._id',
                                groupName: { $first: '$focusgroup.groupName' },
                                projectName: { $first: '$project.projectName' },
                                screenDetail: {
                                    $addToSet: {
                                        _id: "$_id",
                                        "screenName": { $ifNull: ["$screens.screenName", "$version.screenName"] },
                                        "count": "$count"
                                    }
                                }
                            }
                        },
                        { $sort: { "screenName": 1 } }
                    ]);

                    return Response.success(res, lFGDetail, "Hotspot Details")
                }

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        byAssignedFilter: async(req, res) => {
            try {

                let fgList = await Ticket.aggregate([{
                        $match: { "status": 1 }
                    },
                    { $lookup: { from: "hotspots", localField: "hotspotId", foreignField: "_id", as: "hotspot" } },
                    { $unwind: { path: '$hotspot', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "hotspot.focusgroupId", foreignField: "_id", as: "FG" } },
                    { $unwind: { path: '$FG', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "FG.projectId", foreignField: "projectId", as: "teamMembers" } },
                    // { $unwind: { path: '$teamMembers', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: {
                            $or: [
                                { "FG.invitedMembers.email": req.user.email },
                                { "FG.createdUser": req.user._id },
                                { "teamMembers.projectTeamMember.userId": req.user._id }
                            ],
                            "FG.groupstatus": 1
                        }
                    },
                    { $lookup: { from: "users", localField: "assignedUser", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$Users._id",
                            "groupName": { $first: "$FG.groupName" },
                            "projectId": { $first: "$FG.projectId" },
                            "userName": { $first: "$Users.firstName" },
                            "userId": { $first: "$Users._id" },
                            "email": { $first: "$Users.email" }
                        }
                    }
                ]);

                let elements = fgList.reduce(function(previous, current) {
                    var object = previous.filter(object => object.email === current.email);
                    if (object.length == 0) {
                        previous.push(current);
                    }
                    return previous;
                }, []);


                return Response.success(res, elements, "Assigned Member list");


            } catch (err) {
                return Response.errorInternal(err, res)
            }

        },

        getAssignedItemDetail: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned'];
                let time1, time2;
                const schema = Joi.object().keys({
                    member: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    focusgroupId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                    offset: Joi.string().trim().allow(''),
                    page: Joi.string().trim().allow(''),
                    type: Joi.string().trim().allow(''),
                    limit: Joi.string().trim().allow(''),
                    groupby: Joi.string().trim().allow(''),
                    action: Joi.string().trim().required()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let searchQuery = {
                    $or: [{
                            "teamMember.projectTeamMember.userId": req.user._id
                        },
                        {
                            "Focusgroup.invitedMembers.email": req.user.email
                        }
                    ],
                    "Projects.projectStatus": 1,
                    "hotspots.status": 1,
                    "Focusgroup.groupstatus": 1
                }


                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                            case 'focusgroupId':
                                searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                        }
                    }
                });

                gIntDataPerPage = (req.query.offset == 0 || !req.query.offset) ? 8 : parseInt(req.query.offset)

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

                console.log('pageLimit ', pageLimit)

                let groupBy = req.query.groupby;
                let type = req.query.type;
                let action = req.query.action;
                action = action.charAt(0).toUpperCase() + action.slice(1);

                let lAryQueryCondition = {
                    "groupBy": action,
                    "status": 1,
                    "assignedUser": ObjectId(req.user._id)
                };

                let lObjFlaggedItems = await Ticket.aggregate([{
                        $match: lAryQueryCondition
                    },
                    { $lookup: { from: "hotspots", localField: "hotspotId", foreignField: "_id", as: "hotspots" } },
                    { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "users", localField: "hotspots.userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "hotspots.focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    { $unwind: { path: '$teamMember', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "users", localField: "assignedUser", foreignField: "_id", as: "assignedUser" } },
                    { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: '$Focusgroup._id',
                            userId: { $first: "$hotspots.userId" },
                            user: { $first: '$Users' },
                            count: { $sum: 1 },
                            screenId: { $first: '$hotspots.screenId' },
                            createdAt: { $first: "$hotspots.createdAt" },
                            projectName: { $first: '$Projects.projectName' },
                            projectId: { $first: '$Projects._id' },
                            focusGroup: {
                                $first: '$Focusgroup'
                            }

                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "screenId": 1,
                            "createdAt": { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            "projectName": 1,
                            "projectId": 1,
                            "focusGroup": {
                                _id: '$focusGroup._id',
                                name: '$focusGroup.groupName',
                                count: '$count',
                            },
                            "userDetail": {
                                '_id': '$user._id',
                                'userName': '$user.userName',
                                'firstName': '$user.firstName',
                                'lastName': '$user.lastName',
                                'email': '$user.email',
                                "profilePicture": { $ifNull: [{ $concat: [`${process.env.AWS_URL}profilePicture/`, "$user.profilePicture"] }, ""] },
                            },
                        }
                    },
                    {
                        $group: {
                            _id: "$projectId",
                            screenId: { $first: '$screenId' },
                            createdAt: { $first: "$createdAt" },
                            projectDetails: {
                                $addToSet: {
                                    projectName: '$projectName',
                                    projectId: '$projectId',
                                }
                            },
                            focusGroup: {
                                $addToSet: '$focusGroup',
                            },
                            users: {
                                $addToSet: '$userDetail'
                            },

                        }
                    },
                    {
                        "$project": {
                            "_id": 1,
                            "screenId": 1,
                            "createdAt": 1,
                            "projectDetails": 1,
                            "focusGroup": 1,
                            "users": 1
                        }
                    },

                    { $sort: { 'users.firstName': -1, 'projectName': -1 } },
                    { $skip: skipRec },
                    { $limit: pageLimit }
                ])

                lObjFlaggedItems = lObjFlaggedItems.map(v => {
                    let data = [];
                    v.focusGroup.forEach(x => {
                        data.push(x.count);
                    })
                    v.users = _.uniqBy(v.users, 'userName');
                    v.projectDetails = _.uniqBy(v.projectDetails, 'projectName');
                    let total = data.reduce((accumulator, currentValue) => accumulator + currentValue);
                    v.totalCount = total;
                    return v;
                })

                return Response.success(res, lObjFlaggedItems, "Assigned item Details");

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        projectIssueChart: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned'];
                let time1, time2;
                const schema = Joi.object().keys({
                    member: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    focusgroupId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                    assigned: Joi.string().trim().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let searchQuery = {
                    $or: [{
                            "teamMember.projectTeamMember.userId": req.user._id
                        },
                        {
                            "Focusgroup.invitedMembers.email": req.user.email
                        }
                    ],
                    "Projects.projectStatus": 1,
                    "Focusgroup.groupstatus": 1
                }


                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                            case 'focusgroupId':
                                searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                        }
                    }
                });

                let lObjHotspot = await Hotspot.aggregate([
                    { $match: { status: 1 } },
                    { $sort: { createdAt: -1 } },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "HotspotAction" } },
                    { $unwind: { path: '$HotspotAction', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    // { $lookup: { from: "ticketassigns", localField: "_id", foreignField: "hotspotId", as: "Ticket" } },
                    // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                    // {
                    //     $match: { "Ticket.status": 1 }
                    // },
                    // { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                    // { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: "$Projects._id",
                            projectName: { $first: '$Projects.projectName' },
                            count: { $sum: 1 },
                            actionId: { $first: '$actionId' }
                        }
                    },
                    { $sort: { count: 1 } },
                ]);

                return Response.success(res, lObjHotspot, "Project wise Details")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        personWiseChart: async(req, res) => {
            try {

                let arr = ['member', 'projectId', 'focusgroupId', 'date', 'assigned'];
                let time1, time2;
                const schema = Joi.object().keys({
                    member: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().allow(''),
                    focusgroupId: Joi.string().trim().allow(''),
                    date: Joi.string().trim().allow(''),
                    assigned: Joi.string().trim().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.query, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let searchQuery = {
                    $or: [{
                            "teamMember.projectTeamMember.userId": req.user._id
                        },
                        {
                            "Focusgroup.invitedMembers.email": req.user.email
                        }
                    ],
                    "Projects.projectStatus": 1,
                    "Focusgroup.groupstatus": 1
                }


                arr.forEach(async(key) => {
                    if (req.query[key] && req.query[key] !== '' && req.query[key] !== '\'\'') {
                        switch (key) {
                            case 'projectId':
                                searchQuery["Projects._id"] = ObjectId(req.query.projectId)
                                break;
                            case 'focusgroupId':
                                searchQuery["Focusgroup._id"] = ObjectId(req.query.focusgroupId)
                                break;
                            case 'member':
                                searchQuery["Users._id"] = ObjectId(req.query.member);
                                break;
                            case 'assigned':
                                searchQuery["assignedUser._id"] = ObjectId(req.query.assigned);
                                break;
                            case 'date':
                                if (req.query.date == 'currentWeek') {
                                    time1 = moment().startOf('week').utc().format();
                                    time2 = moment().endOf('week').utc().format();
                                    searchQuery["createdAt"] = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date == 'lastWeek') {
                                    time1 = moment().subtract(1, 'weeks').startOf('isoWeek').utc().format();
                                    time2 = moment().subtract(1, 'weeks').endOf('isoWeek').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else if (req.query.date === 'currentMonth') {
                                    time1 = moment().startOf('month').utc().format();
                                    time2 = moment().endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                } else {
                                    time1 = moment().subtract(1, 'month').startOf('month').utc().format();
                                    time2 = moment().subtract(1, 'month').endOf('month').utc().format();
                                    searchQuery.createdAt = {
                                        $gte: new Date(time1),
                                        $lte: new Date(time2)
                                    }
                                }
                                break;
                        }
                    }
                });

                let lObjHotspot = await Hotspot.aggregate([
                    { $match: { status: 1 } },
                    { $sort: { createdAt: -1 } },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                    { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "HotspotAction" } },
                    { $unwind: { path: '$HotspotAction', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "focusgroups", localField: "focusgroupId", foreignField: "_id", as: "Focusgroup" } },
                    { $unwind: { path: '$Focusgroup', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "Focusgroup.projectId", foreignField: "_id", as: "Projects" } },
                    { $unwind: { path: '$Projects', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projectteammembers", localField: "Projects._id", foreignField: "projectId", as: "teamMember" } },
                    // { $lookup: { from: "ticketassigns", localField: "_id", foreignField: "hotspotId", as: "Ticket" } },
                    // { $unwind: { path: '$Ticket', 'preserveNullAndEmptyArrays': true } },
                    // {
                    //     $match: { "Ticket.status": 1 }
                    // },
                    // { $lookup: { from: "users", localField: "Ticket.assignedUser", foreignField: "_id", as: "assignedUser" } },
                    // { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: searchQuery
                    },
                    {
                        $group: {
                            _id: "$Users._id",
                            userName: { $first: '$Users.firstName' },
                            count: { $sum: 1 },
                        }
                    },
                    { $sort: { count: 1 } },
                ]);

                lObjHotspot = lObjHotspot.filter(v => {
                    return v._id != null;
                })



                return Response.success(res, lObjHotspot, "person wise details")
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
    }
    return Object.freeze(Methods)
}

module.exports = dashBoardController();