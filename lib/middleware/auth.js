const url = require('url')
const got = require('got')
const passport = require('passport')
const basic = require('express-basic-auth')
const OAuth2Strategy = require('passport-oauth2').Strategy
const Users = require('../models/users')
const Cooperatives = require('../models/cooperatives')
const assert = require('../assert')

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
      if (err) return done(err)

      try {
        // Add missing user
        if (!user) {
          user = await getLegacyUser(accessToken, profile)
          if (!user) {
            user = await addUser(accessToken, profile)
          }
        }

        await Cooperatives.sync(user.cooperative, accessToken)
      } catch (err) {
        return done(err)
      }

      user.refreshToken = refreshToken
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
 * Fetch a new access token usgin given refresh token
 * @param {String} refreshToken
 * @return {Promise}
 */

exports.refresh = function refresh (refreshToken) {
  return got(url.resolve(process.env.METRY_ENDPOINT, '/oauth/token'), {
    json: true,
    body: {
      client_id: process.env.METRY_CLIENT_ID,
      client_secret: process.env.METRY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      scope: [ 'basic', 'add_to_open_channels', 'write_meter_location' ].join(' '),
      refresh_token: refreshToken
    }
  }).then((response) => {
    assert(response.statusCode === 200, response.statusCode, response.statusMessage)
    return response.body.access_token
  })
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
