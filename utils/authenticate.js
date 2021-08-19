require('dotenv')
const jwt = require('jsonwebtoken')
const User = require('../components/user/user.model')
const BusinessUser = require('../components/businessPortal/businessUser.model')
const responseMessage = require('./response')
const moment = require('moment');
const FocusGroup = require('../components/focusGroup/focusGroup.model');
const ABtesting = require('../components/ABTesting/abTesting.model');
var passport = require('passport');
const PaymentHistory = require('../components/paymentHistory/paymentHistory.model');
var GoogleTokenStrategy = require('passport-google-token').Strategy;
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('403767931967-02qglvk5ina4ccbbdfsupk75k9j62mea.apps.googleusercontent.com');
// passport.use(new GoogleTokenStrategy({
//     clientID: '37250630186-d8gpbo3588hsltutv1unp05oeftm6nho.apps.googleusercontent.com',
//     clientSecret: 'rjbG_2N7oWRLZnhzmNg46oQz',
// },
//     function (token, tokenSecret, profile, done) {

//         console.log("token", token);
//         console.log("tokenSecret", tokenSecret);
//         console.log("profile", profile);
//         // User.findOrCreate({ googleId: profile.id }, function (err, user) {
//         return done(null, profile);
//         // });
//     }
// ));
module.exports = {
    verifyToken: async(req, res, next) => {
        try {
            let token = req.headers['x-access-token']
            console.log(token)
                // platform 1-web 2-app 
            if (!req.headers['platform'])
                return responseMessage.error(res, 401)

            if (!token)
                return responseMessage.error(res, 401)

            const decoded = await jwt.verify(token, process.env.SUPER_SECRET);
            // console.log(decoded, "decoded")
            let userData = await User.findOne({
                _id: decoded._id,
                email: decoded.email,
                userName: decoded.userName,
                lastLoggedIn: decoded.lastLoggedIn
            }).lean();
            if (userData) {
                // console.log(userData)
                req.user = userData;
                next();
            } else {
                return responseMessage.signout(res)
            }
        } catch (err) {
            return (err.name === "TokenExpiredError") ? responseMessage.signout(res) : responseMessage.errorInternal(err, res)
        }
    },

    verifyBusinessToken: async(req, res, next) => {
        try {
            let token = req.headers['x-access-token']
            console.log(token)
                // platform 1-web 2-app 
            if (!req.headers['platform'])
                return responseMessage.error(res, 401)

            if (!token)
                return responseMessage.error(res, 401, 'You are not authorized')

            const decoded = await jwt.verify(token, process.env.SUPER_SECRET);
            // console.log(decoded, "decoded")
            let userData = await BusinessUser.findOne({
                _id: decoded._id,
                email: decoded.email,
                userName: decoded.userName,
                lastLoggedIn: decoded.lastLoggedIn
            }).lean();
            if (userData) {
                // console.log(userData)
                req.user = userData;
                next();
            } else {
                return responseMessage.signout(res)
            }
        } catch (err) {
            return (err.name === "TokenExpiredError") ? responseMessage.signout(res) : responseMessage.errorInternal(err, res)
        }
    },
    verify: async(tokenId, googleId) => {
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: '403767931967-02qglvk5ina4ccbbdfsupk75k9j62mea.apps.googleusercontent.com',
        });
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        if (googleId == userid) {
            return true;
        } else {
            return responseMessage.notFound(res, "Google Authentication Failed from server side!!")
        }

    },
    verifyAnonymousToken: async(token) => {
        try {
            const decoded = await jwt.verify(token, process.env.SUPER_SECRET);
            let returnData = {
                status: true,
                msg: decoded
            }
            return returnData;
        } catch (err) {
            let returnObj = {
                status: false,
                msg: (err.name === "TokenExpiredError") ? "Session Expired. Please Log in again" : err
            }
            return returnObj
        }
    },
    verifyAcceptToken: async(token) => {
        const decoded = jwt.verify(token, process.env.SUPER_SECRET)
        if (decoded) return decoded;
        else return ResresponseMessageponse.error(res, 400, err);
    },
    checkLimit: async(userId, type, res) => {
        try {
            var startOfMonth = moment().startOf('month').format('YYYY-MM-DD hh:mm');
            var endOfMonth = moment().endOf('month').format('YYYY-MM-DD hh:mm');
            let checkPayment = await PaymentHistory.find({ userId: userId }).lean()
            if (checkPayment.length > 0) {
                var presentDate = moment()
                var expiryDate = moment(checkPayment[0].expiryDate)
                var diff = expiryDate.diff(presentDate, 'days')
                if (diff >= 0) {
                    return true
                } else {
                    startOfMonth = expiryDate.format('YYYY-MM-DD hh:mm')
                }
            }

            let count
            if (type == 'FG') {
                count = await FocusGroup.count({
                    createdUser: userId,
                    createdAt: {
                        $gte: startOfMonth,
                        $lt: endOfMonth
                    }
                })

            } else {
                count = await ABtesting.count({
                    createdUser: userId,
                    createdAt: {
                        $gte: startOfMonth,
                        $lt: endOfMonth
                    }
                })
            }
            if (count < 20) {
                return true;
            } else {
                //return responseMessage.notAuthorized(res, "You have crossed your limit to create a group!!")
                return false
            }
        } catch (error) {
            console.log(error)
        }
    }

}