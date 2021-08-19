function activityFeed() {
    const ctrl = require('./activityfeed.controller')
  
    return (open, closed) => {
      closed.route('/activity/:projectId/:page').get(ctrl.listActivity)
    }
  }
  
  module.exports = activityFeed()
  