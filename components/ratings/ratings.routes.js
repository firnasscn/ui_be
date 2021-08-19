function commentsComponentRoutes() {
    const ctrl = require('./ratings.controller');
    const { routePrefix } = require('../../utils');

    return (open, closed) => {
        closed.route('/ratings/get/:type').get(ctrl.ratings);
        // open.route('/ratings/getAllRatings/:screenId').get(ctrl.getAllCurrentScreenRatings);
        open.route('/ratings/getAllRatings/:screenId').get(ctrl.getAllCurrentFGScreenRatings);
        open.route('/ratings/getMyScreenRatings/:screenId').get(ctrl.getMyScreenRatings);
        // open.route('/ratings/post').post(ctrl.postRating);
        open.route('/ratings/post').post(ctrl.postRatingFG);
        closed.route('/ratings/postProjectScreen').post(ctrl.postProjectRating);
        closed.route('/ratings/edit/:screenId').patch(ctrl.updateRating);
        closed.route('/ratings/delete/:screenId').delete(ctrl.deleteRating);
        open.route('/ratings/listAllRatingsType').get(ctrl.listAllRatingsType);
        open.route('/ratings/listAllRatings').get(ctrl.listOfRatings);
    }
}

module.exports = commentsComponentRoutes();