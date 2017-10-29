const url = require('url');
const express = require('express');
const passport = require('passport');
const auth = require('../middleware/auth');
const Log = require('../models/logs');

const router = express.Router();

router.get('/', (req, res, next) => {
  if (!req.user) {
    if (req.accepts('html')) {
      req.prismic.api.getSingle('sign-in').then(doc => {
        res.locals.title = doc.getStructuredText('sign-in.title').asText();
        res.locals.content['sign-in'] = doc;
        res.render('/auth');
      }, next);

      Log.create({
        category: 'Auth',
        type: 'get'
      });
    } else {
      res.status(406).end();
    }
  } else {
    res.redirect(`/cooperatives/${ req.user.cooperative }`);
  }
});

/**
 * Redirect to Metry OAuth
 */

router.get('/metry', passport.authenticate('metry', {
  failureRedirect: '/auth'
}));

/**
 * Handle Metry callback redirect
 */

router.get('/callback', (req, res, next) => {
  passport.authenticate('metry', (err, user) => {
    if (err) {
      res.redirect(url.format({
        pathname: '/auth',
        query: { error: 'METRY_ERROR' }
      }));

      Log.create({
        category: 'Error',
        type: 'auth',
        data: err.message
      });
    } else {
      req.logIn(user, err => {
        if (err) { return next(err); }
        res.redirect(`/cooperatives/${ user.cooperative }`);
      });
    }
  })(req, res, next);
});

/**
 * Sign out
 */

router.get('/signout', auth.authenticate(), (req, res) => {
  req.logout();
  res.redirect('/');
});

/**
 * Sign up
 */

router.get('/signup', (req, res) => {
  res.redirect(url.resolve(
    process.env.METRY_ENDPOINT,
    `/id/register/brf?${ [
      'response_type=code',
      `redirect_uri=${ url.resolve(
        process.env.BRFENERGI_SERVICE_URL,
        'auth/callback'
      ) }`,
      'scope=basic%20add_to_open_channels',
      `client_id=${process.env.METRY_CLIENT_ID}`
    ].join('&') }`
  ));
});

module.exports = router;
