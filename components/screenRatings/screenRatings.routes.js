function commentsComponentRoutes() {
  const ctrl = require('./screenRatings.controller');
  const { routePrefix } = require('../../utils');

  return (open, closed) => {
    closed.route('/ratingList/getMyScreenRatings/:screenId').get(ctrl.getMyScreenRatings);
    closed.route('/ratingList/post').post(ctrl.postProjectRating);
    open.route('/ratingList/listAllRatingsType').get(ctrl.listAllRatingsType);
    open.route('/ratingList/tags').get(ctrl.listAllRatingsTags);
  }
}

module.exports = commentsComponentRoutes();
