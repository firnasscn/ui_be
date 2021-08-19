require("dotenv").config();
const moment = require('moment');
const Joi = require('joi');
const ejs = require('ejs');
const esClient = require('../../elasticsearch/client');
const mailer = require('../../utils/mailService');
const Screens = require('./screens.model');
const Project = require('../project/project.model')
const Comments = require('../ratings/ratings.model');
const Response = require('../../utils/response');
const UserBadge = require('../../utils/userBadge');
const Flag = require('../flag/flag.model')
const Tags = require('../tags/tags.model')
const helper = require('../../utils/badgeProperties');
const FocusGroup = require('../focusGroup/focusGroup.model');
const BadgeProperties = require('../badgeProperties/badgeProperties.model');
const Hotspot = require('../hotspot/hotspot.model');
const User = require('../user/user.model')
const UpVote = require('../upVotes/upVotes.model')
const _ = require('lodash')
const ObjectId = require('mongoose').Types.ObjectId;
const pusherNotif = require('../../utils/pusher')
var ColorThief = require('color-thief-jimp');
const s3GetSignedURL = require('../../utils/fileUpload')
var Jimp = require('jimp');
const jwt = require("jsonwebtoken");
const exportScreens = require('../exportScreens/exportScreens.model')
let gIntDataPerPage = 10;
const jsreport = require('jsreport');
let jsReportInitialized = false;
const Notification = require('../notification/notification.model');
// const pusherNotif = require('../../utils/pusher')
// var jsreport = require('jsreport-core')()
// jsreport.use(require('jsreport-studio')({}))
// jsreport.use(require('jsreport-studio-theme-dark')({}))
// jsreport.use(require('jsreport-handlebars')({}))
// jsreport.use(require('jsreport-chrome-pdf')({}))
const fs = require('fs');
let Activity = require('../activityfeed/activityfeed.model')
const path = require('path');
const screenVersion = require('../screenversions/screenVersion.model');
const ProjectTeamMember = require('../project/projectTeamMember.model');
const ProjectScreen = require('../project/projectScreen.model');
const FGScreen = require('../focusGroup/fgProjectScreen.model');
const TeamUsers = require('../teamUsers/teamUsers.model');
const TeamUserPayment = require('../teamUserPayment/teamUserPayments.model');
// const validUrl = require('valid-url');
// const shortid = require('shortid');
// const shortUrl = require('node-url-shortener');

function JoiValidationSchema() {
    //Joi Input validation
    const schema = Joi.object().keys({
        screenName: Joi.string().trim().required(),
        screenType: Joi.string().trim().required(),
        // categories: Joi.array(),
        font: Joi.string(),
        isPublish: Joi.boolean(), //.format('YYYY-MM-DD')
        colorPalette: Joi.array(),
        tags: Joi.array(),
        contributers: Joi.string().trim(),
        responsiveImages: Joi.array(),
        projectId: Joi.string().trim().required(),
        type: Joi.string().valid(["mobile", "web"]).required(),
    }).required().options({ abortEarly: false })
    return schema;
}

