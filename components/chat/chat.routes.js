function componentOneRoutes() {
    const ctrl = require('./chat.controller')
    const { routePrefix } = require('../../utils')

    return (open, closed) => {
        open.route('/chat/postComment').post(ctrl.startChat);
        open.route('/chat/listAllChat/:screenId').get(ctrl.listAllChatForSpecifiedScreen);
        open.route('/chat/listAllChatEmail').get(ctrl.listOfChats);
    }
}

module.exports = componentOneRoutes()