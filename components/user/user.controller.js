require("dotenv").config();

const Joi = require('joi');
const User = require('../user/user.model');
const Response = require('../../utils/response');
const crypto = require('crypto-random-string');
const UserInvite = require('../userInvited/userInvite.model');
const Screens = require('../screens/screens.model')
const fileUpload = require('../../utils/fileUpload')
const FocusGroup = require('../focusGroup/focusGroup.model');
const Project = require('../project/project.model');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const jwt = require('jsonwebtoken')
const sanitize = user => {
    console.log("user.googleId", user.googleId)
        //remove sensitive data
    user.isPasswordUpdate = (!!user.password) ? true : false
    user.password = user.salt = user.created = user.updated = undefined;
    user.verifyToken = user.resetToken = user.resetTokenVerfiedTime = user.verfiedTime = undefined;
    user.isGoogleUser = (!!user.googleId) ? true : false
        //Image URL
    user.profilePicture = (!!user.profilePicture) ? `${process.env.AWS_URL}profilePicture/${user.profilePicture}` : '';

    return user;
};

function userComponentCtrl(model) {
    const methods = {
        me: async(req, res) => {
            try {
                let me = req.user;

                me = sanitize(me) //Remove Sensitive Data
                let lObjProjectCreatedCount = await Project.count({ userId: ObjectId(me._id), projectStatus: 1 })
                let lObjProjectTeamMemberCount = await Project.count({ userId: ObjectId(me._id), projectStatus: 1 })
                let lObjFGCreatedCount = await FocusGroup.count({ createdUser: ObjectId(me._id), groupstatus: 1 })
                let lObjFGCollaboratorCount = await FocusGroup.count({ "invitedMembers": { $elemMatch: { email: me.email } }, groupstatus: 1 })
                me.count = {
                    project: {
                        created: lObjProjectCreatedCount,
                        teamMember: 0 || lObjProjectTeamMemberCount
                    },
                    focusgroup: {
                        created: lObjFGCreatedCount,
                        collaborated: lObjFGCollaboratorCount
                    }
                }
                let lObjProjectList = await Project.find({ userId: ObjectId(me._id), projectStatus: 1 }).select('_id').lean()
                let lObjincompleteProject
                for (let projectId of lObjProjectList) {
                    let lObprojectId = await Project.aggregate([{
                        $match: {
                            userId: ObjectId(req.user._id),
                            _id: ObjectId(projectId._id)
                        }
                    }, { $lookup: { from: 'screens', localField: '_id', foreignField: 'projectId', as: 'screens' } }, {
                        $project: {
                            screensCount: { $size: "$screens" },
                            _id: 1

                        }
                    }])
                    if (lObprojectId[0].screensCount == 0)
                        lObjincompleteProject = lObprojectId[0]._id
                        // console.log(lObjincompleteProject)
                }
                me.inCompleteProject = lObjincompleteProject || null
                me.userId = me._id;
                // console.log(lObjincompleteProject)
                return Response.success(res, me, 'Profile Details');
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getAnonymousUser: async(req, res) => {
            try {
                if (!req.headers['x-access-token']) {
                    return Response.forbiddenError(res, { message: 'Access Denied, Token expired!!!' })
                }
                let decoded = await jwt.verify(req.headers['x-access-token'], process.env.SUPER_SECRET)

                let user = {
                    _id: decoded._id,
                    email: decoded.email,
                    name: decoded.userName,
                    channelName: decoded.channelName
                }

                return Response.success(res, user, 'User Details')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        getUserata: async(req, res) => {
            try {
                let lObjUserData = await User.findOne({ _id: req.params.userId }).lean()
                lObjUserData = sanitize(lObjUserData) //Remove Sensitive Data

                return Response.success(res, lObjUserData, 'Profile Details');
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        changePassword: (req, res) => {
            try {
                const schema = Joi.object().keys({
                    oldPassword: Joi.string(),
                    newPassword: Joi.string(),
                    googleId: Joi.string()
                }).required().options({ abortEarly: false })

                let { error, value } = Joi.validate(req.body, schema);
                if (error) {
                    if (error) return Response.badValuesData(res, error)
                }

                let user = req.user;
                let oldPassword = req.body.oldPassword;
                let newPassword = req.body.newPassword;

                console.log("oldPassword", oldPassword);
                if (req.body.googleId && oldPassword != undefined) {
                    let newSaltAndPass = User(user).getSaltAndPassword(newPassword);
                    user.salt = newSaltAndPass.salt;
                    user.password = newSaltAndPass.password;
                    User.findByIdAndUpdate(user._id, user, { new: true }, (err, raw) => {
                        if (err) return Response.errorInternal(err, res)
                        raw = sanitize(raw) //Remove Sensitive Data
                        return Response.success(res, raw, 'Password Updated Successfully');
                    });
                } else {
                    if (User(user).verifyPassword(oldPassword, true)) {
                        let newSaltAndPass = User(user).getSaltAndPassword(newPassword);
                        user.salt = newSaltAndPass.salt;
                        user.password = newSaltAndPass.password;

                        User.findByIdAndUpdate(user._id, user, { new: true }, (err, raw) => {
                            if (err) return Response.errorInternal(err, res)
                            raw = sanitize(raw) //Remove Sensitive Data
                            return Response.success(res, raw, 'Password Updated Successfully');
                        });
                    } else {
                        return Response.badValues(res, "Invalid old Password")
                    }
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        updateProfile: (req, res) => {
            try {
                let user = req.user;
                let data = req.body;
                if (req.fileValidationErr) return Response.error(res, 400, req.fileValidationErr)
                if (req.file) {
                    data.profilePicture = req.file.key
                }
                if (user) {
                    let newItem = {...user, ...data };
                    User.findByIdAndUpdate(
                        user._id, newItem, {
                            new: true
                        }, (err, result) => {
                            if (err) {
                                return Response.error(res, 400, err)
                            } else {
                                result = sanitize(result);
                                return Response.success(res, result, 'Profile updated successfully')
                            }
                        });
                }
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        updateProfilePic: async(req, res) => {
            console.log("updateProfilePic", req.file)
            try {
                if (req.fileValidationErr) return Response.error(res, 400, req.fileValidationErr)

                let lObjUser = await User.findByIdAndUpdate(req.user._id, { $set: { profilePicture: req.file.key } }, { new: true }).lean();
                lObjUser = sanitize(lObjUser);
                return Response.success(res, lObjUser, 'Profile Photo updated successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },

        logout: async(req, res) => {
            try {
                await User.findByIdAndUpdate(req.user._id, {
                    $set: {
                        lastLoggedIn: Date.now()
                    }
                }).lean();
                return Response.success(res, 'Logged out successfully')
            } catch (err) {
                return Response.errorInternal(err, res)
            }
        },
        getAllInvitedmembers: async(req, res) => {
            try {
                let Email = [];
                let searchText = req.query.search ? req.query.search : ''
                let members = await UserInvite.find({ userId: req.user._id, email: { $regex: searchText, $options: "i" } }).sort({ createdAt: -1 }).limit(5);
                members.filter(function(member) {
                    if (member) {
                        Email.push(member.email);
                    }
                })
                return Response.success(res, Email, 'All invited members');
            } catch (err) {
                console.log(err);
                return Response.errorInternal(err, res);
            }
        }
    }
    return Object.freeze(methods)
}

module.exports = userComponentCtrl()