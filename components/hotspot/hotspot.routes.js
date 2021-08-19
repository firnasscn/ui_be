function componentOneRoutes() {
    const ctrl = require('./hotspot.controller')

    return (open, closed) => {
        closed.route('/hotspot/get/:screenId').get(ctrl.hotspotComments);
        open.route('/hotspot/getAllHotspots').get(ctrl.listOfOnScreenComments);
        open.route('/hotspot/post').post(ctrl.createHotspotcomment);
        open.route('/hotspot/dueDate').patch(ctrl.updateDuedate);
        open.route('/hotspot/delete/:postId').delete(ctrl.deleteHotspotcomment);
        open.route('/hotspot/update/').patch(ctrl.updateHotspotComment);
        open.route('/hotspot/positionUpdate').patch(ctrl.changePositionOfHotspot);
        open.route('/hotspot/actions').get(ctrl.listAllActionType);
        closed.route('/hotspot/flagComment').patch(ctrl.flagComment);
        closed.route('/hotspot/updateAction').patch(ctrl.updateHostspotAction);
        open.route('/hotspot/flaggeditems').get(ctrl.listAllFlagType);
        closed.route('/hotspot/assign').post(ctrl.assignHotspot);
        closed.route('/hotspot/search').get(ctrl.searchUser);
        open.route('/hotspot/dueDate').get(ctrl.dueDateNotification);
    }
}

module.exports = componentOneRoutes()