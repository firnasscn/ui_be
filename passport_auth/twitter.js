require("dotenv").config();

const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const User = require('../components/user/user.model');

// const TwitterTokenStrategy = require('passport-twitter-token');

// passport.use(new TwitterTokenStrategy({
//     consumerKey: "t1cFXSA2Il5Snq0gnzjuQDknX",
//     consumerSecret: "dHnbNDS16CJ6tQx6RLZOOELcYT9ixihTG8cqnpNfmUml82du0I"
//   }, (token, tokenSecret, profile, done) => {
//     // User.findOrCreate({ twitterId: profile.id }, (error, user) => {

//       console.log("token", token);
//       console.log("tokenSecret", tokenSecret);
//       console.log("profile", profile);

//       return done(null, profile);
//     // });
//   }
// ));

passport.use(new TwitterStrategy({
  consumerKey: "t1cFXSA2Il5Snq0gnzjuQDknX",
  consumerSecret: "dHnbNDS16CJ6tQx6RLZOOELcYT9ixihTG8cqnpNfmUml82du0I",
  callbackURL: `${process.env.BASE_URL}v1/auth/twittercallback`,
  includeEmail: true
},
  function (token, tokenSecret, profile, done) {
    try {
      let data = profile._json;
      let profilePic = data.profile_image_url || "";

      User.findOne({ email: data.email.toLowerCase().trim() }, async function (err, user) {
        if (err)
          return done(err);

        if (user)
          return done(null, user);
        else {
          data["name"] = data.name.split(" ");
          if (data.name.length > 1) {
            data.first_name = data.name[0].trim();
            data.last_name = data.name[1].trim();
            data.user_name = data.first_name + ' ' + data.last_name;
          }
          else {
            data.first_name = data.name[0].trim();
            data.user_name = data.first_name;
          }

          let user = new User({
            twitterId: profile.id,
            userName: data.user_name,
            firstName: data.first_name,
            lastName: data.last_name,
            email: data.email.toLowerCase().trim(),
            gender: data["gender"] != undefined ? data.gender.toLowerCase() : "undisclosed",
            dob: data["birthday"] != undefined ? new Date(data.birthday) : null,
            location: data["location"] != undefined ? data.location : null,
            profilePicture: profilePic,
            active: true,
            isVerified: true
          });

          user = await user.save();

          return done(null, user);
        }
      });
    }
    catch (err) {
      console.log(err);
    }
  }
));

module.exports = passport;