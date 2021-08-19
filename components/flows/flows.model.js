// flows-model.js - A mongoose model
// 
// See http://mongoosejs.com/docs/models.html
// for more of what you can do here.
const mongoose = require('mongoose');
const Flows = mongoose.Schema({
  flowName: {
    type: String
  },
  screenType: {
    type: mongoose.Schema.Types.ObjectId, ref: 'screenTypes'
  },
  font: {
    type: String
  },
  isPublish: {
    type: Boolean,
    default: false
  },
  colorPalette: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  /*  images: [{
     type: String
   }], */
  contributers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  }],
  screens: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'screens'
  }],
  sequence: {},
  type: {
    type: String,
    enum: ["android", "ios", "web"]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'users'
  },
  approvedStatus: {
    type: String,
    enum: ['approved', 'rejected', 'in-review']
  },
  approvedTime: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId, ref: 'users'
  },
  hotSpots: [{
    screenId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'screens'
    },
    targetScreenId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'screens'
    },
    flowId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'flows'
    },
    x: {
      type: String
    },
    y: {
      type: String
    },
    width: {
      type: String
    },
    height: {
      type: String
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'users'
    }
  }]
},
  { timestamps: true }
);

Flows.index({ 'userId': 1, 'flowName': 1 }, { unique: true })
const Pattern_Flows = mongoose.model('flows', Flows);
module.exports = Pattern_Flows;