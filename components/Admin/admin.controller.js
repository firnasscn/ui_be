const user = require('../user/user.model');
const Response = require('../../utils/response');
const Joi = require('joi');
const screens = require('../screens/screens.model');

const sanitize = user => {
    //remove sensitive data
  
    user.profilePicture = (!!user.profilePicture) ? `https://d31qgkthzchm5g.cloudfront.net/profilePicture/${user.profilePicture}` : user.profilePicture;
    user.isGoogleUser = (!!user.googleId) ? true : false
    user.isPasswordUpdate = (!!user.password) ? true : false
    user.password = user.salt = user.verifyToken = user.resetToken = user.resetTokenVerfiedTime = user.verfiedTime = user.__v = user.createdAt = user.updatedAt = user.lastLoggedIn = undefined;
  
    return user;
  };
  

function adminController() {
    const methods = {
        login : async (req, res) => {
            try {
                const schema = Joi.object().keys({
                    userName: Joi.string().trim().label('UserName / Email'),
                    password: Joi.string().trim(),
                  }).required().options({ abortEarly: false })
                Joi.validate(req.body, schema, { abortEarly: false }) 
                    .then(validatevalues => {
                        user.findOne(
                            {
                                $or: [
                                    { email: req.body.userName },
                                    { userName: req.body.userName }
                                ]
                            },
                            {
                                $and : [{ isAdmin : true }]
                            },
                            async (err, user) => {
                                if (err) Response.error(res, 400, err);
                                if (user === null) return Response.error(res, 400, "Invalid Username / Email");
                                if (!user.isVerified) return Response.error(res, 400, "Your account is not verified, Please verify your account before login");
                
                                //Verify password
                                let lStrVerifyPassword = user.verifyPassword(req.body.password);
                                if (!lStrVerifyPassword) return Response.badValues(res, "Invalid Password");
                
                                //Generate Token
                                user.lastLoggedIn = Date.now();
                                user = await user.save();
                
                                const { _id, email, userName, lastLoggedIn, isGoogleUser, isPasswordUpdate } = user.toObject(),
                                  tokenData = { _id, email, userName, lastLoggedIn };
                
                                var token = jwt.sign(tokenData, process.env.SUPER_SECRET, {
                                  expiresIn: 60 * 60 * 24
                                });
                
                                user = sanitize(user.toObject())//Remove Sensitive Data
                                // console.log(user)
                                let lObjResponse = {
                                  token: token,
                                  data: user
                                }
                                return Response.success(res, lObjResponse, 'Logged in successfully')
                            }
                        )
                        .catch(validationError => {
                            const errorMessage = validationError.details.map(d => d.message);
                            return Response.badValuesData(res, errorMessage)
                        });
                    })
            } catch (error) {
                console.log(error);
                return Response.badValuesData(error, res);
            }
        },
        projectImageApprove : async (req, res) => {
            try {
                if(req.user.isAdmin == true) {
                    let updateimages = [];
                    let rejectimages = [];
                    let selectedScreens = req.body.screenId;
                    for(let s of selectedScreens) {
                        let checkscreen = await screens.find({ _id : s, isPublish : true, approvedStatus : 'in-review' });
                        if(checkscreen.length > 0) {
                            let updatescreens = await screens.update({ _id : s }, { $set : { approvedStatus : 'approved' }});
                            await updateimages.push(s);
                        } else {
                            await rejectimages.push(s);
                        }
                    }
                    let screen = await {
                        updatedScreens : updateimages,
                        rejectedScreens : rejectimages
                    }
                    return Response.success(res, screen, 'Images Approved Successfully')
                } else {
                    return Response.notAuthorized(res, 'You are not a Admin')
                }
            } catch (err) {
                console.log(err);
                return Response.badValuesData(err, res);
            }
        }
    }
    return Object.freeze(methods);
}
module.exports = adminController();