// screens-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const mongoose = require('mongoose');
const autoPopulate = require('mongoose-autopopulate');
const mongoosastic = require('mongoosastic')

const Screens = mongoose.Schema({
  screenVersionId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'screenVersions', autopopulate: true
  },
  screenName: {
    type: String,
    es_type: 'text',
    es_indexed: true,
  },
  screenType: {
    type: mongoose.Schema.Types.ObjectId, ref: 'screenTypes', autopopulate: true
    , es_type: "text", es_indexed: true
  },
  font: {
    type: String
  },
  categories: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'categories', autopopulate: true
  }],
  industry: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'industry',
    autopopulate: {
      select: "-__v -name"
    }
  }],
  tags: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'tags',
    es_type: "text", es_indexed: true,
    autopopulate: {
      select: "name"
    },
    es_include_in_parent: true,
    es_select: 'name'
  }],
  isPublish: {
    type: Boolean,
    default: false,
    es_indexed: true,
  },
  disableComments: {
    type: Boolean,
    default: false
  },
  sequence: {
    type: Number,
  },
  colorPalette: [{
    type: Array,
    default: false
  }],
  image: {
    type: String,
    es_type: 'text',
    es_indexed: true
  },
  publishedOn: {
    type: Date
  },
  description: {
    type: String
  },
  type: {
    type: String,
    enum: ["mobile", "web"],
    es_type: 'text',
    es_indexed: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    autopopulate: {
      select: "email _id userName firstName lastName profilePicture"
    },
    es_select: 'email _id userName firstName lastName profilePicture',
    es_type: 'nested',
    es_include_in_parent: true,
    es_indexed: true
  },
  approvedStatus: {
    type: String,
    enum: ['approved', 'rejected', 'in-review'],
    default: "in-review"
  },
  approvedTime: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId, ref: 'users'
  },
  viewCount: {
    type: Number,
    default: 0,
    es_type: 'text',
    es_indexed: true
  },
  viewedUser: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'users'
  }],
  screenStatus: {
    type: Number, //0-Trash Screen
    default: 1,
    es_type: 'text',
    es_indexed: true
  },
  tagId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'projecttags',
    autoPopulate: true
  },
  screenDesign: {
    type: String,
    enum: ['logo', 'screen'],
  },
  noOfVotes: {
    type: Number
  },
  avgRating: {
    type: Number
  },
  uploadStatus: {
    type: Boolean,
    default: false
  },
  inspire: {
    type: Boolean,
    default: false
  }
},
  { timestamps: true }
);
Screens.plugin(autoPopulate);
// Screens.index({ 'userId': 1, 'screenName': 1 }, { unique: true })
// Screens.plugin(mongoosastic, {
//   "host" : "localhost",
//   "port" : 9200
// })

const Pattern_Screens = mongoose.model('screens', Screens);

module.exports = Pattern_Screens;

// var screens = module.exports = Pattern_Screens,
//   stream = screens.synchronize({}, { saveOnSynchronize: true })
//   , count = 0;
// stream.on('data', function (err, doc) {
//   count++;
// });
// stream.on('close', function () {
//   // console.log('indexed ' + count + ' documents!');
// });
// stream.on('error', function (err) {
//   // console.log(err);
// });
