const url = require('url')
const got = require('got')
const passport = require('passport')
const basic = require('express-basic-auth')
const OAuth2Strategy = require('passport-oauth2').Strategy
const Users = require('../models/users')
const Log = require('../models/logs')
const Cooperatives = require('../models/cooperatives')
const assert = require('../assert')
const nodebb = require('../nodebb')

/**
 * Extend OAuth2Strategy with an implementation for getting Metry user profile
 */

class MetryOAuth extends OAuth2Strategy {
  userProfile (accessToken, done) {
    getProfile(accessToken).then(profile => {
      if (profile.is_organization) {
        return getUser(accessToken).then(user => done(null, user))
      }
      done(null, profile)
    }).catch(done)
  }
}

exports.initialize = function initialize () {
  /**
   * Set up Metry Oauth authentification
   */

  passport.use('metry', new MetryOAuth({
    authorizationURL: url.resolve(process.env.METRY_ENDPOINT, '/oauth/authorize'),
    tokenURL: url.resolve(process.env.METRY_ENDPOINT, '/oauth/token'),
    clientID: process.env.METRY_CLIENT_ID,
    clientSecret: process.env.METRY_CLIENT_SECRET,
    callbackURL: url.resolve(process.env.BRFENERGI_SERVICE_URL, 'auth/callback'),
    scope: [ 'basic', 'add_to_open_channels', 'write_meter_location' ]
  }, (accessToken, refreshToken, profile, done) => {
    Users.model.findOne({ metryId: profile._id }, async (err, user) => {
      if (err) { return done(err) }

      const options = {
        json: true,
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }

      try {
        /**
         * Add missing user
         */

        if (!user) {
          user = await getLegacyUser(accessToken, profile)
          if (!user) {
            user = await addUser(accessToken, profile)
          }
        }

        // Touch account on forum - don't actually care about the response.
        try {
          await got(process.env.FORUM_URL + '/auth/brf?brfauth=' + nodebb.authenticationToken(user))
        } catch (e) {
          Log.create({
            category: 'User',
            type: 'forum',
            data: 'Error while touching user forum account: ' + e
          })
        }

        /**
         * Fetch cooperative meters
         */

        const meters = await got(url.resolve(
          process.env.METRY_ENDPOINT,
          'meters?box=active'
        ), options).then(response => {
          const { body } = response
          assert(body.code === 200, body.code, body.message)
          return body.data
        })

        /**
         * Check for new or legacy meters
         */

        const cooperative = await Cooperatives.model.findOne(user.cooperative)
        const missing = meters.filter((meter) => {
          return !cooperative.meters.find(({ meterId }) => {
            return meterId === meter._id
          })
        })
        const excess = cooperative.meters.filter(meter => {
          // Allow for an empty meter of type `none`
          return meter.type !== 'none' && !meters.find(({ _id }) => {
            return _id === meter.meterId
          })
        })

        /**
         * Publish new meters to open channel
         */

        if (missing.length) {
          await Promise.all(missing.map(publishMeter(options)))
        }

        /**
         * Add/remove meters on cooperative
         */

        cooperative.meters = cooperative.meters.filter(meter => {
          return !excess.find(({ meterId }) => meter.meterId === meterId)
        }).concat(missing.map(meter => ({
          type: meter.type,
          meterId: meter._id,
          valid: !!meter.location
        })))

        /**
         * Update cooperative coordinates
         */

        if (!cooperative.lat || !cooperative.lng) {
          cooperative.needUpdate = true
          const meter = meters.find(meter => meter.location)
          if (meter) {
            cooperative.lng = meter.location[0]
            cooperative.lat = meter.location[1]
          }
        }

        /**
         * Reflect cooperative coordinates on meters missing location
         */

        if (cooperative.lat && cooperative.lng) {
          const location = [cooperative.lng, cooperative.lat]
          const invalid = cooperative.meters.filter(meter => {
            const source = meters.find((src) => src._id === meter.meterId)
            return !meter.valid && !source.location
          })
          if (invalid.length) await updateLocation(invalid, location, options)
          cooperative.meters.forEach(meter => {
            meter.valid = true
          })
        }

        /**
         * Save all changes made to cooperative
         */

        await cooperative.save()
      } catch (err) {
        return done(err)
      }

      user.accessToken = accessToken
      user.save(done)
    })
  }))

  /**
   * Serialize user data by _id
   */

  passport.serializeUser((user, done) => done(null, user._id))
  passport.deserializeUser((id, done) => Users.model.findById(id, done))

  return passport.initialize()
}

