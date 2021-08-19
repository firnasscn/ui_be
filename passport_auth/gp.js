require("dotenv").config();

var passport = require('passport');
var GoogleStrategy = require('passport-google-oauth2').Strategy;

// Use the GoogleStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Google profile), and
//   invoke a callback with a user object.
passport.use(new GoogleStrategy({
  clientID: '37250630186-d8gpbo3588hsltutv1unp05oeftm6nho.apps.googleusercontent.com',
  clientSecret: 'rjbG_2N7oWRLZnhzmNg46oQz',
  callbackURL: 'http://localhost:2005/v1/auth/googlecallback',
},
  function (token, tokenSecret, profile, done) {

    console.log("token", token);
    console.log("tokenSecret", tokenSecret);
    console.log("profile", profile);
    // User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return done(null, profile);
    // });
  }
));

module.exports = passport;