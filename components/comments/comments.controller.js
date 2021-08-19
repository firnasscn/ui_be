require("dotenv").config();

const Comments = require('./comments.model');
const Screens = require('../screens/screens.model');
const Response = require('../../utils/response');
const Vote = require('../voting/voting.model');
const UserBadge = require('../../utils/userBadge');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const Joi = require('joi');
const _ = require('lodash');

let limit = 10;
function commentComponentCtrl(model) {
  const methods = {
    comments: async (req, res) => {
      try {
        let param = req.params.type;
        let comments = "";

        //Pagination
        let page = req.query.page;
        let offset = page - 1;
        offset = offset * limit;

        switch (param) {
          case "all":
            comments = await Comments.find({ screenId: req.query.screenId }).sort({ _id: -1 }).skip(offset).limit(limit);
            break;
          case "designThinking":
            comments = await Comments.find({
              screenId: req.query.screenId, 'designThinking.comments': { $ne: null }
            }, 'designThinking').sort({ _id: -1 }).skip(offset).limit(limit);
            break;
          case "easeOfUse":
            comments = await Comments.find({ screenId: req.query.screenId, 'easeOfUse.comments': { $ne: null } }, 'easeOfUse').sort({ _id: -1 }).skip(offset).limit(limit);
            break;
          case "aesthetics":
            comments = await Comments.find({ screenId: req.query.screenId, 'aesthetics.comments': { $ne: null } }, 'aesthetics').sort({ _id: -1 }).skip(offset).limit(limit);
            break;
          default:
            return Response.notFound(res, 'Type Not Found!');
        }

        return Response.success(res, comments, 'Comments');
      }
      catch (err) {
        return Response.errorInternal(err, res);
      }
    },
    postcomment: async (req, res) => {
      try {

        let schema = Joi.object().keys({
          'screenId': Joi.string().alphanum().required(),
          'designThinking': Joi.string(),
          'vote-designThinking': Joi.number().integer().min(0).max(5),
          'easeOfUse': Joi.string(),
          'vote-easeOfUse': Joi.number().integer().min(0).max(5),
          'aesthetics': Joi.string(),
          'vote-aesthetics': Joi.number().integer().min(0).max(5)
        });

        let { error, value } = Joi.validate(req.body, schema);

        if (error) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }

        let screen_id = req.body.screenId;
        let user_id = req.user._id;

        let screen = await Comments.find({ screenType: screen_id, userId: user_id });
        let screenDetails = await Screens.find({ _id: req.body.screenId });

        if (screen.length == 0 || screen == null) {
          let postcmt = new Comments({
            'screenId': screen_id,
            'userId': user_id,
            'designThinking.comments': req.body["designThinking"],
            'designThinking.vote': req.body["vote-designThinking"],
            'easeOfUse.comments': req.body["easeOfUse"],
            'easeOfUse.vote': req.body["vote-easeOfUse"],
            'aesthetics.comments': req.body["aesthetics"],
            'aesthetics.vote': req.body["vote-aesthetics"]
          });

          let comment = await postcmt.save();
    
          let avgCmt = await Comments.aggregate([
            { $match: { screenId: screen_id } },
            {
              $group: {
                _id: '$screenId',
                designAvg: { $avg: '$designThinking.vote' },
                easeAvg: { $avg: '$easeOfUse.vote' },
                aestheticAvg: { $avg: '$aesthetics.vote' }
              }
            }
          ]);
          avgCmt = avgCmt[0];

          await Screens.updateOne({ _id: screen_id }, {
            $set: {
              'avgRating.designThinking': avgCmt ? avgCmt.designAvg.toFixed(2) : 0,
              'avgRating.easeOfUse': avgCmt ? avgCmt.easeAvg.toFixed(2) : 0,
              'avgRating.aesthetics': avgCmt ? avgCmt.aestheticAvg.toFixed(2) : 0
            }
          });

          return Response.success(res, comment, 'Comment Posted Successfully');
        }
        else {
          return Response.error(res, 409, 'Duplicate Entry');
        }
      }
      catch (err) {
        console.log(err);
        return Response.errorInternal(err, res);
      }
    },
    updateComment: async (req, res) => {
      try {
        let cmt_id = req.params.commentId;
        console.log("cmt_id", cmt_id);
        console.log("req.body", req.body);
        let updateCmt = await Comments.findOneAndUpdate({ _id: cmt_id, userId: req.user._id }, {
          $set: {
            commente: req.body.comment
          }
        }, { new: true });
        console.log(updateCmt, "updateCmt")
        if (updateCmt)
          return Response.success(res, updateCmt, 'Comment Updated Successfully');
        else
          return Response.message(res, 503, 'No data updated');
      }
      catch (err) {
        return Response.errorInternal(err, res);
      }
    },
    deleteComment: async (req, res) => {
      try {
        let cmt_id = req.body.commentId;
        let deleteCmt = await Comments.findOneAndUpdate({ _id: cmt_id, userId: req.user._id }, {
          $set: {
            status: 0
          }
        });

        if (deleteCmt != null)
          return Response.success(res, {}, 'Comment Deleted Successfully');
        else
          return Response.message(res, 503, 'No data deleted');
      }
      catch (err) {
        return Response.errorInternal(err, res);
      }
    },
    addCommentToScreen: async (req, res) => {
      try {

        const schema = Joi.object().keys({
          screenId: Joi.string().trim(),
          comment: Joi.string().trim(),
          parentId: Joi.string().allow('')
        }).required()
        let lObjBody
        let { error, value } = Joi.validate(req.body, schema);
        if (error) return Response.badValuesData(res, error)
        let lObjCommentDisable = await Screens.find({ _id: ObjectId(req.body.screenId) }).lean()

        if (lObjCommentDisable[0].disableComments) {
          return Response.forbiddenError(res, "Comments are not accepted for this screen")
        }
        if (req.body.parentId != "") {
          lObjBody = {
            screenId: req.body.screenId,
            parentId: req.body.parentId,
            userId: req.user._id,
            comments: req.body.comment
          }
        } else {
          lObjBody = {
            screenId: req.body.screenId,
            userId: req.user._id,
            comments: req.body.comment
          }
        }
        let lObjComment = await Comments.create(lObjBody)
        await UserBadge.screenCommentsReceived(lObjCommentDisable[0].userId);
        await UserBadge.screenCommentsTracking(req.user._id);

        let lObjCommentResponse = await Comments.aggregate([{ $match: { _id: ObjectId(lObjComment._id) } },
        { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'createdUser' } },
        { $unwind: '$createdUser' },
        {
          $group: {
            _id: "$_id",
            screenId: { $first: "$screenId" },
            created_at: { $first: "$created_at" },
            comment: { $first: "$comments" },
            'createdUser': { $first: "$createdUser" }
          }
        },
        {
          $project: {
            _id: 1,
            screenId: 1,
            created_at: 1,
            comment: 1,
            'userId': {
              '_id': '$createdUser._id',
              'userName': '$createdUser.userName',
              'firstName': '$createdUser.firstName',
              'lastName': '$createdUser.lastName',
              'email': '$createdUser.email',
              "profilePicture": { $ifNull: [{ $concat: ["https://d31qgkthzchm5g.cloudfront.net/profilePicture/", "$createdUser.profilePicture"] }, ""] },
            }
          }
        },
        ])
        return Response.success(res, lObjCommentResponse[0], 'My Comments');
      } catch (error) {
        return Response.errorInternal(error, res)
      }
    },
    votingForComments: async (req, res) => {
      try {
        let schema = Joi.object().keys({
          commentId: Joi.string().alphanum().required(),
          vote: Joi.number()
        })

        let { err, result } = Joi.validate(req.body, schema);
        if (err) {
          let lAryErrorMsg = _.map(error.details, "message")
          return Response.badValuesData(res, lAryErrorMsg);
        }

        let checkVote = await Vote.find({ userId: req.user._id, commentId: req.body.commentId });
        let lObjResponse
        if (checkVote.length > 0) {
          lObjResponse = await Vote.updateOne({ _id: checkVote[0]._id }, {
            $set: {
              vote: req.body.vote
            }
          })
        }
        else {
          lObjResponse = await Vote.create({
            commentId: req.body.commentId,
            userId: req.user._id,
            vote: req.body.vote
          })
        }
        return Response.success(res, lObjResponse, 'Thanks for your voting...');
      }
      catch (e) {
        console.log(e);
        return Response.errorInternal(e, res)
      }
    }
  }
  return Object.freeze(methods);
}

module.exports = commentComponentCtrl();
