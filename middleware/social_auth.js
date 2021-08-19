const passportFB = require('../passport_auth/fb');
const passportGP = require('../passport_auth/gp');
const passportTW = require('../passport_auth/twitter');
const Response = require('../utils/response');

module.exports = {
	successCallback: async (req, res) => {
		try {
			let mode = req.params.mode;
			switch (mode) {
				case 'facebook':
					console.log('facebook');
					res.redirect('/v1/auth/facebook');
					break;
				case 'google':
					console.log('google');
					res.redirect('/v1/auth/google');
					break;
				case 'twitter':
					console.log('twitter');
					res.redirect('/v1/auth/twitter');
					break;
			}
			return;
		} catch (err) {
			return Response.errorInternal(err, res);
		}
	},
	twitter: function (req, res, next) {
		passportTW.authenticate('twitter', {
			session: false,
			failureRedirect: '/auth/login',
			failureFlash: true
		}, function (err, user, info) {
			if (err) {
				err = '' + err;
				if (err.indexOf('Failed to find request token in session') != -1)
					return res.redirect('twitter');
				else return Response.error(res, 500, err);
			}
			req.user = user;
			next();
		})(req, res, next);
	},

	facebook: function (req, res, next) {
		passportFB.authenticate('facebook', {
			session: false,
			failureRedirect: '/auth/login'
		}, function (err, user, info) {
			if (err)
				return Response.error(res, 500, err);
			req.user = user;
			next();
		})(req, res, next);
	},

	google: function (req, res, next) {
		console.log(req)
		passportGP.authenticate('google', { session: false }, function (err, user, info) {
			if (err)
				return Response.error(res, 500, err);
			req.user = user;
			next();
		})(req, res, next);
	}
};