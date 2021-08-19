function componentOneRoutes() {
  const ctrl = require('./notification.controller')
  const { routePrefix } = require('../../utils')

  return (open, closed) => {
    closed.route('/notifications/listAllNotifications').get(ctrl.listAllNotifications)
    closed.route('/notifications/update').put(ctrl.updateViewStatus);
  }
}

module.exports = componentOneRoutes()
