function commentsComponentRoutes() {
  const ctrl = require('./comments.controller.js');
  const { routePrefix } = require('../../utils');

  return (open, closed) => {
    closed.route('/comments/get/:type').get(ctrl.comments);
    closed.route('/comments/post').post(ctrl.postcomment);
    closed.route('/comments/edit/:commentId').patch(ctrl.updateComment);
    closed.route('/comments/delete/:commentId').delete(ctrl.deleteComment);
    closed.route('/comments/addCommentToScreen').post(ctrl.addCommentToScreen);
    closed.route('/comments/vote').post(ctrl.votingForComments);
  }
}

module.exports = commentsComponentRoutes();
