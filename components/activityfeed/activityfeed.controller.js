let Activity = require('./activityfeed.model')
let Projects = require('../project/project.model')
let User = require('../user/user.model')
let Response = require('../../utils/response')
let Joi = require('joi')
let Pusher = require('../../utils/pusher')
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
let projetTeamMember = require('../project/projectTeamMember.model');

function activityFeedController() {
    const method = {
        postActivity: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    ProjectId: Joi.string().trim().required(),
                    screenId: Joi.string(),
                    message: Joi.string().required()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let isUserExistsInProjectTeamMembers = await ProjectTeamMember.exists({
                    projectId: req.query.projectId,
                    'projectTeamMember.userId': req.user._id
                });

                let checkUser = await Projects.findOne({
                    _id: req.body.ProjectId
                });

                if (!checkUser && !isUserExistsInProjectTeamMembers) {
                    return Response.badValuesData(res, 'You are not having permission to chat in this page')
                }

                let createChat = await Activity.create({
                    ProjectId: req.body.ProjectId,
                    userId: req.user._id,
                    message: req.body.message,
                    type: 'addComment'
                })
                Pusher.chatSocket(`ch-${req.body.ProjectId}`, createChat)
                return Response.success(res, createChat, 'chat created')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        listActivity: async(req, res) => {
            try {


                let projectId = req.params.projectId;
                let page = req.params.page || 1;
                let lIntDataPerPage = 10
                let skipRec = page - 1;
                skipRec = skipRec * lIntDataPerPage;

                let queryParam = req.query.name;
                let activityDetails
                if (!!queryParam) {
                    console.log("if condition");

                    activityDetails = await Activity.aggregate([
                        { $match: { projectId: ObjectId(projectId) } },
                        { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'project' } },
                        { $unwind: { path: '$project', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'users' } },
                        { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: '$_id',
                                message: { $first: '$message' },
                                type: { $first: '$type' },
                                createdAt: { $first: '$createdAt' },
                                focusGroupId: { $first: { $ifNull: ['$focusGroupId', ""] } },
                                userId: {
                                    $first: {
                                        _id: '$users._id',
                                        firstName: '$users.firstName',
                                        lastName: '$users.lastName',
                                        userName: '$users.userName',
                                        email: '$users.email',
                                        profilePicture: '$users.profilePicture'
                                    }
                                },
                                project: {
                                    $first: {
                                        _id: '$project._id',
                                        projectName: '$project.projectName'
                                    }
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        {
                            $project: {
                                message: 1,
                                type: 1,
                                createdAt: {
                                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                                },
                                focusGroupId: 1,
                                userId: 1,
                                project: 1
                            }
                        },
                        {
                            $match: { 'userId.firstName': { $regex: queryParam, "$options": "i" } }
                        },
                        {
                            $group: {
                                _id: '$createdAt',
                                activity: {
                                    $push: {
                                        message: '$message',
                                        type: '$type',
                                        focusGroupId: '$focusGroupId',
                                        userId: '$userId',
                                        project: '$project',
                                        createdAt: '$createdAt'
                                    }
                                }
                            }
                        }

                    ]).sort({ _id: -1 }).skip(skipRec).limit(lIntDataPerPage)
                } else {
                    console.log("else condition");
                    activityDetails = await Activity.aggregate([
                        { $match: { projectId: ObjectId(projectId) } },
                        { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'project' } },
                        { $unwind: { path: '$project', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'users' } },
                        { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: '$_id',
                                message: { $first: '$message' },
                                type: { $first: '$type' },
                                createdAt: { $first: '$createdAt' },
                                focusGroupId: { $first: { $ifNull: ['$focusGroupId', ""] } },
                                userId: {
                                    $first: {
                                        _id: '$users._id',
                                        firstName: '$users.firstName',
                                        lastName: '$users.lastName',
                                        userName: '$users.userName',
                                        email: '$users.email',
                                        profilePicture: '$users.profilePicture'
                                    }
                                },
                                project: {
                                    $first: {
                                        _id: '$project._id',
                                        projectName: '$project.projectName'
                                    }
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        {
                            $project: {
                                message: 1,
                                type: 1,
                                dateTime: "$createdAt",
                                createdAt: {
                                    $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                                },
                                focusGroupId: 1,
                                userId: 1,
                                project: 1
                            }
                        },
                        {
                            $group: {
                                _id: '$createdAt',
                                activity: {
                                    $push: {
                                        message: '$message',
                                        type: '$type',
                                        focusGroupId: '$focusGroupId',
                                        userId: '$userId',
                                        project: '$project',
                                        createdAt: '$dateTime'
                                    }
                                }
                            }
                        }
                    ]).sort({ _id: -1 }).skip(skipRec).limit(lIntDataPerPage)
                }

                let totalActivity = await Activity.aggregate([
                    { $match: { projectId: ObjectId(projectId) } },
                    { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'project' } },
                    { $unwind: { path: '$project', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'users' } },
                    { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: '$_id',
                            createdAt: { $first: '$createdAt' }
                        }
                    },
                    {
                        $project: {
                            createdAt: {
                                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                            }
                        }
                    },
                    { $group: { _id: '$createdAt' } }
                ])

                let data = {
                    total: totalActivity.length,
                    perPage: lIntDataPerPage,
                    currentPage: Number(page),
                    totalPage: Math.ceil(Number(totalActivity.length) / lIntDataPerPage),
                    activity: activityDetails,
                }
                return Response.success(res, data, 'Activity list')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(method)
}

module.exports = activityFeedController()