const url = require('url');
const got = require('got');
const passport = require('passport');
const basic = require('express-basic-auth');
const OAuth2Strategy = require('passport-oauth2').Strategy;
const Users = require('../models/users');
const Cooperatives = require('../models/cooperatives');
const assert = require('../assert');

const ENDPOINT = url.parse(process.env.METRY_ENDPOINT_URL);
const {
  METRY_BASE_URL,
  METRY_PATH_AUTHORIZE,
  METRY_PATH_TOKEN,
  METRY_CLIENT_ID,
  METRY_OPEN_CHANNEL,
  METRY_CLIENT_SECRET,
  METRY_PROFILE_PATH,
  METRY_PATH_METERS,
  BRFENERGI_SERVICE_URL
} = process.env;

/**
 * Extend OAuth2Strategy with an implementation for getting Metry user profile
 */

class MetryOAuth extends OAuth2Strategy {
  userProfile(accessToken, done) {
    got(url.format(Object.assign({}, ENDPOINT, {
      pathname: url.resolve(ENDPOINT.pathname, METRY_PROFILE_PATH),
      query: { access_token: accessToken }
    })), { json: true }).then(response => {
      if (response.body.code !== 200) {
        return done(new Error(response.body.message));
      }
      done(null, response.body.data);
    }, done);
  }
}

exports.initialize = function initialize() {

  /**
   * Set up Metry Oauth authentification
   */

  passport.use('metry', new MetryOAuth({
    authorizationURL: url.resolve(METRY_BASE_URL, METRY_PATH_AUTHORIZE),
    tokenURL: url.resolve(METRY_BASE_URL, METRY_PATH_TOKEN),
    clientID: METRY_CLIENT_ID,
    clientSecret: METRY_CLIENT_SECRET,
    callbackURL: url.resolve(BRFENERGI_SERVICE_URL, 'auth/callback'),
    scope: [ 'basic', 'add_to_open_channels' ]
  }, (accessToken, refreshToken, data, done) => {
    Users.model.findOne({ metryId: data._id }, async (err, user) => {
      if (err) { return done(err); }

      const options = {
        json: true,
        headers: { 'Authorization': `Bearer ${ accessToken }` }
      };

      try {

        /**
         * Add missing user
         */

        if (!user) {
          throw new Error('Could not find user');
        }

        /**
         * Fetch cooperative meters
         */

        const meters = await got(url.format(Object.assign({}, ENDPOINT, {
          pathname: url.resolve(ENDPOINT.pathname, METRY_PATH_METERS),
          query: { box: 'active' }
        })), options).then(response => {
          const { body } = response;
          assert(body.code === 200, body.code, body.message);
          return body.data;
        });

        /**
         * Check for new or legacy meters
         */

        const cooperative = await Cooperatives.model.findOne(user.cooperative);
        const missing = meters.filter((meter) => {
          return !cooperative.meters.find(({ meterId }) => {
            return meterId === meter._id;
          });
        });
        const excess = cooperative.meters.filter(meter => {
          // Allow for an empty meter of type `none`
          return meter.type !== 'none' && !meters.find(({ _id }) => {
            return _id === meter.meterId;
          });
        });

        /**
         * Update meters
         */

        if (missing.length) {
          await Promise.all(missing.map(addMeter(options)));
        }

        if (missing.length || excess.length) {
          updateMeters(cooperative, missing, excess);
        }

        /**
         * Read missing location from meters
         */

        if (!cooperative.lng || !cooperative.lat && meters.length) {
          const meter = meters.find(meter => meter.location);

          if (meter) {
            cooperative.lng = meter.location[0];
            cooperative.lat = meter.location[1];
          }
        }

        /**
         * Mark cooperative as needing an update if all meters are invalid
         */

        if (!cooperative.meters.find(meter => meter.valid) && meters.length) {
          cooperative.needUpdate = true;
        }

        /**
         * Save all changes made to cooperative
         */

        await cooperative.save();
      } catch (err) {
        return done(err);
      }

      user.accessToken = accessToken;
      user.save(done);
    });
  }));

  /**
   * Serialize user data by _id
   */

  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser((id, done) => Users.model.findById(id, done));

  return passport.initialize();
};

exports.session = function session() {
  return passport.session();
};

/**
 * Wrap authentification handler
 */

exports.authenticate = function authenticate() {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      next();
    } else {
      res.status(401).redirect('/auth');
    }
  };
};

/**
 * Create basic authentification for test environments
 */

exports.basic = basic({
  users: {
    [process.env.BRFENERGI_USER]: process.env.BRFENERGI_PASS
  },
  challenge: true,
  realm: process.env.BRFENERGI_REALM
});

/**
 * Add user and cooperative (if missing)
 *
 * @param {object} data User profile object
 * @returns {Promise}
 */

async function addUser(data) {
  let cooperative = await Cooperatives.model.findOne({
    metryId: data.organization._id
  });

  if (!cooperative) {
    cooperative = await Cooperatives.create({
      name: data.organization.name,
      metryId: data.organization._id,
      hasRegistered: false
    });
  }

  const user = await Users.create({
    email: data.account.username,
    metryId: data.account._id,
    cooperative: cooperative,
    name: data.account.name
  });

  cooperative.editors.push(user._id);
  await cooperative.save();

  return user;
}

/**
 * Add meter to our open channel for public access
 *
 * @param {object} options HTTP request options
 * @returns {function} Iterator for takinga meter object as argument
 */

function addMeter(options) {
  return async function (meter) {
    const response = await got(url.resolve(
      process.env.METRY_ENDPOINT_URL,
      `open_channels/${ METRY_OPEN_CHANNEL }/meters`
    ), Object.assign({}, options, { body: { meter_id: meter._id }}));

    const { body } = response;
    assert(body.code === 200, body.code, body.message);
  };
}

/**
 * Update meters on given cooperative
 *
 * @param {Cooperative} cooperative
 * @param {array} add
 * @param {array} remove
 * @returns {Promise}
 */

function updateMeters(cooperative, add = [], remove = []) {
  cooperative.meters = cooperative.meters.filter(meter => {
    return !remove.find(({ meterId }) => meter.meterId === meterId);
  }).concat(add.map(meter => ({
    type: meter.type,
    meterId: meter._id,
    valid: !!meter.location
  })));
}
