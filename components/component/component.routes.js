function componentOneRoutes() {
  const ctrl = require('./component.controller')
  const { routePrefix } = require('../../utils')

  return (open, closed) => {
    open.route('/index').get(ctrl.doSomething)

    closed.route('/index').get(ctrl.doSomethingElse)
  }
}

module.exports = componentOneRoutes()
