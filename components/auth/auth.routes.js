function componentOneRoutes() {
  const ctrl = require('./auth.controller')

  return (open, closed) => {
    open.route('/auth/signup').all(ctrl.checkEmailExist).post(ctrl.signUp)
    open.route('/auth/resendEmailVerification').post(ctrl.resendVerificationToken)
    open.route('/auth/verifyEmailToken').get(ctrl.verifyEmailToken)
    open.route('/auth/forgotPassword').post(ctrl.forgotPassword)
    open.route('/auth/passwordReset').post(ctrl.verifyResetPasswordToken)
    open.route('/auth/passwordReset').post(ctrl.resetPassword)
    open.route('/auth/login').post(ctrl.login)
    open.route('/auth/getUserDetails').post(ctrl.getUserDetailsByName)
    open.route('/auth/googleCallback').post(ctrl.socialSignInCallback);
    open.route('/auth/checkUserNameExist').post(ctrl.checkUserName)
  }
}

module.exports = componentOneRoutes()
