const url = require('url')
const got = require('got')
const mongoose = require('mongoose')
const assert = require('../assert')

const LEGACY_PROPS = [
  'achievements',
  'actions',
  'cooperativeId',
  'hash',
  'numFeedback',
  'production',
  'salt',
  'testbed',
  'token'
]

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  metryId: {
    type: String,
    requried: true
  },
  hasBoarded: {
    type: Boolean,
    defaul: false // This is a misspelling, but fixing it leads to crashes. Feel free to try.
  },
  isAdmin: Boolean,
  accessToken: String,
  refreshToken: String,
  forumAuthenticationToken: String,
  profile: {
    name: String,
    language: {
      type: String,
      default: 'sv'
    }
  },
  cooperative: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cooperative',
    required: true
  }
})

/**
 * Prevent JSON responses from including populated fields
 */

UserSchema.methods.toJSON = function toJSON () {
  const props = this.toObject()

  for (let prop of LEGACY_PROPS) {
    delete props[prop]
  }

  // delete props.metryId // I don't think this is a security problem // LJ
  delete props.accessToken
  props._id = this._id.toString()
  props.cooperative = (props.cooperative._id || props.cooperative).toString()

  return props
}

const User = mongoose.model('User', UserSchema)

exports.create = function create (props) {
  const { cooperative } = props

  return User.create({
    email: props.email,
    metryId: props.metryId,
    profile: {
      name: props.name,
      language: props.lang
    },
    cooperative: cooperative._id || cooperative
  })
}

exports.update = async function update (id, props) {
  const user = await User.findOne({ _id: id })

  assert(user, 404, 'User not found')

  Object.assign(user, props)
  await user.save()
  return user
}

exports.get = function get (id) {
  return User
    .findOne({ _id: id })
    .populate('cooperative')
    .exec()
}

exports.refresh = async function (id) {
  const user = await User.findOne({ _id: id })

  assert(user.refreshToken, 400, 'Could not find a refresh token')

  const endpoint = url.resolve(process.env.METRY_ENDPOINT, '/oauth/token')
  const response = await got(endpoint, {
    json: true,
    body: {
      client_id: process.env.METRY_CLIENT_ID,
      client_secret: process.env.METRY_CLIENT_SECRET,
      grant_type: 'refresh_token',
      scope: [ 'basic', 'add_to_open_channels', 'write_meter_location' ].join(' '),
      refresh_token: user.refreshToken
    }
  })

  assert(response.statusCode === 200, response.statusCode, response.statusMessage)

  const accessToken = response.body.access_token
  user.accessToken = accessToken
  await user.save()
  return accessToken
}

exports.model = User