function screensComponentCtrl(model) {
    const methods = {
        /**
         * Update the Screen Images only to focus group 
         */
        uploadScreenImages: async(req, res) => {
            try {
                if (!!req.fileValidationErr) {
                    return Response.badValuesData(res, req.fileValidationErr);
                } else {
                    const schema = Joi.object().keys({
                        focusGroupId: Joi.string().trim().required(),
                        screenId: Joi.string(),
                        sequence: Joi.number()
                    })

                    let { error, value } = Joi.validate(req.body, schema);
                    if (error) {
                        let lAryErrorMsg = _.map(error.details, "message")
                        return Response.badValuesData(res, lAryErrorMsg);
                    }

                    let checkUser = await FocusGroup.find({ _id: req.body.focusGroupId, "createdUser": req.user._id, groupstatus: 1 })
                    if (!checkUser.length) {
                        return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                    }
                    let lAryScreenData = [];
                    let lAryScreens = req.files;
                    for (let v of lAryScreens) {
                        let sourceImage = `https://d31qgkthzchm5g.cloudfront.net/screens/` + v.key
                        var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                            var palette = ColorThief.getPalette(sourceImage, 5);
                            return palette
                        }).catch(function(err) {
                            return false
                        });
                        let lObjRes = await Screens.create({
                            screenName: path.parse(v.originalname).name,
                            sequence: req.body.sequence,
                            isPublish: true,
                            image: v.key,
                            colorPalette: colorP,
                            focusGroupId: req.body.focusGroupId,
                            userId: req.user._id,
                            approvedStatus: "approved",
                        })
                        lObjRes.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${lObjRes.image}`;
                        lAryScreenData.push(lObjRes)
                        console.log(lObjRes)

                        let screen = {
                            _id: lObjRes._id,
                            screenName: lObjRes.screenName,
                            image: lObjRes.image,
                            screenStatus: lObjRes.screenStatus
                        }
                        console.log('screen', screen)

                        lAryScreenData['screen'] = await screen;
                        lAryScreenData.push(screen)

                        await Object.assign(lAryScreenData, screen)
                        let userData = await User.findOne({ _id: ObjectId(req.user._id) })
                        let uploadedSize = userData.uploadedSize ? userData.uploadedSize : 0
                        userData.uploadedSize = parseInt(uploadedSize) + parseInt(v.size)
                        await userData.save()
                    }
                    return Response.success(res, lAryScreenData, 'Screens uploaded succesfully');
                }
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        uploadScreenImagesToFG: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim().required(),
                    projectId: Joi.string().trim().required(),
                    // fileName: Joi.string().required(),
                    // screenName: Joi.string().required(),
                    screens: Joi.array().required(),
                    uploadStatus: Joi.boolean()
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                /**invited member user mail for finding the group */
                let teamMembers = await ProjectTeamMember.find({ projectId: req.body.projectId, 'projectTeamMember.userId': req.user._id }).select('projectId');

                for (let member of teamMembers) {
                    let checkUser = await FocusGroup.find({
                        _id: req.body.focusGroupId,
                        projectId: member.projectId,
                        groupstatus: 1
                    })
                    if (!checkUser.length) {
                        return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                    }
                }

                let lAryScreenData = [];
                let screens = req.body.screens;

                for (let screen of screens) {
                    let lObjRes = {
                        screenName: screen.screenName,
                        uploadStatus: false,
                        isPublish: false,
                        image: screen.fileName,
                        focusGroupId: req.body.focusGroupId,
                        userId: req.user._id,
                        description: "",
                        screenStatus: 0,
                        sequence: screens.indexOf(screen)
                    }
                    lObjRes.image = `${process.env.AWS_URL}${lObjRes.image}`;
                    lAryScreenData.push(lObjRes)
                }

                let emailData = [];
                let screenDetails = await Screens.insertMany(lAryScreenData, { ordered: true });

                for (let screen of screenDetails) {
                    let data = await ProjectScreen.create({
                        projectId: req.body.projectId,
                        screenId: screen._id,
                        forfocusgroup: true
                    })

                    await FGScreen.create({
                        focusGroupId: req.body.focusGroupId,
                        projectScreenId: data._id,
                        screenId: screen._id,
                        screenName: screen.screenName,
                        sequence: screen.sequence,
                        description: screen.description
                    })
                }

                //get team members 
                let projectTeamMember = await ProjectTeamMember.find({ projectId: req.body.projectId });
                let getAllMembers = await FocusGroup.findOne({ _id: ObjectId(req.body.focusGroupId) }).populate('projectId', 'projectName').lean();
                getAllMembers.screenCount = screens.length;
                getAllMembers.userName = req.user.userName;
                getAllMembers.link = `${process.env.BASE_URL}focusgroup/${req.body.focusGroupId}`
                getAllMembers.invitedMembers.forEach(v => {
                    emailData.push(v.email);
                })
                projectTeamMember.forEach(v => {
                    emailData.push(v.projectTeamMember.email);
                })
                getAllMembers.invitedMembers = emailData;
                if (!!(getAllMembers.invitedMembers) && getAllMembers.invitedMembers.length > 0) {
                    mailer.screenAdditionMailFG(getAllMembers);
                }


                //activity Feed
                let createActivity = await Activity.create({
                    projectId: req.body.projectId,
                    focusGroupId: req.body.focusGroupId,
                    userId: req.user._id,
                    message: `uploaded ${screens.length} screen(s) to '${getAllMembers.groupName} focus group'`,
                    type: 'activity'
                })
                let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                pusherNotif.activitySocket(`ch-${req.body.projectId}`, activity)

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
                            'focusGroupId': req.body.focusGroupId,
                            'projectId': req.body.projectId,
                            notificationType: 'focusGroupNotification',
                            message: `${req.user.userName} has uploaded ${screens.length} screen(s) to '${getAllMembers.groupName} focus group.`
                        })
                        let lObjNotifChannel = userData.channelName
                        let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })
                        pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                    }
                }

                return Response.success(res, screenDetails, 'Screens uploaded succesfully');

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        updateCompleteStatusFG: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim().required(),
                    projectId: Joi.string().trim().required(),
                    screenId: Joi.string(),
                    s3Response: Joi.object()
                })
                console.log(req.body, ">>>>>>>>>>>>>")
                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let v = req.body.s3Response
                console.log(v, "*********")
                let sourceImage = `${process.env.AWS_URL}` + v.Key
                var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                    var palette = ColorThief.getPalette(sourceImage, 5);
                    return palette
                }).catch(function(err) {
                    return false
                });
                let teamMembers = await ProjectTeamMember.find({ projectId: req.body.projectId, 'projectTeamMember.userId': req.user._id }).select('projectId');

                for (let member of teamMembers) {
                    let checkUser = await FocusGroup.find({
                        _id: req.body.focusGroupId,
                        projectId: member.projectId,
                        groupstatus: 1
                    })
                    if (!checkUser.length) {
                        return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                    }
                }
                let lObjFGScreen = await Screens.findByIdAndUpdate({ _id: ObjectId(req.body.screenId) }, { $set: { screenStatus: 1, image: v.Key, colorPalette: colorP, uploadStatus: true, approvedStatus: "approved" } }, { new: true })
                return Response.success(res, lObjFGScreen, 'Screens Updated succesfully');

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        uploadScreenImagesToProject: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    projectId: Joi.string().trim(),
                    // fileName: Joi.string().required(),
                    // screenName: Joi.string().required(),
                    uploadStatus: Joi.boolean(),
                    screens: Joi.array().required()
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let projectTeamMember = await ProjectTeamMember.find({
                    projectId: req.body.projectId,
                });

                /**
                 * Notification for Project and Activity Feed
                 * 03-03-2020 - start
                 */

                let projectScreens = await ProjectScreen.find({ projectId: req.body.projectId });
                let projectCreatedUser = await Project.findOne({ _id: req.body.projectId, projectStatus: 1 });

                let emailArr = [];
                let notificationIds = [];

                for (let email of projectTeamMember) {
                    emailArr.push(email.projectTeamMember.email);
                    notificationIds.push(email.projectTeamMember.userId);
                }
                emailArr = [...new Set(emailArr)];
                notificationIds = [...new Set(notificationIds)];

                if (projectScreens.length == 0) {
                    let createActivity = await Activity.create({
                        projectId: projectCreatedUser._id,
                        userId: projectCreatedUser.userId,
                        message: `created a project '${projectCreatedUser.projectName}'`,
                        type: 'activity'
                    })
                    let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${projectCreatedUser._id}`, activity);

                    let name = await User.findOne({ _id: req.user._id }).select('firstName');
                    // mail data
                    let obj = {
                        userName: req.user.userName,
                        projectName: projectCreatedUser.projectName,
                        link: `${process.env.BASE_URL}project/${projectCreatedUser._id}`,
                        emails: emailArr,
                        name: name.firstName
                    }

                    mailer.projectCreation(obj);


                    // let lNotificaionChannel;

                    // for (let y of notificationIds) {
                    //     let notifyObj = await Notification.create({
                    //         'userId': y,
                    //         projectId: req.body.projectId,
                    //         notificationType: 'projectNotification',
                    //         message: `created a project ${projectCreatedUser.projectName}.`,
                    //         createdUser: req.user._id
                    //     })

                    //     // console.log(notifyObj, "OBJECT")
                    //     let userChannel = await User.findOne({ _id: y }).select('channelName');
                    //     lNotificaionChannel = userChannel.channelName;
                    //     let Notify = await Notification.find({ _id: notifyObj._id })
                    //     pusherNotif.sendNotification(lNotificaionChannel, Notify);
                    // }

                }

                /**
                 * Notification for Project and Activity Feed
                 * 03-03-2020 - End
                 */


                let screens = req.body.screens;
                let checkUser = await Project.find({
                    _id: req.body.projectId,
                    projectStatus: 1,
                    // userId: req.user._id
                })

                // console.log(checkUser, "CHECKUSERRRRRR")

                let isUserInProjectTeamMember = await ProjectTeamMember.exists({
                    projectId: req.body.projectId,
                    'projectTeamMember.userId': req.user._id
                });

                if (!checkUser.length && !isUserInProjectTeamMember) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                }


                let lObjRes;
                let objRes = [];
                for (let screen of screens) {
                    lObjRes = {
                        screenName: screen.screenName,
                        uploadStatus: false,
                        isPublish: false,
                        image: screen.fileName,
                        userId: req.user._id,
                        description: "",
                        screenStatus: 0,
                        sequence: screens.indexOf(screen)
                    }
                    lObjRes.image = `${process.env.AWS_URL}${lObjRes.image}`;
                    objRes.push(lObjRes)
                }



                //get team members 
                let getTeamMembers = await Project.findOne({ _id: ObjectId(req.body.projectId) }).lean();
                getTeamMembers.screenCount = screens.length;
                getTeamMembers.link = `${process.env.BASE_URL}project/${getTeamMembers._id}`,
                    getTeamMembers.userName = req.user.userName;
                getTeamMembers.teamMembers = projectTeamMember.map(v => {
                    return v.projectTeamMember.email;
                })


                if (!!(getTeamMembers.teamMembers) && getTeamMembers.teamMembers.length > 0) {
                    mailer.screenAdditionMail(getTeamMembers);
                }

                let screenDetails = await Screens.insertMany(objRes, { ordered: true });
                for (let screen of screenDetails) {
                    let obj = {
                        categories: screen.categories,
                        industry: screen.industry,
                        tags: screen.tags,
                        isPublish: screen.isPublish,
                        disableComments: screen.disableComments,
                        colorPalette: screen.colorPalette,
                        approvedStatus: screen.approvedStatus,
                        viewCount: screen.viewCount,
                        viewedUser: screen.viewedUser,
                        screenStatus: screen.screenStatus,
                        uploadStatus: screen.uploadStatus,
                        inspire: screen.inspire,
                        parentId: screen._id,
                        screenName: screen.screenName,
                        image: screen.image,
                        userId: screen.userId,
                        description: screen.description,
                        sequence: screen.sequence
                    }
                    let version = await screenVersion.create(obj);
                    await Screens.findOneAndUpdate({ _id: ObjectId(version.parentId) }, { $set: { screenVersionId: version._id } }, { new: true });
                    await ProjectScreen.create({
                        projectId: req.body.projectId,
                        screenId: version.parentId
                    })
                }


                let createActivity = await Activity.create({
                    projectId: req.body.projectId,
                    userId: req.user._id,
                    message: `uploaded ${screens.length} screen(s) to '${checkUser[0].projectName}'`,
                    type: 'activity'
                })
                let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                pusherNotif.activitySocket(`ch-${req.body.projectId}`, activity)

                for (let i of projectTeamMember) {
                    if (i.projectTeamMember.userId.toString() !== req.user._id.toString()) {
                        let obj = {
                            "userId": i.projectTeamMember.userId,
                            "projectId": req.body.projectId,
                            "notificationType": 'projectNotification',
                            "message": `${req.user.userName} has uploaded ${screens.length} screen(s) to '${checkUser[0].projectName}'`
                        }
                        let lObjNotifData = await Notification.create(obj)
                        let lObjNotifChannel = (await User.findById(i.projectTeamMember.userId).select('channelName')).channelName;
                        let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })

                        pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                    }
                }

                return Response.success(res, screenDetails, 'Screens uploaded succesfully');

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        updateCompleteStatus: async(req, res) => {
            try {

                const schema = Joi.object().keys({
                    projectId: Joi.string().trim().required(),
                    screenId: Joi.string(),
                    s3Response: Joi.object()
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let v = req.body.s3Response
                let sourceImage = `${process.env.AWS_URL}` + v.Key
                var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                    var palette = ColorThief.getPalette(sourceImage, 5);
                    return palette
                }).catch(function(err) {
                    return false
                });

                let projectTeamMembers = await ProjectTeamMember.find({ projectId: req.body.projectId });

                let checkUser = await Project.find({
                    _id: req.body.projectId,
                    userId: { $in: projectTeamMembers.map(p => p.projectTeamMember.userId.toString()) },
                    projectStatus: 1
                });

                if (!checkUser.length) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                }
                let lObjFGScreen = await Screens.findByIdAndUpdate({ _id: ObjectId(req.body.screenId) }, { $set: { screenStatus: 1, uploadStatus: true, image: v.Key, colorPalette: colorP, approvedStatus: "approved" } }, { new: true })
                await screenVersion.findOneAndUpdate({ parentId: ObjectId(req.body.screenId) }, { $set: { screenStatus: 1, uploadStatus: true, image: v.Key, colorPalette: colorP, approvedStatus: "approved" } }, { new: true })
                return Response.success(res, lObjFGScreen, 'Screens Updated succesfully');

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },


        /*
         *  Upload screens to project 
         */
        uploadProjectScreens: async(req, res) => {
            try {
                if (!!req.fileValidationErr) {
                    return Response.badValuesData(res, req.fileValidationErr);
                } else {
                    const schema = Joi.object().keys({
                        projectId: Joi.string().trim().required(),
                        type: Joi.string().trim()
                    })

                    let { error, value } = Joi.validate(req.body, schema);
                    if (error) {
                        let lAryErrorMsg = _.map(error.details, "message")
                        return Response.badValuesData(res, lAryErrorMsg);
                    }

                    let checkUser = await Project.find({ _id: req.body.projectId, "userId": req.user._id, projectStatus: 1 })

                    if (!checkUser.length) {
                        return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                    }
                    let lAryScreenData = [];
                    let lAryScreens = req.files;

                    for (let v of lAryScreens) {
                        let sourceImage = `https://d31qgkthzchm5g.cloudfront.net/screens/` + v.key
                        var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                            var palette = ColorThief.getPalette(sourceImage, 5);
                            return palette
                        }).catch(function(err) {
                            return false
                        });
                        await UserBadge.screenPublishedTracking(req.user._id);
                        let lObjRes = await Screens.create({
                            screenName: path.parse(v.originalname).name,
                            isPublish: false,
                            industry: checkUser[0].industry,
                            type: req.body.type,
                            image: v.key,
                            colorPalette: colorP,
                            projectId: req.body.projectId,
                            userId: req.user._id,
                            approvedStatus: "in-review",
                        })
                        lObjRes.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${lObjRes.image}`;
                        lAryScreenData.push(lObjRes)
                    }
                    return Response.success(res, lAryScreenData, 'Screens uploaded succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        uploadSceens: async(req, res) => {
            try {
                if (!!req.fileValidationErr) {
                    return Response.badValuesData(res, req.fileValidationErr);
                } else {
                    const schema = Joi.object().keys({
                        projectId: Joi.string().trim(),
                        type: Joi.string().trim(),
                        focusGroupId: Joi.string().trim(),
                        sequence: Joi.number()
                    })

                    let { error, value } = Joi.validate(req.body, schema);
                    if (error) {
                        let lAryErrorMsg = _.map(error.details, "message")
                        return Response.badValuesData(res, lAryErrorMsg);
                    }
                    let checkUser;
                    if (req.body.focusGroupId) {
                        checkUser = await FocusGroup.find({ _id: req.body.focusGroupId, "createdUser": req.user._id, groupstatus: 1 })
                        if (!checkUser.length) {
                            return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                        }
                    } else if (req.body.projectId) {
                        checkUser = await Project.find({ _id: req.body.projectId, "userId": req.user._id, projectStatus: 1 })

                        if (!checkUser.length) {
                            return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                        }
                    }

                    let lAryScreenData = [];
                    let lAryScreens = req.files;

                    for (let v of lAryScreens) {
                        let sourceImage = `https://d31qgkthzchm5g.cloudfront.net/screens/` + v.key
                        var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                            var palette = ColorThief.getPalette(sourceImage, 5);
                            return palette
                        }).catch(function(err) {
                            return false
                        });
                        let values;
                        let userData;
                        if (req.body.projectId) {
                            values = {
                                screenName: path.parse(v.originalname).name,
                                isPublish: false,
                                industry: checkUser[0].industry,
                                type: req.body.type,
                                image: v.key,
                                colorPalette: colorP,
                                projectId: req.body.projectId,
                                userId: req.user._id,
                                approvedStatus: "in-review",
                            }
                            await UserBadge.screenPublishedTracking(req.user._id);
                        } else if (req.body.focusGroupId) {
                            values = {
                                screenName: path.parse(v.originalname).name,
                                sequence: req.body.sequence,
                                isPublish: true,
                                image: v.key,
                                colorPalette: colorP,
                                focusGroupId: req.body.focusGroupId,
                                userId: req.user._id,
                                approvedStatus: "approved",
                            }
                            userData = await User.findOne({ _id: ObjectId(req.user._id) })
                            let uploadedSize = userData.uploadedSize ? userData.uploadedSize : 0
                            userData.uploadedSize = parseInt(uploadedSize) + parseInt(v.size)
                            await userData.save()
                        }
                        // console.log('values', values);
                        let lObjRes = await Screens.create(values)
                            // console.log(lObjRes)
                        lObjRes.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${lObjRes.image}`;
                        lAryScreenData.push(lObjRes)

                    }
                    return Response.success(res, lAryScreenData, 'Screens uploaded succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        /**
         * Update remaining details of the screen
         */
        updateScreenDetails: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().required(),
                    screenName: Joi.string(),
                    screenType: Joi.string().trim().required(),
                    parentScreen: Joi.string().allow(null),
                    font: Joi.string().allow(''),
                    categories: Joi.array(),
                    tags: Joi.array(),
                    description: Joi.string().allow(''),
                    isPublish: Joi.boolean(),
                    disableComments: Joi.boolean()

                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let checkUser = await Screens.find({ _id: req.body.screenId, "userId": req.user._id, screenStatus: 1 })
                if (!checkUser.length) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                }
                let tagArray = []
                for (let tag of req.body.tags) {
                    var checktags = await Tags.findOneAndUpdate({
                        "name": tag
                    }, { $set: { "name": tag, "createdUser": req.user._id } }, { upsert: true, new: true })
                    tagArray.push(checktags._id)
                }
                let lObjUpdateDetails = await Screens.findByIdAndUpdate({ _id: ObjectId(req.body.screenId) }, {
                        $set: {
                            screenName: req.body.screenName,
                            approvedStatus: "in-review",
                            disableComments: req.body.disableComments,
                            screenType: req.body.screenType,
                            font: req.body.font,
                            tags: tagArray,
                            description: req.body.description
                        }
                    }, { new: true })
                    // Sync for elasticsearch
                    // await Screens.on('es-indexed', function(err, res) {
                    // })

                var screenDetails = await Screens.aggregate([
                    { $match: { _id: ObjectId(req.body.screenId) } },
                    { $lookup: { from: "screentypes", localField: "screenType", foreignField: "_id", as: "screentypes" } },
                    { $unwind: { path: "$screentypes", 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projects" } },
                    { $unwind: { path: "$projects", 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "screentags" } },
                    { $unwind: { path: "$screentags", 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "users" } },
                    { $unwind: { path: "$users", 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            screenId: {
                                $first: "$_id"
                            },
                            screenName: {
                                $first: "$screenName"
                            },
                            viewCount: {
                                $first: "$viewCount"
                            },
                            screenType: {
                                $first: {
                                    _id: "$screentypes._id",
                                    type: "$screentypes.type"
                                }
                            },
                            industry: {
                                $first: {
                                    _id: "$projects.industry"
                                }
                            },
                            tags: {
                                $push: {
                                    _id: "$screentags._id",
                                    name: "$screentags.name"
                                }
                            },
                            isPublish: {
                                $first: "$isPublish"
                            },
                            image: {
                                $first: "$image"
                            },
                            projectId: {
                                $first: {
                                    _id: "$projects._id",
                                    projectName: "$projects.projectName",
                                    industry: "$projects.industry"
                                }
                            },
                            userId: {
                                $first: {
                                    email: "$users.email",
                                    firstName: "$users.firstName",
                                    lastName: "$users.lastName",
                                    profilePicture: "$users.profilePicture",
                                    userName: "$users.userName",
                                    _id: "$users._id"
                                }
                            },
                            type: {
                                $first: "$type"
                            },
                            screenStatus: {
                                $first: "$screenStatus"
                            }
                        }
                    }
                ])

                await delete screenDetails[0]._id;
                await delete screenDetails[0].industry;
                let checkElasticsearchdata = await esClient.search({
                    index: 'screenss',
                    type: 'screens',
                    body: {
                        query: {
                            term: {
                                screenId: screenDetails[0].screenId
                            }
                        }
                    }
                })

                if (checkElasticsearchdata.hits.hits.length > 0) {
                    await esClient.update({
                        index: 'screenss',
                        type: 'screens',
                        id: checkElasticsearchdata.hits.hits[0]._id,
                        body: {
                            doc: screenDetails[0]
                        }
                    })
                } else {
                    await esClient.index({
                        index: 'screenss',
                        type: 'screens',
                        body: screenDetails[0]
                    })
                }

                let screenCount = await Screens.count({ isPublish: true, approvedStatus: 'approved' })
                let count = await BadgeProperties.count({})

                if (!count) {
                    helper.createProperties(screenCount, 'create')
                } else {
                    helper.createProperties(screenCount, 'update')
                }
                return Response.success(res, lObjUpdateDetails, "Screen Details updated successfully")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        updateImagesToFocusGroup: async(req, res) => {
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
                    for (let x of projectScreenId) {
                        fgProjectScreen = await FGScreen.create({
                            projectScreenId: x,
                            focusGroupId: req.body.focusGroupId,
                            screenId: screen
                        });
                    }
                }

                // await ProjectScreen.findOneAndUpdate({ _id: req.body.projectScreenId }, { forfocusgroup: true });
                // let lAryScreenData = [];
                // let lAryScreenDetails = [];
                // if (req.body.screenId) {
                //     for (let screen of req.body.screenId) {
                //         let lObjScreenDetails = await Screens.find({ _id: screen.screenId }, { _id: 1, image: 1, userId: 1 }).lean()
                //         if (lObjScreenDetails.length > 0) {
                //             let obj = {
                //                 isPublish: true,
                //                 screenName: lObjScreenDetails[0].name,
                //                 parentScreen: screen.parentId,
                //                 parentScreenId: (screen.parentId) ? screen.screenId : null,
                //                 image: lObjScreenDetails[0].image,
                //                 focusGroupId: req.body.focusGroupId,
                //                 userId: lObjScreenDetails[0].userId,
                //                 approvedStatus: "approved",
                //             }
                //             lAryScreenData.push(obj)
                //         }
                //     }
                //     let removeObj = await Screens.remove({ focusGroupId: req.body.focusGroupId })
                //     let lObjResScreen = await Screens.insertMany(lAryScreenData)
                //     for (let resScreen of lObjResScreen) {
                //         resScreen.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${resScreen.image}`;
                //     }
                return Response.success(res, fgProjectScreen, 'Screens created succesfully');
                // }
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        changeFGSequence: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim().required(),
                    screens: Joi.array(),
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                // let checkUser = await FocusGroup.find({

                //     $or: [{
                //             createdUser: ObjectId(req.user._id)
                //         },
                //         {
                //             'projectTeamMembers.email': req.user.email
                //         }
                //     ],
                // });

                let checkUser = await FocusGroup.aggregate([{
                        $match: {
                            _id: ObjectId(req.body.focusGroupId),
                            groupstatus: 1
                        }
                    },
                    { $lookup: { from: 'projectteammembers', localField: 'projectId', foreignField: 'projectId', as: 'teamMembers' } },
                    // { $unwind: { path: "$teamMembers", 'preserveNullAndEmptyArrays': true } },
                    {
                        $match: {
                            $or: [
                                { "createdUser": ObjectId(req.user._id) },
                                { "teamMembers.projectTeamMember.userId": ObjectId(req.user._id) }
                            ]
                        }
                    }
                ])
                if (!checkUser.length) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to change the screen order!!" });
                }

                if (req.body.screens) {
                    // for (let index in req.body.screens) {
                    //     console.log(index, "QWERTYUIOWERTYU", index._id)
                    //     let lObjScreenDetails = await FGScreen.findOneAndUpdate({ screenId: index._id }, { $set: { sequence: index } });
                    // }
                    let screens = req.body.screens;
                    for (let i = 0; i < screens.length; i++) {
                        console.log(i, "WQERTYUI")
                        let lObjScreenDetails = await FGScreen.findOneAndUpdate({ screenId: screens[i]._id }, { $set: { sequence: i } });
                    }
                    return Response.success(res, '', 'Order changed succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        changeProjectSequence: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    projectId: Joi.string().trim().required(),
                    screens: Joi.array(),
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let isUserInProjectTeamMember = await ProjectTeamMember.exists({
                    projectId: req.body.projectId,
                    'projectTeamMember.userId': req.user._id
                });

                let checkUser = await Project.find({
                    _id: req.body.projectId,
                    projectStatus: 1,
                })

                if (!checkUser.length && !isUserInProjectTeamMember) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to change the screen order!!" })
                }
                if (req.body.screens) {
                    for (let index in req.body.screens) {
                        let lObjScreenDetails = await Screens.update({ _id: req.body.screens[index] }, { $set: { sequence: index } }).lean()
                    }
                    return Response.success(res, '', 'Order changed succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        updateScreensToFocusGroup: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    focusGroupId: Joi.string().trim().required(),
                    screenId: Joi.array(),
                    parentId: Joi.string()
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let checkUser = await FocusGroup.find({ _id: req.body.focusGroupId, "createdUser": req.user._id, groupstatus: 1 })
                if (!checkUser.length) {
                    return Response.forbiddenError(res, { message: "You are not having permisssions to change the screens!!" })
                }
                let lAryScreenData = [];
                let lAryScreenDetails = [];
                if (req.body.screenId) {
                    for (let screen of req.body.screenId) {
                        let lObjScreenDetails = await Screens.find({ _id: screen._id }, { _id: 1, image: 1, userId: 1, colorPalette: 1 }).lean()
                        if (lObjScreenDetails.length > 0) {
                            let obj = {
                                isPublish: true,
                                screenName: screen.screenName,
                                colorPalette: lObjScreenDetails[0].colorPalette,
                                parentScreen: req.body.parentId,
                                parentScreenId: (req.body.parentId) ? screen._id : null,
                                image: lObjScreenDetails[0].image,
                                focusGroupId: req.body.focusGroupId,
                                userId: lObjScreenDetails[0].userId,
                                approvedStatus: "approved",
                            }
                            lAryScreenData.push(obj)
                        }
                    }
                    let lObjResScreen = await Screens.create(lAryScreenData)
                    for (let resScreen of lObjResScreen) {
                        resScreen.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${resScreen.image}`;
                    }
                    return Response.success(res, lObjResScreen, 'Screens created succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        /**
         * Get All Screens from the current group
         */
        listAllScreens: async(req, res) => {
            try {
                let page = req.query.page;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let lAryResData = await Screens.find({ focusGroupId: req.query.focusGroupId }).skip(skipRec).limit(gIntDataPerPage)

                return Response.success(res, lAryResData, 'Screens list');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Create New Screen Upload Images to S3 bucket
         */
        createNewScreen: async(req, res) => {
            try {
                if (!!req.fileValidationErr) {
                    return Response.badValuesData(res, req.fileValidationErr);
                } else {
                    let lObjReQData = req.body;

                    lObjReQData.image = req.file ? req.file.key : "";
                    lObjReQData.userId = req.user ? req.user._id : ObjectId("5ca2fa96b37a9016cb17d2be"); //Testing Purpose
                    lObjReQData.approvedStatus = "approved"; //Currently for testing purpose we'r maintain the approvedStatus is "approved" by default it should be in "in-review"
                    lObjReQData.focusGroupId = req.body.focusGroupId;

                    let lObjScreens = await Screens.create(lObjReQData);

                    //Image Responsive Purpose
                    if (!!lObjScreens && lObjScreens.image) lObjScreens.image = (lObjScreens.type === 'mobile') ? `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${lObjScreens.image}` : `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x480/screens/${lObjScreens.image}`

                    return Response.success(res, lObjScreens, 'New Screen Details');
                }
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Check Screen Name Already Exist or not
         */
        checkScreenNameExist: async(req, res, next) => {
            try {
                let lObjScreen = await Screens.findOne({ userId: req.user._id, screenName: req.body.screenName }).lean()

                if (!!lObjScreen) return Response.error(res, 400, "Screen Name already exists")
                if (lObjScreen === null) next();
            } catch (e) {
                return Response.error(res, 400, "Screen Name already exists")
            }
        },

        /**
         * Update My Screen
         */
        updateSpecificDetails: async(req, res) => {
            try {
                //Joi Input validation
                const joi_validation = Joi.object().keys({
                    isPublish: Joi.boolean(), //.format('YYYY-MM-DD')
                    focusGroupId: Joi.string().trim().required(),
                    approvedStatus: Joi.string().valid(["approved"]),
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, joi_validation);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let data = req.body;
                data.userId = req.user ? req.user._id : ObjectId("5ca2fa96b37a9016cb17d2be"); //Testing Purpose
                if (!!req.file) data.image = req.file ? req.file.key : "";
                Screens.findOneAndUpdate({
                    _id: req.params.screenId
                }, {
                    $set: data
                }, {
                    new: true
                }, (err, result) => {
                    if (err) {
                        return Response.error(res, 400, err)
                    } else {

                        if (!!result) result.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${result.image}`;
                        return Response.success(res, result, 'Screen updated successfully')
                    }
                });

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Update My Screen
         */
        updateMyScreen: async(req, res) => {
            try {
                //Joi Input validation
                const joi_validation = Joi.object().keys({
                    isPublish: Joi.boolean(), //.format('YYYY-MM-DD')
                    focusGroupId: Joi.string().trim().required(),
                    approvedStatus: Joi.string().valid(["approved"]),
                }).options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, joi_validation);

                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let data = req.body;
                data.image = req.file ? req.file.key : "";
                data.userId = req.user._id;

                Screens.findOneAndUpdate({
                    _id: req.params.screenId
                }, {
                    $set: data
                }, {
                    new: true
                }, (err, result) => {
                    if (err) {
                        return Response.error(res, 400, err)
                    } else {
                        if (!!result) result.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${result.image}`;
                        return Response.success(res, result, 'Screen updated successfully')
                    }
                });
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Get the Screen Details based on Id
         */
        getMyScreenDetails: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().label('ScreenId required'),
                    parentId: Joi.string().trim(),
                    focusgroupId: Joi.string().trim(),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let screenData = {};

                //Increase the view count
                // let lObjScreen = await Screens.findOneAndUpdate({
                //   _id: req.params.screenId,
                //   screenStatus: { $ne: 0 },
                //   $or: [{
                //     viewedUser: { $exists: false }
                //   }, {
                //     viewedUser: {
                //       $nin: [req.user._id]
                //     }
                //   }]
                // },
                //   { $addToSet: { viewedUser: req.user._id } },
                //   { new: true }
                // )

                // if (lObjScreen !== null) {
                //   screenData = await Screens.findOneAndUpdate({
                //     _id: req.params.screenId,
                //     screenStatus: { $ne: 0 }
                //   }, { $set: { viewCount: lObjScreen.viewedUser.length } }, { new: true }
                //   )
                // } else {
                //   screenData = await Screens.findOne({ _id: req.params.screenId, screenStatus: { $ne: 0 } }).lean()
                // }
                screenData["hotspot"] = await Hotspot.aggregate([{
                        $match: {
                            screenId: ObjectId(req.params.screenId),
                            status: 1,
                            focusgroupId: ObjectId(req.query.focusgroupId)
                        }
                    },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    { $unwind: { path: '$userId', 'preserveNullAndEmptyArrays': true } },
                    { $unwind: { path: '$commentRes', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'commentRes.userId', foreignField: '_id', as: 'commentRes.userId' } },
                    { $unwind: { path: '$commentRes.userId', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'anonymous', localField: 'anonymousId', foreignField: '_id', as: 'anonymousId' } },
                    { $unwind: { path: '$anonymousId', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'anonymous', localField: 'commentRes.anonymousId', foreignField: '_id', as: 'commentRes.anonymousId' } },
                    { $unwind: { path: '$commentRes.anonymousId', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'ticketassigns', localField: '_id', foreignField: 'hotspotId', as: 'ticketUser' } },
                    { $unwind: { path: '$ticketUser', 'preserveNullAndEmptyArrays': true } },
                    { $lookup: { from: 'users', localField: 'ticketUser.assignedUser', foreignField: '_id', as: 'assignedUser' } },
                    { $unwind: { path: '$assignedUser', 'preserveNullAndEmptyArrays': true } },
                    {
                        $group: {
                            _id: "$_id",
                            "actionId": { $first: '$actionId' },
                            "flagId": { $first: "$flagId" },
                            "position": { $first: '$position' },
                            "screenId": { $first: "$screenId" },
                            "comment": { $first: "$comment" },
                            "dueDate": { $first: "$dueDate" },
                            "createdAt": { $first: "$createdAt" },
                            "userId": { $first: "$userId" },
                            "anonymousId": { $first: "$anonymousId" },
                            "commentRes": {
                                $addToSet: {
                                    _id: "$commentRes._id",
                                    comment: "$commentRes.comment",
                                    "createdAt": "$commentRes.createdAt",
                                    anonymousId: {
                                        '_id': '$commentRes.anonymousId._id',
                                        'email': '$commentRes.anonymousId.email',
                                        name: "$commentRes.anonymousId.userName",
                                    },
                                    userId: {
                                        '_id': '$commentRes.userId._id',
                                        'userName': '$commentRes.userId.userName',
                                        'email': '$commentRes.userId.email',
                                        'firstName': '$commentRes.userId.firstName',
                                        'lastName': '$commentRes.userId.lastName',
                                        "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$commentRes.userId.profilePicture"] }, ""] },
                                    }
                                }
                            },
                            "assignedUser": { $first: "$assignedUser" }
                        }
                    }, {
                        $project: {
                            "position": 1,
                            "screenId": 1,
                            "actionId": 1,
                            "flagId": 1,
                            "comment": 1,
                            "dueDate": 1,
                            "createdAt": 1,
                            "anonymousId": {
                                '_id': '$anonymousId._id',
                                'email': '$anonymousId.email',
                                name: "$anonymousId.userName",
                            },
                            "userId": {
                                '_id': '$userId._id',
                                'userName': '$userId.userName',
                                'firstName': '$userId.firstName',
                                'lastName': '$userId.lastName',
                                'email': '$userId.email',
                                "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$userId.profilePicture"] }, ""] },

                            },
                            "commentRes": 1,
                            "assignedUser": {
                                "_id": "$assignedUser._id",
                                "profilePicture": "$assignedUser.profilePicture",
                                "userName": "$assignedUser.userName",
                                "email": "$assignedUser.email",
                                "firstName": "$assignedUser.firstName",
                                "lastName": "$assignedUser.lastName"
                            }
                        }
                    }
                ]).sort('createdAt')

                // if (screenData["hotspot"] && screenData["hotspot"]) {
                //   screenData["hotspot"] = _.map(screenData["hotspot"], async function (v) {
                //     v.commentRes = _.filter(v.commentRes, function (x) {
                //       return x.userId.profilePicture
                //     })

                //     return v;
                //   });
                // }
                for (let hotspot of screenData["hotspot"]) {

                    for (let comRes of hotspot.commentRes) {
                        if (comRes.userId._id) {
                            delete comRes.anonymousId
                        } else if (comRes.anonymousId._id) {
                            delete comRes.userId
                        }
                    }
                    if (hotspot.userId._id) {
                        delete hotspot.anonymousId
                    } else if (hotspot.anonymousId._id) {
                        delete hotspot.userId
                    }
                    if (!hotspot.commentRes[0]._id) {
                        hotspot.commentRes = [];

                    }
                }
                screenData["hotspot"] = await Promise.all(screenData["hotspot"])

                screenData['ratingDetails'] = await Comments.aggregate([
                    { $match: { "screenId": ObjectId(req.params.screenId), "focusGroupId": ObjectId(req.query.focusgroupId) } },
                    { $lookup: { from: 'ratingtypes', localField: 'ratingTypeId', foreignField: '_id', as: 'ratingTypeId' } },
                    { $unwind: '$ratingTypeId' },
                    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'userId' } },
                    { $unwind: '$userId' },
                    {
                        $group: {
                            _id: { "screenId": "$screenId", "userId": "$userId._id" },
                            "ratings": {
                                "$push": {
                                    'ratingType': '$ratingTypeId.name',
                                    'ratingId': '$ratingTypeId._id',
                                    'comment': '$comment',
                                    'vote': '$vote'
                                }
                            },
                            "userName": { $first: '$userId.userName' },
                            avgRating: { $avg: { $multiply: ["$vote"] } },
                        }
                    },
                    {
                        $group: {
                            _id: '$_id.userId',
                            userName: { $first: "$userName" },
                            ratings: { $first: "$ratings" },
                            avgRating: { $first: "$avgRating" }
                        }
                    }
                ])
                let focusGroupId = await FGScreen.findOne({ screenId: req.params.screenId }).select('focusGroupId')
                if (focusGroupId == null) {
                    focusGroupId = await FGScreen.findOne({ screenId: req.query.parentId }).select('focusGroupId')
                }
                screenData['noOfVotes'] = screenData['ratingDetails'].length; //Total no of votes
                screenData['overAllRating'] = _.meanBy(screenData['ratingDetails'], 'avgRating'); //Average
                screenData['screenId'] = req.params.screenId;
                screenData['_id'] = req.params.screenId;
                console.log(focusGroupId, "HOHIIHOH");
                // if (focusGroupId.hasOwnProperty('focusGroupId')) {
                screenData['focusGroupId'] = focusGroupId.focusGroupId;
                // }
                //Get Image Url
                if (!!screenData && screenData.image) {
                    screenData.image = `https://d31qgkthzchm5g.cloudfront.net/screens/${screenData.image}`;

                }
                return Response.success(res, screenData, 'Screen Details');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Get the User all Screen Details
         */
        getUserAllScreens: async(req, res) => {
            try {
                //Pagination
                let page = req.query.page;
                let skipRec = page - 1;
                skipRec = skipRec * gIntDataPerPage;

                let lObjResData = {
                    'screens': {},
                    'totalCount': await Screens.find({ userId: req.user._id, screenStatus: { $ne: 0 } }).count()
                }

                lObjResData['screens'] = await Screens.find({
                        userId: req.user._id,
                        screenStatus: { $ne: 0 }
                    }).populate('userId', '_id email')
                    .skip(skipRec)
                    .limit(gIntDataPerPage).lean()

                for (let x of lObjResData.screens) {
                    x.image = (x.type === 'mobile') ? `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${x.image}` : `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x480/screens/${x.image}`
                    x["comments"] = await Comments.find({ screenId: x._id }).sort({ _id: -1 }).lean();
                }

                return Response.success(res, lObjResData, 'Screens List');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        /**
         * Delete My Screen(Check the Screen is whether linked in Flows/Projects)
         */
        deleteScreenById: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim(),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let fgId = req.query.focusGroupId;
                let data = await FGScreen.findOne({
                    focusGroupId: fgId,
                    screenId: req.params.screenId,
                }).lean();

                await FGScreen.deleteOne({
                    _id: data._id,
                }, (err, result) => {
                    if (err) {
                        return Response.error(res, 400, err)
                    } else if (!!result) {
                        return Response.success(res, result, 'Screen Deleted successfully')
                    } else {
                        return Response.error(res, 400, "Screen not found")
                    }
                });
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },
        flagAsInappropriate: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim(),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let lObjBody = {
                    screenId: req.body.screenId,
                    userId: req.user._id
                }
                let lObjFlag = await Flag.create(lObjBody)
                return Response.success(res, lObjFlag, 'Marked as inappropriate')
            } catch (error) {

                return Response.errorInternal(error, res)

            }
        },
        exportImagesAsPDF: async(req, res) => {
            try {
                let lObjExportedId = req.query.exportId;
                let exportedId = await exportScreens.find({ _id: lObjExportedId }).lean()
                let lObjImages = exportedId[0].images
                let projectDetails = await Project.find({ _id: exportedId[0].projectId }).populate({
                    path: "industry",
                    select: "_id name"
                }).populate({ path: "fonts", select: "name" }).populate("tools", "icon name").populate('userId', '_id firstName lastName userName').lean()

                var images = []
                for (let image of lObjImages) {
                    let getImageUrl = await ProjectScreen.aggregate([

                            { $match: { screenId: ObjectId(image) } },
                            {
                                $lookup: { from: 'screens', localField: 'screenId', foreignField: "_id", as: "screens" }
                            },
                            {
                                $unwind: { path: "$screens", "preserveNullAndEmptyArrays": true }
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
                                $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "projects" }
                            },
                            {
                                $unwind: { path: "$projects", "preserveNullAndEmptyArrays": true }
                            },
                            {
                                $lookup: { from: "fonts", localField: "projects.fonts", foreignField: "_id", as: "fonts" }
                            },
                            {
                                $unwind: { path: "$fonts", "preserveNullAndEmptyArrays": true }
                            },
                            {
                                $lookup: { from: "tools", localField: "projects.tools", foreignField: "_id", as: "tools" }
                            },
                            {
                                $unwind: { path: "$tools", "preserveNullAndEmptyArrays": true }
                            },
                            {
                                $group: {
                                    _id: {
                                        screenId: '$screens._id',
                                        ratingTypeId: '$screenratings.ratingTypeId'
                                    },
                                    screenName: { $first: '$screens.screenName' },
                                    image: { $first: '$screens.image' },
                                    count: { $sum: 1 },
                                    inspire: { $first: '$screens.inspire' },
                                    ratingType: {
                                        $first: {
                                            _id: '$screenratingtypes._id',
                                            name: '$screenratingtypes.name',
                                            icon: '$screenratingtypes.icon'
                                        }
                                    },
                                    tools: { $first: "$tools" },
                                    fonts: { $first: "$fonts" }
                                }
                            },
                            {
                                $sort: { count: -1 }
                            },
                            {
                                $project: {
                                    rating: {
                                        $cond: [{ $not: ["$ratingType._id"] }, 0, "$count"]
                                    },
                                    screenName: 1,
                                    ratingType: 1,
                                    image: 1,
                                    tools: 1,
                                    fonts: 1,
                                    inspire: 1
                                }
                            },
                            {
                                $group: {
                                    _id: '$_id.screenId',
                                    screenName: { $first: '$screenName' },
                                    ratingType: { $first: '$ratingType' },
                                    ratingCount: {
                                        $first: "$rating"
                                    },
                                    image: { $first: '$image' },
                                    tools: { $first: "$tools" },
                                    fonts: { $first: "$fonts" },
                                    inspire: { $first: "$inspire" }
                                }
                            }
                        ])
                        // if (exportedId[0].grayscale) {
                        //   if(getImageUrl[0].inspire) {
                        //     getImageUrl[0].image = `${process.env.CLOUDURL}filters:grayscale()/screens/${getImageUrl[0].image}`
                        //   } else {
                        //     getImageUrl[0].image = `${process.env.AWS_URL}filters:grayscale()/${getImageUrl[0].image}`
                        //   }
                        // } else {
                    if (getImageUrl[0].inspire) {
                        getImageUrl[0].image = `${process.env.CLOUDURL}screens/${getImageUrl[0].image}`
                    } else {
                        getImageUrl[0].image = `${process.env.AWS_URL}${getImageUrl[0].image}`
                    }
                    // }
                    images.push(getImageUrl[0])
                }
                console.log(images, 'images')
                let date = moment().utcOffset("+05:30").format('DD/MM/YYYY, hh:mm A');

                var content = fs.readFileSync(path.join(__dirname, '/template.ejs'), 'utf8');
                const html = ejs.render(content, {
                    images: images,
                    projectDetails: projectDetails[0],
                    focusGroupDetails: null,
                    base_url: process.env.BASE_URL,
                    count: images.length,
                    date: date
                });

                //remove this on production juz for staging
                // if (!jsReportInitialized) {
                //     await jsreport().init();
                //     jsReportInitialized = true;
                // }


                jsreport.render({
                    template: {
                        content: html,
                        engine: 'handlebars',
                        recipe: 'chrome-pdf'
                    }
                }).then((out) => {
                    let pdfPath = path.join(__dirname, `../../public/screens-${Date.now()}.pdf`)
                    var output = fs.createWriteStream(pdfPath)
                    out.stream.pipe(output);
                    out.stream.on('end', () => {
                        let filepathfromResponse = pdfPath
                        let lastParam = filepathfromResponse.split('/')
                        let length = lastParam.length
                        let filepath = { path: `${process.env.SERVER_URL}public/${lastParam[length - 1]}` };
                        return Response.success(res, filepath, 'All Screens exported successfully')
                    })
                }).catch((e) => {
                    console.log(e, "fghjkl")
                    return Response.forbiddenError(res, 'Something went wrong. Please try again.')
                });


            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        exportFGImagesAsPDF: async(req, res) => {
            try {
                let lObjExportedId = req.query.exportId;
                let exportedId = await exportScreens.find({ _id: lObjExportedId }).lean()

                let lObjImages = exportedId[0].images

                var images = []
                for (let image of lObjImages) {

                    let getImageUrl = await FGScreen.aggregate([
                        { $match: { screenId: ObjectId(image), focusGroupId: exportedId[0].focusGroupId } },
                        {
                            $lookup: { from: 'project_screens', localField: 'projectScreenId', foreignField: "_id", as: "project_screens" }
                        },
                        {
                            $unwind: { path: "$project_screens", "preserveNullAndEmptyArrays": true }
                        },
                        {
                            $lookup: { from: 'screens', localField: 'project_screens.screenId', foreignField: "_id", as: "screens" }
                        },
                        {
                            $unwind: { path: "$screens", "preserveNullAndEmptyArrays": true }
                        },
                        { $lookup: { from: 'screenversions', localField: 'screens._id', foreignField: 'parentId', as: 'versions' } },
                        { $lookup: { from: 'chats', localField: 'screens._id', foreignField: 'screenId', as: 'chats' } },
                        { $unwind: { path: '$chats', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'chats.userId', foreignField: '_id', as: 'chatusers' } },
                        { $unwind: { path: '$chatusers', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'anonymous', localField: 'chats.anonymousId', foreignField: '_id', as: 'anonymouschat' } },
                        { $unwind: { path: '$anonymouschat', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'focusgroups', localField: 'focusGroupId', foreignField: '_id', as: 'focusgroup' } },
                        { $unwind: { path: '$focusgroup', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'focusgroup.createdUser', foreignField: '_id', as: 'focusgroupuser' } },
                        { $unwind: { path: '$focusgroupuser', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'ratings', localField: '_id', foreignField: 'screenId', as: 'rating' } },
                        { $unwind: { path: '$rating', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'ratingtypes', localField: 'rating.ratingTypeId', foreignField: '_id', as: 'ratingTypes' } },
                        { $unwind: { path: '$ratingTypes', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'rating.userId', foreignField: '_id', as: 'ratinguser' } },
                        { $unwind: { path: '$ratinguser', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'hotspots', localField: 'screens._id', foreignField: 'screenId', as: 'hotspots' } },
                        { $unwind: { path: '$hotspots', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'hotspots.userId', foreignField: '_id', as: 'hotspotusers' } },
                        { $unwind: { path: '$hotspotusers', "preserveNullAndEmptyArrays": true } },
                        {
                            $group: {
                                _id: '$screens._id',
                                image: { $first: '$screens.image' },
                                screenName: { $first: '$screens.screenName' },
                                description: { $first: { $ifNull: ['$screens.decription', ''] } },
                                inspire: { $first: '$screens.inspire' },
                                chats: {
                                    $addToSet: {
                                        message: '$chats.message',
                                        userName: '$chatusers.userName',
                                        anonymousName: '$anonymouschat.userName',
                                        createdAt: '$chats.createdAt'
                                    }
                                },
                                hotspots: {
                                    $addToSet: {
                                        message: '$hotspots.comment',
                                        userName: '$hotspotusers.userName',
                                        createdAt: '$hotspots.createdAt'
                                    }
                                },
                                focusGroupName: { $first: '$focusgroup.groupName' },
                                user: {
                                    $addToSet: {
                                        firstName: '$focusgroupuser.firstName',
                                        lastName: '$focusgroupuser.lastName'
                                    }
                                },
                                rating: {
                                    $addToSet: {
                                        ratingType: '$ratingTypes.name',
                                        user: '$ratinguser.userName',
                                        vote: '$rating.vote'
                                    }
                                },
                                invitedMembers: { $first: '$focusgroup.invitedMembers' },
                                versions: { $first: '$versions' }
                            }
                        }
                    ]);
                    // console.log(getImageUrl[0].chats, "QWERTYUIOP", getImageUrl[0].hotspots);
                    getImageUrl[0].chats = await _.sortBy(getImageUrl[0].chats, [function(chat) { return chat.createdAt; }])
                    getImageUrl[0].hotspots = await _.sortBy(getImageUrl[0].hotspots, [function(hotspot) { return hotspot.createdAt; }])
                        // if (exportedId[0].grayscale) {
                        //   if(getImageUrl[0].inspire) {
                        //     getImageUrl[0].image = `${process.env.CLOUDURL}filters:grayscale()/screens/${getImageUrl[0].image}`
                        //   } else {
                        //     getImageUrl[0].image = `${process.env.AWS_URL}filters:grayscale()/${getImageUrl[0].image}`
                        //   }
                        // } else {

                    if (getImageUrl[0].inspire) {
                        getImageUrl[0].image = `${process.env.CLOUDURL}screens/${getImageUrl[0].image}`
                    } else {
                        getImageUrl[0].image = `${process.env.AWS_URL}${getImageUrl[0].image}`
                    }
                    // }
                    images.push(getImageUrl[0])
                }
                let date = moment().utcOffset("+05:30").format('DD/MM/YYYY, hh:mm A');

                let versionCount = images.reduce((accum, item) => accum + parseInt(item.versions.length), 0)

                var content = fs.readFileSync(path.join(__dirname, '/fgtemplate.ejs'), 'utf8');
                let print = {
                    images: images,
                    focusGroupDetails: images[0],
                    projectDetails: null,
                    base_url: process.env.BASE_URL,
                    count: images.length,
                    date: date,
                    invitedMembers: images[0].invitedMembers,
                    versionCount: versionCount
                }
                const html = ejs.render(content, print);

                //remove this on production juz for staging
                // if (!jsReportInitialized) {
                //     await jsreport().init();
                //     jsReportInitialized = true;
                // }

                jsreport.render({
                    template: {
                        content: html,
                        engine: 'handlebars',
                        recipe: 'chrome-pdf'
                    }
                }).then((out) => {

                    let pdfPath = path.join(__dirname, `../../public/screens-${Date.now()}.pdf`)
                    var output = fs.createWriteStream(pdfPath)
                    out.stream.pipe(output);
                    out.stream.on('end', () => {
                        let filepathfromResponse = pdfPath
                        let lastParam = filepathfromResponse.split('/')
                        let length = lastParam.length
                        let filepath = { path: `${process.env.SERVER_URL}public/${lastParam[length - 1]}` };
                        return Response.success(res, filepath, 'All Screens exported successfully')
                    })
                }).catch((e) => {
                    console.log(e)
                    return Response.forbiddenError(res, 'Something went wrong. Please try again.')
                });
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        exportTagImage: async(req, res) => {
            try {
                let lObjExportedId = req.query.exportId;
                let exportedId = await exportScreens.find({ _id: lObjExportedId }).lean()

                let lObjImages = exportedId[0].images

                var images = []
                for (let image of lObjImages) {
                    let getImageUrl = await Screens.aggregate([
                        { $match: { _id: ObjectId(image) } },
                        { $lookup: { from: 'projecttags', localField: 'tagId', foreignField: '_id', as: 'tags' } },
                        { $unwind: { path: '$tags', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'users', localField: 'tags.createdUser', foreignField: '_id', as: 'users' } },
                        { $unwind: { path: '$users', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: '$_id',
                                screenName: { $first: '$screenName' },
                                image: { $first: '$image' },
                                inspire: { $first: '$inspire' },
                                tags: {
                                    $first: {
                                        _id: '$tags._id',
                                        tagName: '$tags.tagName',
                                        description: '$tags.description'
                                    }
                                },
                                user: {
                                    $first: {
                                        firstName: '$users.firstName',
                                        lastName: '$users.lastName',
                                        userName: '$users.userName',
                                        email: '$users.email'
                                    }
                                }
                            }
                        }
                    ])

                    if (getImageUrl[0].inspire) {
                        getImageUrl[0].image = `${process.env.CLOUDURL}screens/${getImageUrl[0].image}`
                    } else {
                        getImageUrl[0].image = `${process.env.AWS_URL}${getImageUrl[0].image}`
                    }
                    images.push(getImageUrl[0])
                }
                let date = moment().format('DD/MM/YYYY, hh:mm A')

                var content = fs.readFileSync(path.join(__dirname, '/tagtemplate.ejs'), 'utf8');
                const html = ejs.render(content, {
                    images: images,
                    tagDetails: images[0],
                    base_url: process.env.BASE_URL,
                    count: images.length,
                    date: date
                });
                jsreport.render({
                    template: {
                        content: html,
                        engine: 'handlebars',
                        recipe: 'chrome-pdf'
                    }
                }).then((out) => {
                    let pdfPath = path.join(__dirname, `../../public/screens-${Date.now()}.pdf`)
                    var output = fs.createWriteStream(pdfPath)
                    out.stream.pipe(output);
                    out.stream.on('end', () => {
                        let filepathfromResponse = pdfPath
                        let lastParam = filepathfromResponse.split('/')
                        let length = lastParam.length
                        let filepath = { path: `${process.env.SERVER_URL}public/${lastParam[length - 1]}` };
                        return Response.success(res, filepath, 'All Screens exported successfully')
                    })
                }).catch((e) => {
                    return Response.forbiddenError(res, 'Something went wrong. Please try again.')
                });
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        exportToken: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    images: Joi.array(),
                    projectId: Joi.string().trim(),
                    grayscale: Joi.boolean(),
                    focusGroupId: Joi.string().trim(),
                    tagId: Joi.string().trim(),
                    orientation: Joi.string(),
                    designGuide: Joi.boolean(),
                    screenRating: Joi.string(),
                    feedback: Joi.string()
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                console.log(req.body.projectId, 'Project Id');
                console.log(req.body.focusGroupId, 'focus group')
                console.log(req.body.tagId, 'Tag Id')


                let tokenData;
                if (req.body.projectId) {
                    tokenData = {
                        projectId: req.body.projectId,
                        images: req.body.images,
                        grayscale: req.body.grayscale
                    };
                } else if (req.body.focusGroupId) {
                    tokenData = {
                        focusGroupId: req.body.focusGroupId,
                        images: req.body.images,
                        grayscale: req.body.grayscale
                    };
                } else {
                    tokenData = {
                        tagId: req.body.tagId,
                        images: req.body.images,
                        grayscale: req.body.grayscale
                    }
                }


                let exportedId = await exportScreens.create(tokenData)
                return Response.success(res, exportedId, 'ID for PDF Export')
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        postRatings: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().required(),
                    focusGroupId: Joi.string().trim().required(),
                    vote: Joi.number().required(),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let lObjBody = {
                    screenId: req.body.screenId,
                    userId: req.user._id,
                    focusGroupId: req.body.focusGroupId,
                    vote: req.body.vote
                }
                let lObjUpVote = await UpVote.create(lObjBody)
                let message = ''
                if (req.body.vote) {
                    message = "You have upvoted the screen!!"
                } else {
                    message = "You have downvoted the screen!!"
                }
                return Response.success(res, lObjUpVote, message)
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },
        changeScreenName: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().required(),
                    screenName: Joi.string().trim(),
                    description: Joi.string().allow(null).allow('')
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                let lObjUpdateDetails;

                let lObjVersionDetails = await screenVersion.find({ _id: req.body.screenId, screenStatus: 1 });
                if (lObjVersionDetails.length > 0) {
                    // lObjVersionDetails = lObjVersionDetails.map(v => {
                    //     return v._id;
                    // })

                    // for (let x of lObjVersionDetails) {
                    await screenVersion.updateMany({ parentId: ObjectId(lObjVersionDetails[0].parentId) }, {
                        $set: { description: req.body.description, screenName: req.body.screenName }
                    });
                    lObjUpdateDetails = await Screens.findByIdAndUpdate({ _id: ObjectId(lObjVersionDetails[0].parentId) }, {
                        $set: { description: req.body.description, screenName: req.body.screenName }
                    });
                    // }

                    // let projectScreenDetail = await ProjectScreen.find({ screenId: ObjectId(req.body.screenId) });

                    // if (projectScreenDetail.length > 0) {

                    return Response.success(res, lObjUpdateDetails, "Screen updated successfully")
                        // }


                } else {
                    // let projectScreenDetail = await ProjectScreen.find({ screenId: ObjectId(req.body.screenId) });
                    // if (projectScreenDetail.length > 0) {
                    lObjUpdateDetails = await Screens.findByIdAndUpdate({ _id: ObjectId(req.body.screenId) }, {
                        $set: { description: req.body.description, screenName: req.body.screenName }
                    })
                    return Response.success(res, lObjUpdateDetails, "Screen updated successfully")
                        // } else {
                        //     return Response.badValuesData(res, '', "Screen not updated successfully");
                        // }
                }



            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        changeFGScreenName: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().required(),
                    screenName: Joi.string().trim(),
                    description: Joi.string().allow("")
                })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                await FGScreen.findOneAndUpdate({ screenId: req.body.screenId }, { $set: { description: req.body.description, screenName: req.body.screenName } });

                let lObjUpdateDetails = await FGScreen.findOne({ screenId: req.body.screenId });

                return Response.success(res, lObjUpdateDetails, "Screen updated successfully")
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

        generatePPTFile: async(req, res) => {
            try {
                let PptxGenJS = require('pptxgenjs');
                var pptx = new PptxGenJS();
                let lObjExportedId = req.query.exportId;
                let exportedId = await exportScreens.find({ _id: lObjExportedId }).lean()
                let lObjImages = exportedId[0].images

                var images = []
                for (let image of lObjImages) {

                    let getImageUrl = await Screens.aggregate([
                        { $match: { _id: ObjectId(image) } },
                        { $lookup: { from: 'chats', localField: '_id', foreignField: 'screenId', as: 'chats' } },
                        { $unwind: { path: '$chats', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'chats.userId', foreignField: '_id', as: 'chatusers' } },
                        { $unwind: { path: '$chatusers', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'anonymous', localField: 'chats.anonymousId', foreignField: '_id', as: 'anonymouschat' } },
                        { $unwind: { path: '$anonymouschat', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: 'focusgroups', localField: 'focusGroupId', foreignField: '_id', as: 'focusgroup' } },
                        { $unwind: { path: '$focusgroup', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'focusgroup.createdUser', foreignField: '_id', as: 'focusgroupuser' } },
                        { $unwind: { path: '$focusgroupuser', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'ratings', localField: '_id', foreignField: 'screenId', as: 'rating' } },
                        { $unwind: { path: '$rating', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'ratingtypes', localField: 'rating.ratingTypeId', foreignField: '_id', as: 'ratingTypes' } },
                        { $unwind: { path: '$ratingTypes', "preserveNullAndEmptyArrays": true } },
                        { $lookup: { from: 'users', localField: 'rating.userId', foreignField: '_id', as: 'ratinguser' } },
                        { $unwind: { path: '$ratinguser', "preserveNullAndEmptyArrays": true } },
                        {
                            $group: {
                                _id: '$_id',
                                image: { $first: '$image' },
                                screenName: { $first: '$screenName' },
                                description: { $first: { $ifNull: ['$description', ''] } },
                                chats: {
                                    $addToSet: {
                                        message: '$chats.message',
                                        userName: '$chatusers.userName',
                                        anonymousName: '$anonymouschat.userName',
                                        createdAt: '$chats.createdAt'
                                    }
                                },
                                focusGroupName: { $first: '$focusgroup.groupName' },
                                user: {
                                    $addToSet: {
                                        firstName: '$focusgroupuser.firstName',
                                        lastName: '$focusgroupuser.lastName'
                                    }
                                },
                                rating: {
                                    $addToSet: {
                                        ratingType: '$ratingTypes.name',
                                        user: '$ratinguser.userName',
                                        vote: '$rating.vote'
                                    }
                                }
                            }
                        }
                    ])

                    getImageUrl[0].chats = await _.sortBy(getImageUrl[0].chats, [function(chat) { return chat.createdAt; }])

                    if (exportedId[0].grayscale) {
                        getImageUrl[0].image = `https://d31qgkthzchm5g.cloudfront.net/filters:grayscale()/screens/${getImageUrl[0].image}`
                    } else {
                        getImageUrl[0].image = `https://d31qgkthzchm5g.cloudfront.net/screens/${getImageUrl[0].image}`
                    }
                    images.push(getImageUrl[0])
                }

                let date = moment().format('DD/MM/YYYY, hh:mm A')
                let newslide = pptx.addNewSlide()
                newslide.addImage({ path: '/home/jaishree/projects/version2/fgbackend/public/logo.png', x: 4.6, y: 1, w: 1.0, h: 1.0 })
                newslide.addText(`${images[0].focusGroupName}`, { x: 1.4, y: 2, fontSize: 18, align: 'center' })
                newslide.addText(`${images.length} Screens`, { x: 4.8, y: 2.5, fontSize: 8 })
                newslide.addText(`by ${images[0].user[0].firstName} ${images[0].user[0].lastName}`, { x: 2.3, y: 4.7, fontSize: 12, align: 'right' })
                newslide.addText(`Exported on ${date}`, { x: 8, y: 5, fontSize: 8 })
                for (let image of images) {
                    let slide = pptx.addNewSlide();
                    slide.addImage({ path: image.image, x: 3, y: 1, w: 2.5, h: 4.0 })
                }
                let pptPath = path.resolve(__dirname, `../../public/${Date.now()}.ppt`)
                let filepathfromResponse = pptPath
                let lastParam = filepathfromResponse.split('/')
                let length = lastParam.length
                let filepath = { path: `${process.env.SERVER_URL}public/${lastParam[length - 1]}` };
                pptx.save(path.resolve(pptPath));
                return Response.success(res, filepath, 'PPT Created Successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        uploadScreenVersion: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().label('ScreenId required'),
                    projectId: Joi.string().trim().allow(''),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }
                if (!!req.fileValidationErr) {
                    return Response.badValuesData(res, req.fileValidationErr);
                } else {
                    let lObjReQData = req.body;

                    lObjReQData.image = req.file ? req.file.key : "";
                    lObjReQData.userId = req.user ? req.user._id : "";
                    lObjReQData.approvedStatus = "approved";
                    let sourceImage = `${process.env.AWS_URL}` + lObjReQData.image;
                    var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                        var palette = ColorThief.getPalette(sourceImage, 5);
                        return palette
                    }).catch(function(err) {
                        return false
                    });

                    lObjReQData.colorPalette = colorP;
                    lObjReQData.screenStatus = 1;
                    lObjReQData.uploadStatus = true;
                    lObjReQData.sequence = 0;
                    lObjReQData.inspire = false;

                    let screenDetail = await Screens.findOne({ "_id": req.body.screenId, "screenStatus": 1 })
                        .select('_id categories industry tags isPublish disableComments colorPalette approvedStatus viewCount viewedUser screenStatus uploadStatus inspire screenName image sequence description screenVersionId')
                        .lean();
                    lObjReQData.screenName = screenDetail.screenName;
                    lObjReQData.description = screenDetail.description;
                    lObjReQData.parentId = screenDetail._id;

                    let lObjScreens = await screenVersion.create(lObjReQData);
                    await Screens.findOneAndUpdate({ _id: req.body.screenId }, { screenVersionId: lObjScreens._id });

                    let checkUser = await Project.find({ _id: req.body.projectId, projectStatus: 1 });

                    let createActivity = await Activity.create({
                        projectId: req.body.projectId,
                        userId: req.user._id,
                        message: `uploaded ${lObjScreens.screenName} screen version to '${checkUser[0].projectName}'`,
                        type: 'activity'
                    })
                    let activity = await Activity.findOne({ _id: createActivity._id }).populate('userId', '_id firstName lastName userName')
                    pusherNotif.activitySocket(`ch-${req.body.projectId}`, activity);

                    let projectTeamMember = await ProjectTeamMember.find({
                        projectId: req.body.projectId,
                    });

                    for (let i of projectTeamMember) {
                        if (i.projectTeamMember.userId.toString() !== req.user._id.toString()) {
                            let obj = {
                                "userId": i.projectTeamMember.userId,
                                "projectId": req.body.projectId,
                                "notificationType": 'projectNotification',
                                "message": `${req.user.userName} has uploaded ${lObjScreens.screenName} screen version to '${checkUser[0].projectName}'`
                            }
                            let lObjNotifData = await Notification.create(obj)
                            let lObjNotifChannel = (await User.findById(i.projectTeamMember.userId).select('channelName')).channelName;
                            let lObjNotificationMsg = await Notification.find({ _id: ObjectId(lObjNotifData._id) })

                            pusherNotif.sendNotification(lObjNotifChannel, lObjNotificationMsg);
                        }
                    }

                    // Image Responsive Purpose
                    if (!!lObjScreens && lObjScreens.image) lObjScreens.image = (lObjScreens.type === 'mobile') ? `https://d31qgkthzchm5g.cloudfront.net/fit-in/250x475/screens/${lObjScreens.image}` : `https://d31qgkthzchm5g.cloudfront.net/fit-in/640x480/screens/${lObjScreens.image}`

                    if (screenDetail !== null) {
                        let result = screenDetail.inspire;
                        let url;
                        if (result == false) {
                            url = process.env.AWS_URL + screenDetail.image;
                            screenDetail.image = url;
                        } else {
                            url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + screenDetail.image;
                            screenDetail.image = url;
                        }
                    }
                    let listVersions = await screenVersion.find({ "parentId": req.body.screenId, "screenStatus": 1 }).sort({ createdAt: 1 })


                    if (listVersions.length > 0) {
                        for (let version of listVersions) {
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



                    // screenDetail = await Screens.findOne({ "_id": req.body.screenId, "screenStatus": 1 })
                    //     .select('_id categories industry tags isPublish disableComments colorPalette approvedStatus viewCount viewedUser screenStatus uploadStatus inspire screenName image sequence description screenVersionId')
                    //     .lean();
                    screenDetail.versions = listVersions.slice(1);

                    return Response.success(res, screenDetail, 'New Screen version uploaded successfully');
                }
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        listScreenVersions: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().trim().label('ScreenId required'),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                let screenDetail = await Screens.findOne({ "_id": req.params.screenId, "screenStatus": 1 })
                    .select('_id categories industry tags isPublish disableComments colorPalette approvedStatus viewCount viewedUser screenStatus uploadStatus inspire screenName image sequence description screenVersionId')
                    .lean();
                if (screenDetail == null || screenDetail == undefined) {
                    return Response.success(res, 'Screen have been deleted');
                } else {
                    let result = screenDetail.inspire;
                    let url;
                    if (result == false) {
                        url = process.env.AWS_URL + screenDetail.image;
                        console.log(url, "ÜRLLL")
                        screenDetail.image = url;
                    } else {
                        url = "https://d31qgkthzchm5g.cloudfront.net/screens/" + screenDetail.image;
                        screenDetail.image = url;
                    }
                }

                let listVersions = await screenVersion.find({ "parentId": req.params.screenId, "screenStatus": 1 });

                if (listVersions.length > 0) {
                    for (let version of listVersions) {
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


                // screenDetail = await Screens.findOne({ "_id": req.params.screenId, "screenStatus": 1 })
                //     .select('_id categories industry tags isPublish disableComments colorPalette approvedStatus viewCount viewedUser screenStatus uploadStatus inspire screenName image sequence description screenVersionId')
                //     .lean();
                screenDetail.versions = listVersions.slice(1);

                return Response.success(res, screenDetail, 'Screen Details');
            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        deleteScreenVersions: async(req, res) => {
            try {
                const schema = Joi.object().keys({
                    screenId: Joi.string().label('ScreenId(s) required'),
                    parentId: Joi.string().trim().label('ParentId required'),
                }).required()

                let { error, value } = Joi.validate(req.params, schema);
                if (error) {
                    let lAryErrorMsg = _.map(error.details, "message")
                    return Response.badValuesData(res, lAryErrorMsg);
                }

                queryType = req.query.type || req.params.type || req.body.type;
                screenId = req.body.screenId || req.query.screenId || req.params.parentId;
                parentId = req.query.parentId || req.params.parentId || req.body.parentId;

                if (queryType == 'parent') {

                    await Screens.findOneAndUpdate({ "_id": parentId }, { "screenStatus": 0 })
                    await screenVersion.updateMany({ "parentId": parentId }, { "screenStatus": 0 })
                    return Response.success(res, '', 'Screen version with parent screen have been deleted');

                } else {

                    await screenVersion.findOneAndUpdate({ "parentId": parentId, "_id": screenId }, { "screenStatus": 0 })
                    let data = await screenVersion.find({ "parentId": parentId, "screenStatus": 1 }).sort({ createdAt: -1 });
                    await Screens.findOneAndUpdate({ "_id": parentId }, { "screenVersionId": data[0]._id });
                    return Response.success(res, '', 'Screen version have been deleted');

                }

            } catch (e) {
                return Response.errorInternal(e, res)
            }
        },

        uploadSketch: async(req, res) => {
            try {
                if (!!req.fileValidationErr) {
                    return Response.badValuesData(res, req.fileValidationErr);
                } else {
                    const schema = Joi.object().keys({
                        projectId: Joi.string().trim().required()
                    })

                    let { error, value } = Joi.validate(req.body, schema);
                    if (error) {
                        let lAryErrorMsg = _.map(error.details, "message")
                        return Response.badValuesData(res, lAryErrorMsg);
                    }

                    let checkUser = await Project.find({ _id: req.body.projectId, "userId": req.user._id, projectStatus: 1 })

                    if (!checkUser.length) {
                        return Response.forbiddenError(res, { message: "You are not having permisssions to upload screens!!" })
                    }
                    let lAryScreenData = [];
                    let lAryScreens = req.files;

                    console.log(lAryScreens, "QWERTUIOP")

                    for (let x of lAryScreens) {

                        let lObjReQData = {};

                        lObjReQData.userId = req.user ? req.user._id : "";

                        lObjReQData.approvedStatus = "approved";

                        let sourceImage = x.location;

                        var colorP = await Jimp.read(sourceImage).then(sourceImage => {
                            var palette = ColorThief.getPalette(sourceImage, 5);
                            return palette
                        }).catch(function(err) {
                            return false
                        });

                        lObjReQData.colorPalette = colorP;
                        lObjReQData.screenStatus = 1;
                        lObjReQData.uploadStatus = true;
                        lObjReQData.isPublish = true;
                        lObjReQData.sequence = lAryScreens.indexOf(x);
                        lObjReQData.inspire = false;
                        lObjReQData.screenName = x.originalname;
                        lObjReQData.image = x.key;

                        lAryScreenData.push(lObjReQData);
                    };

                    lAryScreenData = await Promise.all(lAryScreenData);

                    let screenDetails = await Screens.insertMany(lAryScreenData, { ordered: true });
                    for (let screen of screenDetails) {
                        let obj = {
                            categories: screen.categories,
                            industry: screen.industry,
                            tags: screen.tags,
                            isPublish: screen.isPublish,
                            disableComments: screen.disableComments,
                            colorPalette: screen.colorPalette,
                            approvedStatus: screen.approvedStatus,
                            viewCount: screen.viewCount,
                            viewedUser: screen.viewedUser,
                            screenStatus: screen.screenStatus,
                            uploadStatus: screen.uploadStatus,
                            inspire: screen.inspire,
                            parentId: screen._id,
                            screenName: screen.screenName,
                            image: screen.image,
                            userId: screen.userId,
                            description: screen.description,
                            sequence: screen.sequence
                        }
                        let version = await screenVersion.create(obj);
                        await Screens.findOneAndUpdate({ _id: ObjectId(version.parentId) }, { $set: { screenVersionId: version._id } }, { new: true });
                        await ProjectScreen.create({
                            projectId: req.body.projectId,
                            screenId: version.parentId
                        })
                    }

                    return Response.success(res, lAryScreenData, 'Screens uploaded succesfully');
                }
            } catch (error) {
                return Response.errorInternal(error, res)
            }
        },

    }

    return Object.freeze(methods)
}

module.exports = screensComponentCtrl()