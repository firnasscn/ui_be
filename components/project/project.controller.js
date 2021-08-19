require("dotenv").config();

const Joi = require('joi');
const Response = require('../../utils/response');
const Project = require('../project/project.model');
const Screens = require('../screens/screens.model')
const User = require('../user/user.model');
const mailer = require('../../utils/mailService');
const indusrty = require('../industry/industry.model')
const Toools = require('../project/tools.model')
const Fonts = require('../project/fonts.model')
const screenRatingType = require('../screenTags/screenTags.model');
const activityFeed = require('../activityfeed/activityfeed.model');
const InspireScreen = require('./inspireActivity.model');
const teamMembers = require('../teamMembers/teamMembers.model');
const Team = require('../team/team.model');
// var client = require('../../utils/connection');
const FocusGroup = require('../focusGroup/focusGroup.model');
const jwt = require("jsonwebtoken");
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const _ = require('lodash');
const Notification = require('../notification/notification.model');
const pusherNotif = require('../../utils/pusher')
const screenVersion = require('../screenversions/screenVersion.model');
const ProjectTeamMember = require('../project/projectTeamMember.model');
const ProjectScreen = require('../project/projectScreen.model');
const styleGuide = require('./projectstyleguide.model')
let gIntDataPerPage = 10;

async function getAllTeamMembers(teamId, projectId, userId) {

    try {

        let createdTeam = await Team.findOne({ _id: teamId, status: 1 }).select('createdUser');

        let teamMem = await teamMembers.find({ teamId: teamId, status: 1 }).select('email');

        let usersData = [];
        usersData.push({ _id: createdTeam.createdUser });

        for (let x of teamMem) {
            usersData.push({ email: x.email })
        }

        for (let x of usersData) {
            let userDetail = await User.findOne({
                $or: [
                    { _id: x._id },
                    { email: x.email }
                ],
                isVerified: true
            });

            if (userDetail !== null) {
                let lObj = {
                    userId: userDetail._id,
                    firstName: userDetail.firstName,
                    email: userDetail.email
                }

                let isAlredayExsist = await ProjectTeamMember.findOne({ projectId: projectId, createdBy: userId, "projectTeamMember.userId": lObj.userId });

                if (isAlredayExsist === null) {
                    await ProjectTeamMember.create({
                        projectId,
                        createdBy: userId,
                        projectTeamMember: lObj
                    })
                }
            }

        }

    } catch (e) {
        console.log(e);
    }

}


