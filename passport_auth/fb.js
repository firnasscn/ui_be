require("dotenv").config();

const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
// const request = require('request');
const Response = require('../utils/response');
const User = require('../components/user/user.model');
const util = require('util');

passport.use(new FacebookStrategy({
  clientID: '393916924673954',
  clientSecret: '08d7238547d185d49a2701fc58c4247c',
  callbackURL: `${process.env.BASE_URL}v1/auth/fbcallback`,
  profileFields: ['id', 'name', 'gender', 'emails', 'birthday', 'location', 'picture.type(large)']
},
  function (accessToken, refreshToken, profile, done) {

    let data = profile._json;
    let profilePic = profile._json.picture.data.url || "";

    User.findOne({ facebookId: profile.id }, async function (err, user) {
      if (err)
        return done(err);

      if (user)
        return done(null, user);
      else {
        let user = new User({
          facebookId: data.id,
          userName: data.first_name + ' ' + data.last_name,
          firstName: data.first_name.trim(),
          lastName: data.last_name.trim(),
          email: data.email.toLowerCase().trim(),
          gender: data.gender,
          dob: new Date(data.birthday),
          country: data.location.name.split(",")[1].trim(),
          profilePicture: profilePic,
          active: true,
          isVerified: true
        });

        user = await user.save();

        return done(null, user);
      }
    });
  }
));

module.exports = passport;