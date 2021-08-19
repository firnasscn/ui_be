
function TagRoutes() {
    let ctrl = require('./projecttag.controller')
    return (open, closed) => {
        closed.route('/tags/createTag').post(ctrl.createTag)
        closed.route('/tags/deleteTag').put(ctrl.deleteTag)
        closed.route('/tags/editTag').put(ctrl.editTag)
        closed.route('/tags/listTag').get(ctrl.listTag)
        closed.route('/tags/addScreens').post(ctrl.addImages)
        closed.route('/tags/deleteScreen').put(ctrl.removeScreen)
    }
}

module.exports = TagRoutes()