function projectComponentCtrl() {
    const methods = {
        /**
         * Create Focus Group
         */
        createNewProject: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectName: Joi.string().trim().required(),
                    description: Joi.string().trim().allow(''),
                    industry: Joi.string().required(),
                    tools: Joi.array().allow(''),
                    fonts: Joi.string().trim().allow('')

                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                value.userId = req.user._id; //Created User

                let projects = await Project.find({
                    $and: [{
                        userId: req.user._id,
                        projectName: req.body.projectName,
                        projectStatus: 1
                    }]
                })

                if (projects.length > 0) {
                    return Response.badValues(res, `Another project under the name ${req.body.projectName} already exists`);
                }
                if (value.fonts == "") await delete value.fonts
                let project = await Project.create(value);
                await ProjectTeamMember.create({
                    projectId: project._id,
                    projectTeamMember: {
                        userId: req.user._id,
                        email: req.user.email,
                        firstName: req.user.firstName
                    },
                    createdBy: req.user._id
                });

                await activityFeed.create({
                    'userId': req.user._id,
                    'ProjectId': project._id,
                    type: 'newProject',
                    message: `Your New Project ${project.projectName} has been created.`
                })

                return Response.success(res, project, 'Project created succesfully');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        editProject: async(req, res) => {
            try {
                let { projectId } = req.params;
                let isUserInProjectTeamMember = await ProjectTeamMember.exists({
                    projectId,
                    'projectTeamMember.userId': req.user._id
                });
                let project = await Project.findOne({
                        _id: projectId,
                        // userId: req.user._id
                    })
                    .populate('industries name userId.profilePicture')
                    .populate({
                        path: 'userId',
                        select: ('firstName lastName email profilePicture userName')
                    }).lean();

                if (project === null && !isUserInProjectTeamMember) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action");
                }

                let allCount = await ProjectScreen.count({ projectId: ObjectId(projectId) })
                let projectCount = await Project.count({ userId: ObjectId(req.user._id), projectStatus: { $eq: 1 } })
                    // let inspirationCount = await Screens.count({ projectId: ObjectId(projectId), screenStatus: { $ne: 0 }, parentScreen: { $exists: true } })
                    // let savedCount = await Screens.count({ projectId: ObjectId(projectId), approvedStatus: 'in-review', screenStatus: { $ne: 0 }, isPublish: false, parentScreen: { $exists: false } })
                    // let publishedCount = await Screens.count({ projectId: ObjectId(projectId), isPublish: true, screenStatus: { $ne: 0 }, approvedStatus: 'approved', parentScreen: { $exists: false } })
                    // let inReviewCount = await Screens.count({ projectId: ObjectId(projectId), isPublish: true, screenStatus: { $ne: 0 }, approvedStatus: 'in-review', parentScreen: { $exists: false } })

                let projectTeamMembers = await ProjectTeamMember.find({
                    projectId
                });

                if (projectTeamMembers.length > 0) {
                    let teamMembers = [];
                    for (let x of projectTeamMembers) {
                        let data = await User.findOne({
                            _id: x.projectTeamMember.userId
                        }).select('firstName lastName email profilePicture userName');
                        teamMembers.push(data);
                    }
                    project.teamMembers = teamMembers
                } else {
                    project.teamMembers = [];
                }

                project.count = {
                    all: allCount,
                    projectCount: projectCount
                        // published: publishedCount,
                        // saved: savedCount,
                        // inspiration: inspirationCount,
                        // inReview: inReviewCount
                };
                return Response.success(res, project, "Project Details");
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        listProject: async(req, res) => {
            try {

                gIntDataPerPage = (!req.query.offset) ? 10 : parseInt(req.query.offset)
                console.log(req.user._id)
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
                let queryParam = (req.query.query) ? req.query.query : ''
                console.log(skipRec, "******8", gIntDataPerPage)
                let lIntNoOfGroups = await Project.count({ userId: req.user._id, projectStatus: 1 })
                let lObjProject = await Project.aggregate([{
                        $match: {
                            userId: req.user._id,
                            projectStatus: 1
                        }
                    },
                    { $unwind: { path: "$industry", "preserveNullAndEmptyArrays": true } },
                    { $lookup: { from: "industries", localField: "industry", foreignField: "_id", as: "industry" } },
                    { $unwind: "$industry" },
                    {
                        $group: {
                            _id: "$_id",
                            "projectName": { $first: "$projectName" },
                            "industry": { $first: "$industry.name" },
                            "description": { $first: "description" },
                            "createdAt": { $first: "createdAt" },
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
                            "views_size": {
                                $size: {
                                    $filter: {
                                        input: "$screens",
                                        as: "screen_field",
                                        cond: {
                                            $eq: ["$$screen_field.screenStatus", 1]
                                        }
                                    }
                                }
                            },
                            "screens": 1,
                        }
                    },
                    { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "projectName": { $first: "$projectName" },
                            "industry": { $first: "$industry" },
                            "description": { $first: "description" },
                            "createdAt": { $first: "createdAt" },
                            "userId": { $first: "$userId" },
                            "count": { "$first": "$views_size" },
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
                            screens: { $slice: ["$screens", 1] }
                        }

                    },
                    { $match: { "projectName": { $regex: queryParam, "$options": "i" } } },

                ]).skip(skipRec).limit(pageLimit)

                if (lObjProject === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    let lObjIndusty = {
                        items: lObjProject,
                        total: Math.ceil(lIntNoOfGroups / (limit ? limit : gIntDataPerPage)),
                        totalProjects: lIntNoOfGroups,
                        per_page: limit ? limit : gIntDataPerPage,
                        currentPage: page
                    }
                    return Response.success(res, lObjIndusty, "Project Details")
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        getAllProject: async(req, res) => {
            try {
                let lObjProject = await Project.aggregate([{
                        $match: {
                            userId: req.user._id,
                            projectStatus: 1
                        }
                    },
                    { $unwind: { path: "$industry", "preserveNullAndEmptyArrays": true } },
                    { $lookup: { from: "industries", localField: "industry", foreignField: "_id", as: "industry" } },
                    { $unwind: "$industry" },
                    {
                        $group: {
                            _id: "$_id",
                            "projectName": { $first: "$projectName" },
                            "industry": { $first: "$industry.name" },
                            "description": { $first: "description" },
                            "createdAt": { $first: "createdAt" },
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
                    {
                        $group: {
                            _id: "$_id",
                            "projectName": { $first: "$projectName" },
                            "industry": { $first: "$industry" },
                            "description": { $first: "description" },
                            "createdAt": { $first: "createdAt" },
                            "userId": { $first: "$userId" },
                            "count": { "$first": "$views_size" },
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
                        $sort: { "createdAt": -1 }
                    }
                ])
                for (let lObjRes of lObjProject) {
                    if (lObjRes && lObjRes.screens) {
                        lObjRes.screens = _.filter(lObjRes.screens, function(v) {
                            return v.image;
                        });

                    }
                }
                if (lObjProject === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    return Response.success(res, lObjProject, "Project Details")
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        updateProject: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectName: Joi.string().trim().required(),
                    description: Joi.string().trim().allow(''),
                    industry: Joi.string().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                //Group Id
                let lObjProjectId = req.params.projectId;
                let lObjUpdatedProject = await Project.findOneAndUpdate({
                    _id: lObjProjectId
                }, {
                    $set: value
                }, {
                    new: true
                });

                let createActivity = await activityFeed.create({
                    projectId: lObjProjectId,
                    userId: req.user._id,
                    message: `${req.user.userName} has updated ${lObjUpdatedProject.projectName} project`
                })
                pusherNotif.activitySocket(`ch-${lObjProjectId}`, createActivity)

                return Response.success(res, lObjUpdatedProject, 'Project updated succesfully');

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        deleteProject: async(req, res) => {
            try {
                let lObjProjectId = req.params.projectId;
                console.log(lObjProjectId)
                console.log(req.user._id)
                let lObjCheckOwnedGroup = await Project.findOne({ _id: ObjectId(lObjProjectId), userId: ObjectId(req.user._id) })
                if (lObjCheckOwnedGroup === null) return Response.notAuthorized(res, "You're not authorized to perform this action")
                let output = await Project.findOneAndUpdate({
                    _id: lObjProjectId,
                    userId: req.user._id
                }, {
                    $set: {
                        projectStatus: 0
                    }
                }, {
                    new: true
                });

                let updateScreenStatus = await Screens.update({ projectId: ObjectId(lObjProjectId) }, { $set: { isPublish: false } }, { multi: true })

                // let createActivity = await activityFeed.create({
                //     projectId: lObjProjectId,
                //     userId: req.user._id,
                //     message: `${req.user.userName} has deleted ${output.projectName} project`,
                //     type: 'activity'
                // })

                // pusherNotif.activitySocket(`ch-${lObjProjectId}`, createActivity);

                if (output !== null) return Response.success(res, 'Your project has been deleted successfully');
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        getProjectsList: async(req, res) => {
            try {
                let lObjUserId = req.user._id
                let queryParam = req.query.search ? req.query.search : ''
                let lAryListAllProjects = await Project.aggregate([{
                        $match: { userId: lObjUserId, projectStatus: 1 }
                    },
                    { $lookup: { from: 'screens', localField: '_id', foreignField: 'projectId', as: 'screens' } },
                    {
                        $project: {
                            _id: "$_id",
                            projectName: 1,
                            screensCount: { "$size": "$screens" }
                        }
                    },
                    { $match: { projectName: { $regex: queryParam, "$options": "i" } } },

                ])
                return Response.success(res, lAryListAllProjects, 'Project lists');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        /***********Existing code in server***************** */
        getAllProjects: async(req, res) => {
            try {
                let lObjUserId = req.user ? req.user._id : '5ca2fa96b37a9016cb17d2be'; //Testing purpose
                let lAryListAllProjects = await Project.find({ userId: lObjUserId }).lean();
                return Response.success(res, lAryListAllProjects, 'Project lists');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        updateMyProject: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectName: Joi.string().trim(),
                    description: Joi.string(),
                    industry: Joi.string().trim(),
                    tools: Joi.array().required(),
                    fonts: Joi.string().required()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjProjects = await Project.findOneAndUpdate({ _id: req.params.projectId }, { $set: req.body }, { new: true }).lean()
                console.log("lObjProjects", lObjProjects);

                return Response.success(res, lObjProjects, 'Projects updated succesfully');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        deleteMyProject: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectId: Joi.string().required()
                }).required()

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjProjects = await Projects.findOneAndUpdate({ _id: req.params.projectId }, { $set: req.body }, { new: true }).lean()
                console.log("lObjProjects", lObjProjects);

                return Response.success(res, lObjProjects, 'Projects deleted succesfully');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /********* Server code ends ****************** */
        industry: async(req, res) => {
            try {
                let lObjIndustry = await indusrty.find().lean()
                if (lObjIndustry === null) {
                    return Response.notFound(res, "No industry Found")
                } else {
                    return Response.success(res, lObjIndustry, "Industry Details")
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        insertIndustry: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    name: Joi.string().trim().required(),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let lObjProject = await Fonts.create(value)
                return Response.success(res, lObjProject, "Industry Details")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        addScreenToProject: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    'screenId': Joi.array().required(),
                    'projectId': Joi.string().required(),
                });

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                if (req.body.projectId) {
                    for (let screen of req.body.screenId) {
                        let lObjScreenDetails = await Screens.find({ _id: screen }, { _id: 1, projectId: 1, type: 1, screenName: 1, image: 1, userId: 1, colorPalette: 1 }).lean()
                        if (lObjScreenDetails.length > 0) {
                            let obj = {
                                isPublish: true,
                                type: lObjScreenDetails[0].type,
                                // sequence: 1,
                                screenName: lObjScreenDetails[0].screenName,
                                colorPalette: lObjScreenDetails[0].colorPalette,
                                parentScreen: lObjScreenDetails[0]._id,
                                parentScreenId: lObjScreenDetails[0].projectId,
                                image: lObjScreenDetails[0].image,
                                projectId: req.body.projectId,
                                inspire: true,
                                userId: req.user._id,
                                approvedStatus: "approved",
                            }
                            let lObjResScreen = await Screens.create(obj);

                            let versionObj = {
                                categories: lObjResScreen.categories,
                                industry: lObjResScreen.industry,
                                tags: lObjResScreen.tags,
                                isPublish: lObjResScreen.isPublish,
                                disableComments: lObjResScreen.disableComments,
                                colorPalette: lObjResScreen.colorPalette,
                                approvedStatus: lObjResScreen.approvedStatus,
                                viewCount: lObjResScreen.viewCount,
                                viewedUser: lObjResScreen.viewedUser,
                                screenStatus: lObjResScreen.screenStatus,
                                uploadStatus: lObjResScreen.uploadStatus,
                                inspire: lObjResScreen.inspire,
                                parentId: lObjResScreen._id,
                                screenName: lObjResScreen.screenName,
                                image: lObjResScreen.image,
                                userId: lObjResScreen.userId,
                                description: lObjResScreen.description,
                                sequence: lObjResScreen.sequence
                            }

                            let version = await screenVersion.create(versionObj);
                            await Screens.findOneAndUpdate({ _id: ObjectId(version.parentId) }, { $set: { screenVersionId: version._id } }, { new: true });
                            await ProjectScreen.create({
                                projectId: req.body.projectId,
                                screenId: version.parentId
                            });

                            let lObjScreens = await ProjectScreen.aggregate([{
                                    $match: { projectId: ObjectId(req.body.projectId), screenId: ObjectId(version.parentId) }
                                },
                                {
                                    $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screens' }
                                },
                                {
                                    $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true }
                                },
                                { $match: { 'screens.screenStatus': 1 } },
                                {
                                    $lookup: { from: 'users', localField: 'screens.userId', foreignField: '_id', as: 'userId' }
                                },
                                {
                                    $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true }
                                },
                                {
                                    $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projectId" }
                                },
                                {
                                    $unwind: { path: '$projectId', 'preserveNullAndEmptyArrays': true }
                                },
                                {
                                    $lookup: { from: 'screenratings', localField: '_id', foreignField: "screenId", as: "screenratings" }
                                },
                                {
                                    $unwind: { path: "$screenratings", "preserveNullAndEmptyArrays": true }
                                },
                                {
                                    $lookup: { from: "screenratingtypes", localField: "screenratings.ratingTypeId", foreignField: "_id", as: "screenratingtypes" }
                                },
                                {
                                    $unwind: { path: "$screenratingtypes", "preserveNullAndEmptyArrays": true }
                                },
                                {
                                    $group: {
                                        "_id": {
                                            "ratingTypeId": "$screenratings.ratingTypeId",
                                            "screenId": "$screenId"
                                        },
                                        "count": { $sum: 1 },
                                        "createdAt": { $first: "$screens.createdAt" },
                                        "screenId": { $first: "$screenId" },

                                        "isPublish": { $first: "$screens.isPublish" },
                                        "colorPalette": { $first: "$screens.colorPalette" },
                                        "approvedStatus": { $first: "$screens.approvedStatus" },
                                        "screenStatus": { $first: "$screens.screenStatus" },
                                        "screenName": { $first: "$screens.screenName" },
                                        "screenType": {
                                            $first: {
                                                "_id": "$screenType._id",
                                                "type": "$screenType.type"
                                            }
                                        },
                                        "font": { $first: "$font" },
                                        "type": { $first: "$type" },
                                        "projectId": {
                                            $first: {
                                                "_id": "$projectId._id",
                                                "projectName": "$projectId.projectName",
                                                "description": "$projectId.description",
                                            }
                                        },
                                        "inspire": { $first: "$screens.inspire" },
                                        "images": { $first: "$screens.image" },
                                        "sequence": { $first: "$screens.sequence" },
                                        "userId": {
                                            $first: {
                                                "_id": "$userId._id",
                                                "userName": "$userId.userName",
                                                "email": "$userId.email"
                                            }
                                        },
                                        "RatingType": {
                                            $first: {
                                                "_id": "$screenratingtypes._id",
                                                "name": "$screenratingtypes.name",
                                                "icon": "$screenratingtypes.icon"
                                            }
                                        },
                                        "description": { $first: "$screens.description" }

                                    }
                                },
                                {
                                    $sort: { "count": -1 }
                                },

                                {
                                    $project: {
                                        rating: {
                                            $cond: [{ $not: ["$RatingType._id"] }, 0, "$count"]
                                        },
                                        "RatingType": 1,
                                        "screenId": 1,
                                        "createdAt": 1,
                                        "isPublish": 1,
                                        "colorPalette": 1,
                                        "approvedStatus": 1,
                                        "screenStatus": 1,
                                        "screenName": 1,
                                        "sequence": { "$ifNull": ["$sequence", 999999] },
                                        "screenType": 1,
                                        "font": 1,
                                        "type": 1,
                                        "projectId": 1,
                                        "inspire": 1,
                                        "images": {
                                            $cond: {
                                                if: { $eq: ['$inspire', false] },
                                                then: {
                                                    $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$images"] }, ""]
                                                },
                                                else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$images"] }, ""] }
                                            }
                                        },
                                        "userId": 1,
                                        "ScreenRating": 1,
                                        "description": 1
                                    }
                                },
                                {
                                    $group: {
                                        "_id": "$_id.screenId",
                                        "screenId": { $first: "$_id.screenId" },
                                        "isPublish": { $first: "$isPublish" },
                                        "createdAt": { $first: "$createdAt" },
                                        "colorPalette": { $first: "$colorPalette" },
                                        "approvedStatus": { $first: "$approvedStatus" },
                                        "screenStatus": { $first: "$screenStatus" },
                                        "screenName": { $first: "$screenName" },
                                        "screenType": {
                                            $first: "$screenType"
                                        },
                                        "font": { $first: "$font" },
                                        "type": { $first: "$type" },
                                        "inspire": { $first: "$inspire" },
                                        "projectId": {
                                            $first: "$projectId"

                                        },
                                        "images": { $first: "$images" },
                                        "userId": {
                                            $first: "$userId"
                                        },
                                        "sequence": { $first: "$sequence" },
                                        "screenRating": {
                                            $first: "$RatingType"
                                        },
                                        "ratingCount": {
                                            $first: "$rating"
                                        },
                                        "description": { $first: "$description" }
                                    }

                                },
                                {
                                    $sort: { "sequence": 1, "createdAt": 1 }
                                }

                            ]);
                            if (lObjScreens === null) {
                                return Response.notAuthorized(res, "You're not authorized to perform this action")
                            } else {
                                lObjScreens = await Promise.all(lObjScreens.map(async(v) => {
                                    let screenId = v._id;

                                    let versionID = await screenVersion.find({ parentId: screenId, screenStatus: 1 }).sort({ createdAt: 1 });
                                    versionID = versionID.slice(1)
                                    if (versionID.length > 0) {
                                        let arr = [];
                                        let len = versionID.length - 1;
                                        for (let [i, x] of versionID.entries()) {
                                            if (x.inspire == false) {
                                                url = process.env.AWS_URL + x.image;
                                                x.image = url;
                                            } else {
                                                url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + x.image;
                                                x.image = url;
                                            }
                                            arr.push(x);
                                            if ((x.parentId).toString() === (v._id).toString() && i === len) {
                                                v.versions = arr;
                                            }
                                        }
                                        return v;
                                    } else {
                                        v.versions = [];
                                        return v;
                                    }

                                }))

                                lObjScreens = lObjScreens.filter(x => {
                                    return x.screenStatus != null;
                                })
                            }

                            // inspire screen lag activity
                            let inspireAct = await InspireScreen.create({
                                projectId: req.body.projectId,
                                userId: req.user._id,
                                screenId: lObjScreens[0],
                                type: 'inspireScreen'
                            })
                            let activity = await InspireScreen.findOne({ _id: inspireAct._id }).populate('userId', '_id firstName lastName userName')
                            pusherNotif.inspireActivity(`ch-${req.body.projectId}`, activity);

                            let ActivityFeed = await activityFeed.create({
                                projectId: req.body.projectId,
                                userId: req.user._id,
                                message: `uploaded ${req.body.screenId.length} screen(s) from inspire`,
                                type: 'activity'
                            });

                            let activityF = await activityFeed.findOne({ _id: ActivityFeed._id }).populate('userId', '_id firstName lastName userName')
                            pusherNotif.activitySocket(`ch-${req.body.projectId}`, activityF);
                            // return Response.success(res, lObjResScreen, 'Screens added to project succesfully');
                        }
                    }
                }
                return Response.success(res, '', 'Screens created succesfully');
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        getProjectScreens: async(req, res) => {
            try {
                let lObjProjectId = req.query.projectId;
                let screenName = req.query.screenName ? req.query.screenName : "";
                let imageType = req.query.imageType ? req.query.imageType : 'all';
                let type = req.query.type ? req.query.type : 'all';
                console.log(type)
                let lObjMatch
                if (type == 'published') {
                    lObjMatch = { projectId: ObjectId(lObjProjectId), isPublish: true, approvedStatus: 'approved', screenStatus: { $ne: 0 }, parentScreen: { $exists: false }, screenName: { $regex: screenName, "$options": "i" }, type: imageType }
                } else if (type == 'saved') {
                    lObjMatch = { projectId: ObjectId(lObjProjectId), isPublish: false, approvedStatus: 'in-review', screenStatus: { $ne: 0 }, parentScreen: { $exists: false }, screenName: { $regex: screenName, "$options": "i" }, type: imageType }

                } else if (type == 'inspiration') {
                    lObjMatch = { projectId: ObjectId(lObjProjectId), parentScreen: { $exists: true }, screenStatus: { $ne: 0 }, screenName: { $regex: screenName, "$options": "i" }, type: imageType }

                } else if (type == 'inReview') {
                    lObjMatch = { projectId: ObjectId(lObjProjectId), isPublish: true, approvedStatus: 'in-review', screenStatus: { $ne: 0 }, screenName: { $regex: screenName, "$options": "i" }, type: imageType }

                } else {
                    lObjMatch = { projectId: ObjectId(lObjProjectId), screenName: { $regex: screenName, "$options": "i" }, screenStatus: { $ne: 0 }, type: imageType }
                }

                if (screenName == "") await delete lObjMatch.screenName
                if (imageType == 'all') await delete lObjMatch.type;
                // var allCount = await Screens.count({ projectId: ObjectId(lObjProjectId), screenStatus: { $ne: 0 } })
                // var inspirationCount = await Screens.count({ projectId: ObjectId(lObjProjectId), screenStatus: { $ne: 0 }, parentScreen: { $exists: true } })
                // var savedCount = await Screens.count({ projectId: ObjectId(lObjProjectId), approvedStatus: 'in-review', screenStatus: { $ne: 0 }, isPublish: false, parentScreen: { $exists: false } })
                // var publishedCount = await Screens.count({ projectId: ObjectId(lObjProjectId), isPublish: true, screenStatus: { $ne: 0 }, approvedStatus: 'approved', parentScreen: { $exists: false } })
                // var inReviewCount = await Screens.count({ projectId: ObjectId(lObjProjectId), isPublish: true, screenStatus: { $ne: 0 }, approvedStatus: 'in-review', parentScreen: { $exists: false } })

                await console.log(lObjMatch)
                let lObjScreens = await Screens.aggregate([{
                        $match: lObjMatch
                    },
                    {
                        $lookup: { from: "screentypes", localField: "screenType", foreignField: "_id", as: "screenType" }
                    },
                    {
                        $unwind: { path: '$screenType', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' }
                    },
                    {
                        $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projectId" }
                    },
                    {
                        $unwind: { path: '$projectId', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: "categories", localField: "categories", foreignField: "_id", as: "categories" }
                    },
                    {
                        $unwind: { path: '$categories', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: 'screenratings', localField: '_id', foreignField: "screenId", as: "screenratings" }
                    },
                    {
                        $unwind: { path: "$screenratings", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $lookup: { from: "screenratingtypes", localField: "screenratings.ratingTypeId", foreignField: "_id", as: "screenratingtypes" }
                    },
                    {
                        $unwind: { path: "$screenratingtypes", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "tags" }
                    },
                    {
                        $unwind: { path: "$tags", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $group: {
                            "_id": {
                                "ratingTypeId": "$screenratings.ratingTypeId",
                                "screenId": "$_id"
                            },
                            "count": { $sum: 1 },
                            "createdAt": { $first: "$createdAt" },
                            "screenId": { $first: "$_id.screenId" },

                            "categories": {
                                $first: {
                                    "_id": "$categories._id",
                                    "name": "$categories.name"
                                }
                            },
                            "tags": {
                                $push: {
                                    "_id": "$tags._id",
                                    "name": "$tags.name"
                                }
                            },
                            "isPublish": { $first: "$isPublish" },
                            "colorPalette": { $first: "$colorPalette" },
                            "approvedStatus": { $first: "$approvedStatus" },
                            "screenStatus": { $first: "$screenStatus" },
                            "screenName": { $first: "$screenName" },
                            "screenType": {
                                $first: {
                                    "_id": "$screenType._id",
                                    "type": "$screenType.type"
                                }
                            },
                            "font": { $first: "$font" },
                            "type": { $first: "$type" },
                            "projectId": {
                                $first: {
                                    "_id": "$projectId._id",
                                    "projectName": "$projectId.projectName",
                                    "description": "$projectId.description",
                                }
                            },
                            "images": { $first: "$image" },
                            "userId": {
                                $first: {
                                    "_id": "$userId._id",
                                    "userName": "$userId.userName",
                                    "email": "$userId.email"
                                }
                            },
                            "RatingType": {
                                $first: {
                                    "_id": "$screenratingtypes._id",
                                    "name": "$screenratingtypes.name",
                                    "icon": "$screenratingtypes.icon"
                                }
                            },
                            "description": { $first: "$description" }

                        }
                    },
                    {
                        $sort: { "count": -1 }
                    },

                    {
                        $project: {
                            rating: {
                                $cond: [{ $not: ["$RatingType._id"] }, 0, "$count"]
                            },
                            "RatingType": 1,
                            "screenId": 1,
                            "categories": 1,
                            "createdAt": 1,
                            "tags": 1,
                            "isPublish": 1,
                            "colorPalette": 1,
                            "approvedStatus": 1,
                            "screenStatus": 1,
                            "screenName": 1,
                            "screenType": 1,
                            "font": 1,
                            "type": 1,
                            "projectId": 1,
                            "images": {
                                $cond: {
                                    if: { $eq: ['$inspire', false] },
                                    then: {
                                        $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$images"] }, ""]
                                    },
                                    else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$images"] }, ""] }
                                }
                            },
                            "userId": 1,
                            "ScreenRating": 1,
                            "description": 1
                        }
                    },
                    {
                        $group: {
                            "_id": "$_id.screenId",
                            "screenId": { $first: "$_id.screenId" },
                            "categories": {
                                $first: "$categories"
                            },
                            "tags": { $first: "$tags" },
                            "isPublish": { $first: "$isPublish" },
                            "createdAt": { $first: "$createdAt" },
                            "colorPalette": { $first: "$colorPalette" },
                            "approvedStatus": { $first: "$approvedStatus" },
                            "screenStatus": { $first: "$screenStatus" },
                            "screenName": { $first: "$screenName" },
                            "screenType": {
                                $first: "$screenType"
                            },
                            "font": { $first: "$font" },
                            "type": { $first: "$type" },
                            "projectId": {
                                $first: "$projectId"

                            },
                            "images": { $first: "$images" },
                            "userId": {
                                $first: "$userId"
                            },
                            "screenRating": {
                                $first: "$RatingType"
                            },
                            "ratingCount": {
                                $first: "$rating"
                            },
                            "description": { $first: "$description" }
                        }

                    },
                    {
                        $sort: { "createdAt": 1 }
                    },
                    // { $group: { _id: "$type", screens: { $push: "$$ROOT" } } },

                ])
                console.log(lObjScreens)
                if (lObjScreens === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    if (lObjScreens.length > 0) {
                        // for (let screen of lObjScreens) {
                        //     screen.tags = _.filter(screen.tags, function (x) {
                        //         if (Object.keys(x).length) {
                        //             return x;
                        //         }
                        //     })
                        //     console.log(screen.tags)
                        // }
                        // lObjScreens[0].count = {
                        //     published: publishedCount,
                        //     saved: savedCount,
                        //     all: allCount,
                        //     inspiration: inspirationCount,
                        //     inReviewCount: inReviewCount
                        // }
                    } else {
                        lObjScreens = [{
                            // count: {
                            //     published: publishedCount,
                            //     saved: savedCount,
                            //     all: allCount,
                            //     inspiration: inspirationCount,
                            //     inReviewCount: inReviewCount
                            // },
                            _id: 'mobile',
                            screens: []
                        }]
                    }
                    // lObjScreens = lObjScreens ? lObjScreens[0] : {}
                    return Response.success(res, lObjScreens, "Screen Details")
                }

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },


        getScreensById: async(req, res) => {
            try {
                let lObjProjectId = req.query.projectId;
                lObjMatch = { projectId: ObjectId(lObjProjectId), forfocusgroup: false }
                let lObjScreens = await ProjectScreen.aggregate([{
                        $match: lObjMatch
                    },
                    {
                        $lookup: { from: 'screens', localField: 'screenId', foreignField: '_id', as: 'screens' }
                    },
                    {
                        $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true }
                    },
                    { $match: { 'screens.screenStatus': 1 } },
                    {
                        $lookup: { from: 'users', localField: 'screens.userId', foreignField: '_id', as: 'userId' }
                    },
                    {
                        $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projectId" }
                    },
                    {
                        $unwind: { path: '$projectId', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: 'screenratings', localField: '_id', foreignField: "screenId", as: "screenratings" }
                    },
                    {
                        $unwind: { path: "$screenratings", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $lookup: { from: "screenratingtypes", localField: "screenratings.ratingTypeId", foreignField: "_id", as: "screenratingtypes" }
                    },
                    {
                        $unwind: { path: "$screenratingtypes", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $group: {
                            "_id": {
                                "ratingTypeId": "$screenratings.ratingTypeId",
                                "screenId": "$screenId"
                            },
                            "count": { $sum: 1 },
                            "createdAt": { $first: "$screens.createdAt" },
                            "screenId": { $first: "$screenId" },

                            "isPublish": { $first: "$screens.isPublish" },
                            "colorPalette": { $first: "$screens.colorPalette" },
                            "approvedStatus": { $first: "$screens.approvedStatus" },
                            "screenStatus": { $first: "$screens.screenStatus" },
                            "screenName": { $first: "$screens.screenName" },
                            "screenType": {
                                $first: {
                                    "_id": "$screenType._id",
                                    "type": "$screenType.type"
                                }
                            },
                            "font": { $first: "$font" },
                            "type": { $first: "$type" },
                            "projectId": {
                                $first: {
                                    "_id": "$projectId._id",
                                    "projectName": "$projectId.projectName",
                                    "description": "$projectId.description",
                                }
                            },
                            "inspire": { $first: "$screens.inspire" },
                            "images": { $first: "$screens.image" },
                            "sequence": { $first: "$screens.sequence" },
                            "userId": {
                                $first: {
                                    "_id": "$userId._id",
                                    "userName": "$userId.userName",
                                    "email": "$userId.email"
                                }
                            },
                            "RatingType": {
                                $first: {
                                    "_id": "$screenratingtypes._id",
                                    "name": "$screenratingtypes.name",
                                    "icon": "$screenratingtypes.icon"
                                }
                            },
                            "description": { $first: "$screens.description" }

                        }
                    },
                    {
                        $sort: { "count": -1 }
                    },

                    {
                        $project: {
                            rating: {
                                $cond: [{ $not: ["$RatingType._id"] }, 0, "$count"]
                            },
                            "RatingType": 1,
                            "screenId": 1,
                            "createdAt": 1,
                            "isPublish": 1,
                            "colorPalette": 1,
                            "approvedStatus": 1,
                            "screenStatus": 1,
                            "screenName": 1,
                            "sequence": { "$ifNull": ["$sequence", 999999] },
                            "screenType": 1,
                            "font": 1,
                            "type": 1,
                            "projectId": 1,
                            "inspire": 1,
                            "images": {
                                $cond: {
                                    if: { $eq: ['$inspire', false] },
                                    then: {
                                        $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$images"] }, ""]
                                    },
                                    else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$images"] }, ""] }
                                }
                            },
                            "userId": 1,
                            "ScreenRating": 1,
                            "description": 1
                        }
                    },
                    {
                        $group: {
                            "_id": "$_id.screenId",
                            "screenId": { $first: "$_id.screenId" },
                            "isPublish": { $first: "$isPublish" },
                            "createdAt": { $first: "$createdAt" },
                            "colorPalette": { $first: "$colorPalette" },
                            "approvedStatus": { $first: "$approvedStatus" },
                            "screenStatus": { $first: "$screenStatus" },
                            "screenName": { $first: "$screenName" },
                            "screenType": {
                                $first: "$screenType"
                            },
                            "font": { $first: "$font" },
                            "type": { $first: "$type" },
                            "inspire": { $first: "$inspire" },
                            "projectId": {
                                $first: "$projectId"

                            },
                            "images": { $first: "$images" },
                            "userId": {
                                $first: "$userId"
                            },
                            "sequence": { $first: "$sequence" },
                            "screenRating": {
                                $first: "$RatingType"
                            },
                            "ratingCount": {
                                $first: "$rating"
                            },
                            "description": { $first: "$description" }
                        }

                    },
                    {
                        $sort: { "sequence": 1, "createdAt": 1 }
                    }

                ])
                if (lObjScreens === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    lObjScreens = await Promise.all(lObjScreens.map(async(v) => {
                        let screenId = v._id;

                        let versionID = await screenVersion.find({ parentId: screenId, screenStatus: 1 }).sort({ createdAt: 1 });
                        versionID = versionID.slice(1)
                        if (versionID.length > 0) {
                            let arr = [];
                            let len = versionID.length - 1;
                            for (let [i, x] of versionID.entries()) {
                                if (x.inspire == false) {
                                    url = process.env.AWS_URL + x.image;
                                    x.image = url;
                                } else {
                                    url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + x.image;
                                    x.image = url;
                                }
                                arr.push(x);
                                if ((x.parentId).toString() === (v._id).toString() && i === len) {
                                    v.versions = arr;
                                }
                            }
                            return v;
                        } else {
                            v.versions = [];
                            return v;
                        }

                    }))

                    lObjScreens = lObjScreens.filter(x => {
                        return x.screenStatus != null;
                    })

                    return Response.success(res, lObjScreens, "Screen Details")
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        /**
         * Get screens with screen versioning
         * 
         */
        getScreenVersionById: async(req, res) => {
            try {
                let lObjProjectId = req.query.projectId;
                let lObjScreenId = req.query.screenId;
                lObjMatch = { projectId: ObjectId(lObjProjectId), parentId: ObjectId(lObjScreenId) }
                let lObjScreens = await screenVersion.aggregate([{
                        $match: lObjMatch
                    },
                    { $sort: { 'version': -1 } },
                    {
                        $lookup: { from: "screens", localField: "screenId", foreignField: "_id", as: "screens" }
                    },
                    {
                        $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' }
                    },
                    {
                        $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projectId" }
                    },
                    {
                        $unwind: { path: '$projectId', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $lookup: { from: 'screenratings', localField: '_id', foreignField: "screenId", as: "screenratings" }
                    },
                    {
                        $unwind: { path: "$screenratings", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $lookup: { from: "screenratingtypes", localField: "screenratings.ratingTypeId", foreignField: "_id", as: "screenratingtypes" }
                    },
                    {
                        $unwind: { path: "$screenratingtypes", "preserveNullAndEmptyArrays": true }
                    },
                    {
                        $project: {
                            "RatingType": 1,
                            "screenId": 1,
                            "version": 1,
                            "createdAt": '$screens.createdAt',
                            "isPublish": '$screens.isPublish',
                            "colorPalette": '$screens.colorPalette',
                            "approvedStatus": '$screens.approvedStatus',
                            "screenStatus": '$screens.screenStatus',
                            "screenName": '$screens.screenName',
                            "sequence": { "$ifNull": ["$sequence", 999999] },
                            "screenType": 1,
                            "font": 1,
                            "type": 1,
                            "projectId": "$projctId._id",
                            "projectTools": "$projectId.tools",
                            "projectStatus": "$projectId.projectStatus",
                            "teamMembers": "$projectId.teamMembers",
                            "projectName": "$projectId.projectName",
                            "description": "$projectId.description",
                            "createdUser": "$projectId.userId",
                            "channelName": "$projectId.channelName",
                            "inspire": "$screens.inspire",
                            "images": {
                                $cond: {
                                    if: { $eq: ['$inspire', false] },
                                    then: {
                                        $ifNull: [{ $concat: [`${process.env.AWS_URL}`, "$image"] }, ""]
                                    },
                                    else: { $ifNull: [{ $concat: [`https://d31qgkthzchm5g.cloudfront.net/screens/`, "$image"] }, ""] }
                                }
                            },
                            "ScreenRating": "$screens.ScreenRating",
                            "description": "$screens.description"
                        }
                    }

                ])
                console.log(lObjScreens)
                if (lObjScreens === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {

                    return Response.success(res, lObjScreens, "Screen Details")
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },


        getFGList: async(req, res) => {
            try {
                let lObjProjectId = req.query.projectId;
                lObjMatch = { projectId: ObjectId(lObjProjectId), screenStatus: { $ne: 0 } }
                let lObjFocusGroup = await FocusGroup.find({ lObjMatch }).select('groupName').lean()
                return Response.success(res, lObjFocusGroup, "Focus Group List Details")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        removeScreen: async(req, res) => {
            try {
                let screenId = req.query.screenId;
                let projectDetail = await ProjectScreen.findOne({ screenId: ObjectId(screenId) }).populate('projectId', "projectName")
                let projectScreen = await ProjectScreen.deleteOne({ screenId: ObjectId(screenId) });
                let delteScreen = await Screens.findOneAndUpdate({ _id: ObjectId(screenId) }, { $set: { screenStatus: 0 } });
                let screenVersions = await screenVersion.updateMany({ parentId: ObjectId(screenId) }, { $set: { screenStatus: 0 } });
                let inspireSection = await InspireScreen.deleteOne({ "screenId._id": ObjectId(screenId) });

                console.log(projectDetail)

                let createActivity = await activityFeed.create({
                    projectId: projectDetail.projectId._id,
                    userId: req.user._id,
                    message: `removed a screen from ${projectDetail.projectId.projectName} project'`,
                    type: 'activity'
                })

                let activity = await activityFeed.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                pusherNotif.activitySocket(`ch-${projectDetail.projectId._id}`, activity)

                return Response.success(res, delteScreen, "Screen successfully deleted")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        getProjectScreensById: async(req, res) => {
            try {
                let lObjProjectId = req.params.projectId;

                // let lObjScreens = await Screens.find({ projectId: ObjectId(lObjProjectId), screenStatus: { $ne: 0 } }).populate('screenType', '_id type')
                //     .populate('userId', '_id email userName')
                //     .populate('categories', '_id name')
                //     .populate('tags', '_id name')
                //     .sort({ "createdAt": -1 }).lean()

                let lObjScreens = await ProjectScreen.aggregate([
                    { $match: { projectId: ObjectId(lObjProjectId), forfocusgroup: false } },
                    {
                        $lookup: { from: "screens", localField: "screenId", foreignField: "_id", as: "screens" }
                    },
                    {
                        $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $match: { 'screens.screenStatus': 1 }
                    },
                    {
                        $lookup: { from: "users", localField: "screens.userId", foreignField: "_id", as: "users" }
                    },
                    {
                        $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true }
                    },
                    {
                        $project: {
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
                            "userId": {
                                "_id": "$users._id",
                                "userName": "$users.userName",
                                "email": "$users.email"
                            },
                            "description": "$screens.description",
                            "sequence": "$screens.sequence",
                            "createdAt": "$screens.createdAt",
                            "updatedAt": "$screens.updatedAt",
                            "images": "$screens.images",
                            "screenType": "$screens.screenType",
                            "font": "$screens.font",
                            "projectScreenId": "$_id",
                            "projectId": "$projectId"
                        }
                    },
                    {
                        $sort: { 'sequence': 1 }
                    },
                ]);

                lObjScreens = lObjScreens.filter(v => {
                    if (v.hasOwnProperty('_id') && v.screenStatus != null) {
                        return v;
                    }
                })



                if (lObjScreens === null) {
                    return Response.notAuthorized(res, "You're not authorized to perform this action")
                } else {
                    for (let screen of lObjScreens) {
                        if (screen.inspire == true) {
                            screen.images = `https://d31qgkthzchm5g.cloudfront.net/screens/${screen.image}`;
                        } else {
                            screen.images = `${process.env.AWS_URL}${screen.image}`;
                        }
                        screen.screenName = screen.screenName ? screen.screenName : ''
                        screen.screenType = screen.screenType ? screen.screenType : ''
                        screen.description = screen.description ? screen.description : ''
                        screen.font = screen.font ? screen.font : ''

                        //version
                        let versions = await screenVersion.find({ parentId: screen._id, screenStatus: 1 }).lean();
                        versions = versions.slice(1);
                        for (let x of versions) {
                            if (x.inspire == true) {
                                x.images = `https://d31qgkthzchm5g.cloudfront.net/screens/${x.image}`;
                            } else {
                                x.images = `${process.env.AWS_URL}${x.image}`;
                            }
                            x.screenName = x.screenName ? x.screenName : ''
                            x.screenType = x.screenType ? x.screenType : ''
                            x.description = x.description ? x.description : ''
                            x.font = x.font ? x.font : ''
                        }
                        screen.versions = versions;

                    }
                    return Response.success(res, lObjScreens, "Screen Details")
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        getScreenImages: async(req, res) => {
            try {
                let lObjScreens = await Screens.find({}).lean()
                for (let screen of lObjScreens) {
                    if (screen.images) {
                        await Screens.update({ _id: ObjectId(screen._id) }, { $set: { image: screen.images } })
                        await Screens.update({ _id: ObjectId(screen._id) }, { $unset: { images: 1 } })
                    }
                }
                let lObjScreenAfterUpdate = await Screens.find({}).lean()
                return Response.success(res, lObjScreenAfterUpdate, "Screen Details")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        listOfTools: async(req, res) => {
            try {
                let lObjScreens = await Toools.find({}).lean()
                return Response.success(res, lObjScreens, "Tools List")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        listOfFonts: async(req, res) => {
            try {
                let lObjScreens = await Fonts.find({}).lean()
                return Response.success(res, lObjScreens, "Tools List")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        createProject: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectName: Joi.string().trim(),
                    description: Joi.string().trim().allow(''),
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let lObjProjectList = await Project.find({ userId: ObjectId(req.user._id), projectStatus: 1 }).select('_id').lean()
                for (let projectId of lObjProjectList) {
                    let lObprojectId = await Project.aggregate([{
                            $match: {
                                userId: ObjectId(req.user._id),
                                _id: ObjectId(projectId._id)
                            }
                        },
                        { $lookup: { from: 'project_screens', localField: '_id', foreignField: 'projectId', as: 'project_screens' } },
                        { $unwind: { path: '$project_screens', 'preserveNullAndEmptyArrays': true } },
                        {
                            $match: {
                                "project_screens.forfocusgroup": false
                            }
                        },
                        { $lookup: { from: 'screens', localField: 'project_screens.screenId', foreignField: '_id', as: 'screens' } },
                        { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                        { $match: { 'screens.screenStatus': 1 } },
                        // {
                        //     $project: {
                        //         name: "$projectName",
                        //         screens: {
                        //             $filter: {
                        //                 input: "$screens",
                        //                 as: "screen",
                        //                 cond: { $gte: ["$$screen.screenStatus", 1] }
                        //             }
                        //         }

                        //     }
                        // }
                        {
                            $group: {
                                "_id": "$_id",
                                name: { $first: "$projectName" },
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
                        }
                    ]);


                    if (lObprojectId.length > 0) {
                        console.log(lObprojectId[0].screens.length)
                        if (lObprojectId[0].screens.length == 0) {
                            let lObjResult = {
                                _id: lObprojectId[0]._id
                            }
                            return Response.successEmpty(res, lObjResult, "There is an incomplete Project!!");
                        }
                    }
                    //         screensCount: { $size: "$screens" },
                    //         _id: 1

                    //     }
                    // }
                    // ])
                    // if (lObprojectId[0].screensCount == 0) {
                    //     let lObjResult = {
                    //         _id: lObprojectId[0]._id
                    //     }
                    //     return Response.successEmpty(res, lObjResult, `There is an incomplete project!!`);
                    // }
                }
                let lObjProject;
                if (value.projectName) {
                    let checkUserProjectName = await Project.find({
                        $and: [{
                            userId: req.user._id,
                            projectName: req.body.projectName,
                            projectStatus: 1
                        }]
                    })

                    if (checkUserProjectName.length > 0) {
                        return Response.badValues(res, `Another project under the name ${req.body.projectName} already exists`);
                    }
                    value.userId = req.user._id;
                    value.inviteMembers = [];
                    lObjProject = await Project.create(value)
                    await ProjectTeamMember.create({
                        projectId: lObjProject._id,
                        projectTeamMember: {
                            userId: req.user._id,
                            email: req.user.email,
                            firstName: req.user.firstName
                        },
                        createdBy: req.user._id
                    });

                } else {
                    let projectNameArray = ["Blue", "Diamond", "Falcon", "Phoenix", "Eagle", "Lion"]
                    var rand = projectNameArray[Math.floor(Math.random() * projectNameArray.length)];
                    let check = await Project.find({
                        $and: [{
                            projectName: { $regex: `${rand}`, $options: 'i' },
                            userId: req.user._id,
                            projectStatus: 1
                        }]
                    })
                    let name = ""
                    if (check.length > 0) {
                        name = `${check.length}`
                    }
                    let value = {
                        projectName: `${rand}` + name,
                        description: '',
                        userId: req.user._id,
                        inviteMembers: []
                    }
                    lObjProject = await Project.create(value)
                    await ProjectTeamMember.create({
                        projectId: lObjProject._id,
                        projectTeamMember: {
                            userId: req.user._id,
                            email: req.user.email,
                            firstName: req.user.firstName
                        },
                        createdBy: req.user._id
                    });

                    let teamId = '5eb10b2d2da22e2921dab632';

                    let isTeamExsist = await teamMembers.find({
                        teamId: ObjectId(teamId),
                        status: 1,
                        $or: [
                            { email: req.user.email },
                            { createdUser: req.user._id }
                        ],
                    }).sort({ createdAt: -1 });

                    if (isTeamExsist.length > 0) {
                        getAllTeamMembers(teamId, lObjProject._id, req.user._id)
                    }
                    // Commented by Firnaas
                    // let checkTeamMember = await teamMembers.find({
                    //     createdUser: req.user._id,
                    //     status: 1
                    // }).select("email");
                    // let mailData = [];
                    // checkTeamMember.forEach(v => {
                    //     mailData.push(v.email);
                    // })
                    // mailer.teamMemberInvite(mailData);

                }

                await Project.findOneAndUpdate({ _id: lObjProject._id }, {
                    $set: {
                        channelName: `ch-${lObjProject._id}`
                    }
                });



                // Commented by Firnaas
                // let createActivity = await activityFeed.create({
                //     projectId: lObjProject._id,
                //     userId: req.user._id,
                //     message: `created a project ${lObjProject.projectName}`,
                //     type: 'activity'
                // })

                // pusherNotif.activitySocket(`ch-${lObjProject._id}`, createActivity);

                return Response.success(res, lObjProject, 'Project created succesfully');

            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        updateProjectDetails: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectName: Joi.string().trim().allow(''),
                    description: Joi.string().trim().allow(''),
                    projectId: Joi.string().trim().required()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                //Group Id
                let lObjProjectId = req.body.projectId;
                let lObjUpdatedProject = await Project.findOneAndUpdate({
                    _id: lObjProjectId
                }, {
                    $set: value
                }, {
                    new: true
                });

                return Response.success(res, lObjUpdatedProject, 'Project updated succesfully');

            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        storeColour: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectId: Joi.string().trim(),
                    colour: Joi.array().allow(''),
                    font: Joi.array().allow(''),
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                var type = req.query.type;
                var font = req.body.font;
                var colour = req.body.colour;
                var exists = await styleGuide.findOne({ projectId: req.body.projectId })

                if (exists) {

                    if (type == "colour") {

                        // let colour = req.body.colour

                        let store = await styleGuide.findOneAndUpdate({ projectId: req.body.projectId }, { $set: { colour: colour } }, { new: true })
                        return Response.success(res, store, 'colour updated succesfully!!');

                    } else if (type == "font") {

                        let data = await styleGuide.findOneAndUpdate({ projectId: req.body.projectId }, { $set: { font: font } }, { new: true })
                        return Response.success(res, data, ' font updated succesfully!!');

                    } else {

                        return Response.badValues(res, 'type is required')
                    }

                } else if (type == 'colour') {

                    let create = new styleGuide({
                        colour: req.body.colour,
                        projectId: req.body.projectId,
                    });

                    let data = await create.save();
                    return Response.success(res, data, 'colour created succesfully');

                } else if (type == 'font') {

                    let fontcreate = new styleGuide({
                        font: req.body.font,
                        projectId: req.body.projectId
                    })

                    let data = await fontcreate.save();
                    return Response.success(res, data, 'font created  succesfully');
                } else {
                    return Response.badValues(res, 'invalid data')
                }


            } catch (error) {
                console.log('err', error)
                return Response.errorInternal(error, res)
            }
        },

        getStyleGuideById: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    projectId: Joi.string().trim()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let type = req.query.type;
                let exists = await styleGuide.findOne({ projectId: req.params.projectId })
                if (exists) {
                    try {
                        if (type == 'colour') {
                            let colour = await styleGuide.findOne({ projectId: req.params.projectId }, { _id: 0, font: 0, status: 0, projectId: 0 }).lean()
                            return Response.success(res, colour, 'Colour!!');

                        } else if (type == 'font') {
                            let font = await styleGuide.findOne({ projectId: req.params.projectId }, { _id: 0, colour: 0, status: 0, projectId: 0 }).lean()
                            console.log('font', font)
                            return Response.success(res, font, 'Font!!');
                        } else {
                            let style = await styleGuide.findOne({ projectId: req.params.projectId }).lean();
                            return Response.success(res, style, 'styleGuide');
                        }
                    } catch (e) {
                        console.log('e', e)
                        return Response.errorInternal(e, res)
                    }
                } else {
                    let data = {
                        projectId: req.params.projectId,
                        font: [],
                        colour: []
                    }
                    return Response.success(res, data, 'No Style guide is found');
                }

            } catch (error) {
                console.log('err', error)
                return Response.errorInternal(error, res)

            }
        },
        //delete colour and font
        deleteStyleGuide: async(req, res) => {
            try {
                let projectid = req.query.projectid;
                let data = await styleGuide.findOneAndUpdate({ projectid: projectid }, { $set: { styleguidestatus: 2 } }, { new: true })
                console.log(data)
                return Response.success(res, data, 'deleted successfully !!')

            } catch (error) {
                console.log('err', error)
                return Response.errorInternal(error, res)
            }
        },

    }
    return Object.freeze(methods)
}

module.exports = projectComponentCtrl()