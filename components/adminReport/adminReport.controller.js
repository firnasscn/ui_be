const user = require('../user/user.model');
const Response = require('../../utils/response');
const Joi = require('joi');
const Users = require('../user/user.model');
let Projects = require('../project/project.model')
let mongoose = require('mongoose')
let Focusgroup = require('../focusGroup/focusGroup.model')
let Hotspots = require('../hotspot/hotspot.model');
const UserInvite = require('../userInvited/userInvite.model');
let Teams = require('../team/team.model');
let TeamMember = require('../teamUsers/teamUsers.model');
let Screens = require('../screens/screens.model')
let ProjectScreens = require('../project/projectScreen.model')
const InspireScreen = require('../project/inspireActivity.model');
const Chats = require('../chat/chat.model');
const Usage = require('./usage-report.model')
let ObjectId = mongoose.Types.ObjectId;
const fs = require('fs');
var json2xls = require('json2xls');
const filename = 'doodleflow-usage-report.xlsx';
var XLSX = require('xlsx');
const mailer = require('../../utils/mailService');

const moment = require('moment');

function adminController() {
    const methods = {
        newUsers: async(req, res) => {
            try {
                let todayDate = moment().format('YYYY-MM-DD')
                let date = req.query.date ? req.query.date : moment(todayDate, 'YYYY-MM-DD');
                let nextDate = moment(todayDate, "YYYY-MM-DD").add(1, 'd');
                console.log("date", date);
                console.log("nextDate", nextDate);
                let newUsers = await Users.aggregate([{
                        $match: {
                            createdAt: {
                                '$gte': new Date(date),
                                '$lte': new Date(nextDate)
                            },

                        }
                    },
                    { $project: { _id: 1, email: 1, firstName: 1 } }
                ])

                let data = {
                    newusers: newUsers,
                    count: newUsers.length
                }

                return Response.success(res, data, 'Images Approved Successfully')

                //return Response.notAuthorized(res, 'You are not a Admin')
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res)
            }
        },
        existingUserLoggedIn: async(req, res) => {
            try {
                let todayDate = moment().format('YYYY-MM-DD')
                let date = req.query.date ? req.query.date : moment(todayDate, 'YYYY-MM-DD');
                let nextDate = moment(todayDate, "YYYY-MM-DD").add(1, 'd');

                let existingUser = await Users.aggregate([{
                        $match: {
                            lastLoggedIn: {
                                '$gte': new Date(date),
                                '$lte': new Date(nextDate)
                            }
                        }
                    },
                    { $project: { _id: 1, email: 1, firstName: 1, lastName: 1, userName: 1, lastLoggedIn: 1 } }
                ])

                let projectData = [];

                for (let user of existingUser) {
                    let project = await Projects.aggregate([
                        { $match: { userId: ObjectId(user._id), projectStatus: 1, createdAt: { '$gte': new Date(date) } } },
                        { $lookup: { from: 'screens', localField: '_id', foreignField: 'projectId', as: 'projectScreen' } },
                        { $unwind: { path: '$projectScreen', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: '$_id',
                                projectName: { $first: '$projectName' },
                                userId: { $first: '$userId' },
                                invitedUser: { $first: '$teamMembers' },
                                projectScreens: {
                                    $addToSet: {
                                        $cond: {
                                            if: { $eq: ["$projectScreen.screenStatus", 1] },
                                            then: {
                                                _id: '$projectScreen._id',
                                                screenName: '$projectScreen.screenName',
                                                image: '$projectScreen.image'
                                            },
                                            else: ''
                                        }
                                    }
                                }
                            }
                        }
                    ]);
                    let projectCount = await Projects.find({ userId: ObjectId(user._id), projectStatus: 1, createdAt: { '$gte': new Date(date) } }).count();
                    let focusGroupDetails = [];
                    let screenDetails = [];
                    let focusGroupCount
                    for (let pro of project) {
                        let focusgroup = await Focusgroup.aggregate([
                            { $match: { projectId: ObjectId(pro._id), groupstatus: 1 } },
                            { $lookup: { from: 'screens', localField: '_id', foreignField: 'focusGroupId', as: 'screens' } },
                            { $unwind: { path: '$screens', 'preserveNullAndEmptyArrays': true } },
                            {
                                $group: {
                                    _id: '$_id',
                                    groupName: { $first: '$groupName' },
                                    invitedMembers: { $addToSet: '$invitedMembers' },
                                    screens: {
                                        $addToSet: {
                                            $cond: {
                                                if: { $eq: ["$screens.screenStatus", 1] },
                                                then: {
                                                    _id: '$screens._id',
                                                    screenName: '$screens.screenName',
                                                    image: '$screens.image'
                                                },
                                                else: ''
                                            }
                                        }
                                    }
                                }
                            }
                        ])
                        focusGroupCount = await Focusgroup.find({ projectId: ObjectId(pro._id), groupstatus: 1 }).count()
                        focusGroupDetails.push(focusgroup)

                        for (let focus of focusgroup) {
                            for (let screen of focus.screens) {
                                let screens = await Screens.aggregate([
                                    { $match: { _id: ObjectId(screen._id) } },
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
                                    { $lookup: { from: 'hotspots', localField: '_id', foreignField: 'screenId', as: 'hotspots' } },
                                    { $unwind: { path: '$hotspots', 'preserveNullAndEmptyArrays': true } },
                                    {
                                        $group: {
                                            _id: '$_id',
                                            image: { $first: '$image' },
                                            screenName: { $first: '$screenName' },
                                            description: { $first: { $ifNull: ['$decription', ''] } },
                                            inspire: { $first: '$inspire' },
                                            chats: {
                                                $addToSet: {
                                                    message: '$chats.message',
                                                    userName: '$chatusers.userName',
                                                    anonymousName: '$anonymouschat.userName',
                                                    createdAt: '$chats.createdAt'
                                                }
                                            },
                                            focusGroupName: { $first: '$focusgroup.groupName' },
                                            invitedMembers: { $first: '$focusgroup.invitedMembers' },
                                            user: {
                                                $first: {
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
                                            hotspots: {
                                                $addToSet: {
                                                    comment: '$hotspots.comment',
                                                    screenId: '$hotspots.screenId'
                                                }
                                            }
                                        }
                                    }
                                ])
                                screenDetails.push(screens[0])
                            }
                        }
                    }
                    projectData.push({
                        user: user,
                        projectCount: projectCount,
                        // focusGroupCount: focusGroupCount,
                        project: project,
                        focusGroupScreens: screenDetails
                    });
                }

                return Response.success(res, projectData, 'Today User Loggedin')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        userReport: async(req, res) => {
            try {
                let todayDate = moment().format('YYYY-MM-DD')
                let date = moment(todayDate, 'YYYY-MM-DD');
                let nextDate = moment(todayDate, "YYYY-MM-DD").add(1, 'd');

                let existingUser = await Users.aggregate([{
                        $match: {
                            lastLoggedIn: {
                                '$gte': new Date(date),
                                '$lte': new Date(nextDate)
                            }
                        }
                    },
                    { $project: { _id: 1, email: 1, firstName: 1, lastName: 1, userName: 1, lastLoggedIn: 1, createdAt: 1 } }
                ])

                let projectData = [];
                let focusGroupCount;
                let screen;

                for (let user of existingUser) {

                    let projectCount = await Projects.find({ userId: ObjectId(user._id), projectStatus: 1, createdAt: { '$gte': new Date(date) } }).count();
                    let projectDetails = await Projects.find({ userId: ObjectId(user._id), projectStatus: 1, createdAt: { '$gte': new Date(date) } });
                    for (let x of projectDetails) {
                        focusGroupCount = await Focusgroup.find({ groupstatus: 1, createdUser: ObjectId(user._id), createdAt: { '$gte': new Date(date) }, projectId: ObjectId(x._id) }).count()
                        screen = await ProjectScreens.find({ projectId: ObjectId(x._id), createdAt: { '$gte': new Date(date) } }).count();
                    };
                    let hotspots = await Hotspots.find({ status: 1, createdAt: { '$gte': new Date(date) }, userId: ObjectId(user._id) }).count()


                    let lObjHotspot = await Hotspots.aggregate([{
                            $match: {
                                status: 1,
                                createdAt: { '$gte': new Date(date) },
                                userId: ObjectId(user._id)
                            }
                        },
                        { $lookup: { from: "users", localField: "userId", foreignField: "_id", as: "Users" } },
                        { $unwind: { path: '$Users', 'preserveNullAndEmptyArrays': true } },
                        { $lookup: { from: "hostspotactions", localField: "actionId", foreignField: "_id", as: "HotspotAction" } },
                        { $unwind: { path: '$HotspotAction', 'preserveNullAndEmptyArrays': true } },
                        {
                            $group: {
                                _id: "$HotspotAction.name",
                                count: { $sum: 1 },
                                actionId: { $first: '$actionId' }
                            }
                        },
                        { $sort: { count: 1 } },
                    ]);

                    let members = await UserInvite.find({ userId: ObjectId(user._id), createdAt: { '$gte': new Date(date) } }).count();
                    let teamCount = await Teams.find({ createdUser: ObjectId(user._id), createdAt: { '$gte': new Date(date) } }).count();
                    let teamMember = await TeamMember.find({ email: user.email, createdAt: { '$gte': new Date(date) } }).count();
                    let inspireCount = await InspireScreen.find({ userId: ObjectId(user._id), createdAt: { '$gte': new Date(date) } }).count();
                    let chatCount = await Chats.find({ userId: ObjectId(user._id), createdAt: { '$gte': new Date(date) } }).count();

                    let issue, fixed, completed;
                    if (lObjHotspot.length === 1) {
                        issue = lObjHotspot[0].count;
                    } else if (lObjHotspot.length === 2) {
                        issue = lObjHotspot[0].count;
                        fixed = lObjHotspot[1].count;
                    } else if (lObjHotspot.length === 3) {
                        issue = lObjHotspot[0].count;
                        fixed = lObjHotspot[1].count;
                        completed = lObjHotspot[2].count;
                    }

                    let usageData = {
                        "date": moment(date).format('YYYY-MM-DD'),
                        "userName": user.userName,
                        "email": user.email,
                        "startDate": moment(user.createdAt).format('YYYY-MM-DD'),
                        "role": (teamCount == 0) ? '-' : teamCount,
                        "teamMates": (teamMember == 0) ? '-' : teamMember,
                        "project": (projectCount == 0) ? '-' : projectCount,
                        "focusGroup": (focusGroupCount == 0) ? '-' : focusGroupCount,
                        "screenCount": (screen == 0) ? '-' : screen,
                        "inspireScreen": (inspireCount == 0) ? '-' : inspireCount,
                        "issue": issue || '-',
                        "fixed": fixed || '-',
                        "completed": completed || '-',
                        "chat": (chatCount == 0) ? '-' : chatCount,
                        "invitedUser": (members == 0) ? '-' : members
                    };

                    let isAlreadyExsist = await Usage.findOne({ date: new Date(usageData.date), email: usageData.email });
                    if (isAlreadyExsist === null) {
                        await Usage.create(usageData);
                    }


                    projectData.push({
                        // user: user,
                        // projectCount: projectCount,
                        // focusGroupCount: focusGroupCount,
                        // actionCounts: lObjHotspot,
                        // hotspots: hotspots,
                        // inviedUser: members,
                        // teamCount: teamCount,
                        // teamMember: teamMember,
                        // inspire: inspireCount,
                        // chat: chatCount,
                        // screenCount: screen,
                        "REPORT DATE": moment(date).format('YYYY-MM-DD'),
                        "USERNAME": user.userName,
                        "EMAIL": user.email,
                        "START DATE": moment(user.createdAt).format('YYYY-MM-DD'),
                        "ROLE": (teamCount == 0) ? '-' : teamCount,
                        "TEAM MATES": (teamMember == 0) ? '-' : teamMember,
                        "PROJECT": (projectCount == 0) ? '-' : projectCount,
                        "FOCUSGROUP": (focusGroupCount == 0) ? '-' : focusGroupCount,
                        "SCREEN COUNT": (screen == 0) ? '-' : screen,
                        "INSPIRE COUNT": (inspireCount == 0) ? '-' : inspireCount,
                        "ISSUES": issue || '-',
                        "FIXED": fixed || '-',
                        "COMPLETED": completed || '-',
                        "CHAT": (chatCount == 0) ? '-' : chatCount,
                        "INVITED USER": (members == 0) ? '-' : members
                    });
                };

                if (fs.existsSync(filename)) {
                    console.log("File exists.")
                    let lastData;
                    // Display the file data 
                    var workbook = XLSX.readFile('doodleflow-usage-report.xlsx');
                    var sheet_name_list = workbook.SheetNames;
                    sheet_name_list.forEach(function(y) {
                        var worksheet = workbook.Sheets[y];
                        var headers = {};
                        var data = [];
                        for (z in worksheet) {
                            if (z[0] === '!') continue;
                            //parse out the column, row, and value
                            var tt = 0;
                            for (var i = 0; i < z.length; i++) {
                                if (!isNaN(z[i])) {
                                    tt = i;
                                    break;
                                }
                            };
                            var col = z.substring(0, tt);
                            var row = parseInt(z.substring(tt));
                            var value = worksheet[z].v;

                            //store header names
                            if (row == 1 && value) {
                                headers[col] = value;
                                continue;
                            }

                            if (!data[row]) data[row] = {};
                            data[row][headers[col]] = value;
                        }
                        //drop those first two rows which are empty
                        data.shift();
                        data.shift();

                        lastData = data;
                    });

                    projectData = projectData.concat(lastData);

                    fs.unlinkSync(filename);
                    var xls = json2xls(projectData);
                    fs.writeFileSync(filename, xls, 'binary', (err) => {
                        if (err) {
                            console.log("writeFileSync :", err);
                        }
                        console.log(filename + " file is saved!");
                    });

                    let obj = {
                        file: filename
                    }
                    mailer.usageReport(obj);
                } else {
                    console.log("File does not exist.");

                    var xls = json2xls(projectData);
                    fs.writeFileSync(filename, xls, 'binary', (err) => {
                        if (err) {
                            console.log("writeFileSync :", err);
                        }
                        console.log(filename + " file is saved!");
                    });

                    let obj = {
                        file: filename
                    }
                    mailer.usageReport(obj);
                }

                // return Response.success(res, projectData, 'Today User Loggedin')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        }
    }
    return Object.freeze(methods);
}
module.exports = adminController();