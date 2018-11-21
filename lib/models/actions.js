const mongoose = require('mongoose')
const escapeStringRegexp = require('escape-string-regexp')
const Comments = require('./comments')
const assert = require('../assert')

const ActionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  cost: Number,
  contractor: String,
  description: String,
  date: {
    type: Date,
    required: true
  },
  comments: [ Comments.Schema ],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  cooperative: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Cooperative'
  }
})

/**
 * Add a hook that removes action from it's parent cooperative
 */

ActionSchema.pre('remove', function (next) {
  this.model('Cooperative').update({ _id: this.cooperative }, {
    $pull: { actions: this._id }
  }, next)
})

/**
 * Prevent JSON responses from including populated fields
 */

ActionSchema.methods.toJSON = function toJSON () {
  const props = this.toObject()

  props._id = this._id.toString()
  props.cooperative = (props.cooperative._id || props.cooperative).toString()
  props.user = (props.user._id || props.user).toString()
  props.comments = this.comments.map(comment => comment.toJSON())

  return props
}

const Actions = mongoose.model('Action', ActionSchema)

exports.create = async function create (props, user, cooperative) {
  const action = await Actions.create({
    type: props.type,
    date: props.date || Date.now(),
    cost: props.cost,
    description: props.description,
    user: user._id,
    cooperative: cooperative._id,
    comments: []
  })

  cooperative.actions.push(action._id)
  await cooperative.save()
  return action
}

exports.get = async function get (id) {
  const action = await Actions
    .findOne({ _id: id })
    .populate('comments.user')
    .populate('cooperative')
    .populate('user')
    .exec()

  assert(action, 404, 'Action not found')

  return action
}

exports.addComment = async function addComment (id, data, user) {
  const action = await Actions
    .findOne({ _id: id })
    .populate('comments.user')
    .populate('cooperative')
    .populate('user')
    .exec()

  assert(action, 404, 'Action not found')

  action.comments.push(Object.assign({
    user: user._id,
    author: user.profile.name
  }, data))

  await action.save()

  return action
}

exports.getComment = async function getComment (id) {
  const action = await Actions.findOne({ 'comments._id': id })

  assert(action, 404, 'Action not found')

  const comment = action.comments.find(comment => comment._id === id)

  assert(comment, 404, 'Comment not found')

  return comment
}

exports.deleteComment = async function deleteComment (id) {
  const action = await Actions.findOne({ 'comments._id': id })

  assert(action, 404, 'Action not found')

  action.comments.id(id).remove()
  return action.save()
}

exports.update = function update (id, props) {
  return Actions
    .findByIdAndUpdate(id, { $set: props })
    .populate('comments.user')
    .populate('cooperative')
    .populate('user')
    .exec()
}

exports.delete = async function deleteAction (id) {
  const action = await Actions.findById(id)

  assert(action, 404, 'Action not found')

  return action.remove()
}

// Search action by name and tag attached to name
exports.search = function search (str) {
  return Actions.find({
    $or: [{
      name: new RegExp('^' + escapeStringRegexp(str), 'i')
    }]
  })
}

exports.getAll = function getAll (limit) {
  return Actions
    .find({})
    .limit(limit)
    .populate('comments.user')
    .populate('cooperative')
    .populate('user')
    .exec()
}

exports.model = Actions