exports.session = function session () {
  return passport.session()
}

/**
 * Wrap authentification handler
 */

exports.authenticate = function authenticate () {
  return function (req, res, next) {
    if (req.isAuthenticated()) {
      next()
    } else {
      res.status(401).redirect('/auth')
    }
  }
}

/**
 * Create basic authentification for test environments
 */

exports.basic = basic({
  users: {
    [process.env.BRFENERGI_USER]: process.env.BRFENERGI_PASS
  },
  challenge: true,
  realm: process.env.BRFENERGI_REALM
})

/**
 * Get legacy user which is identified by organization id
 * @param {String} accessToken
 * @return {Promise}
 */

async function getLegacyUser (accessToken, profile) {
  const organization = await getProfile(accessToken)

  // Lookup user by org id
  const user = await Users.model.findOne({ metryId: organization._id })

  if (user) {
    // Update user with proper profile id
    user.metryId = profile._id
    await Promise.all([
      user.save(),
      Cooperatives.model.findOne({ _id: user.cooperative }).then(cooperative => {
        // Save organization id to cooperative
        cooperative.metryId = organization._id
        return cooperative.save()
      })
    ])
  }

  return user
}

/**
 * Add user and cooperative (if missing)
 *
 * @param {object} data User profile object
 * @returns {Promise}
 */

async function addUser (accessToken, profile) {
  const organization = await getProfile(accessToken)

  let cooperative = await Cooperatives.model.findOne({
    metryId: organization._id
  })

  if (!cooperative) {
    const props = {metryId: organization._id, hasRegistered: false}
    if (organization.name) props.name = organization.name
    cooperative = await Cooperatives.create(props)
  }

  const user = await Users.create({
    metryId: profile._id,
    name: (profile.account || profile).name || '',
    email: (profile.account || profile).username,
    cooperative: cooperative
  })

  cooperative.editors.push(user._id)
  await cooperative.save()

  return user
}

/**
 * Add meter to our open channel for public access
 *
 * @param {object} options HTTP request options
 * @returns {function} Iterator for takinga meter object as argument
 */

function publishMeter (options) {
  return async function (meter) {
    const response = await got(url.resolve(
      process.env.METRY_ENDPOINT,
      `open_channels/${process.env.METRY_OPEN_CHANNEL}/meters`
    ), Object.assign({}, options, { body: { meter_id: meter._id } }))

    const { body } = response
    assert(body.code === 200, body.code, body.message)
  }
}

/**
 * Update cooperative meter location
 *
 * @param {array} meters
 * @param {array} location
 * @param {object} options
 * @return {Promise}
 */

async function updateLocation (meters, location, options) {
  const responses = await Promise.all(meters.map(meter => got(url.resolve(
    process.env.METRY_ENDPOINT,
    `meters/${meter.meterId}`
  ), Object.assign({}, options, { method: 'PUT', body: { location } }))))

  for (let i = 0, len = responses.length, body; i < len; i++) {
    body = responses[i].body
    assert(body.code === 200, body.code, body.message)
  }
}

function getProfile (token) {
  return got(url.resolve(
    process.env.METRY_ENDPOINT,
    `accounts/me?access_token=${token}`
  ), { json: true }).then(response => {
    if (response.body.code !== 200) { throw new Error(response.body.message) }
    return response.body.data
  })
}

function getUser (token) {
  return got(url.resolve(
    process.env.METRY_ENDPOINT,
    `accounts/me/authenticated_collaborator?access_token=${token}`
  ), { json: true }).then(response => {
    if (response.body.code !== 200) { throw new Error(response.body.message) }
    return response.body.data
  })
}
