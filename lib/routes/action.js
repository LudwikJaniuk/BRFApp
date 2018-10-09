const express = require('express')
const got = require('got')
const auth = require('../middleware/auth')
const nodebb = require('../nodebb')
const Actions = require('../models/actions')
const Cooperatives = require('../models/cooperatives')
const Log = require('../models/logs')
const assert = require('../assert')
const { __ } = require('../locale')

const router = module.exports = express.Router()

router.post('/:id/comments', isMongoId('id'), auth.authenticate(), (req, res, next) => {
  Actions.addComment(req.params.id, req.body, req.user).then(comment => {
    if (req.accepts('html')) {
      res.redirect(`/actions/${req.params.id}`)
    } else {
      res.render(comment)
    }
  }, next)

  Log.create({
    userId: req.user._id,
    category: 'Action Comments',
    type: 'create',
    data: req.body
  })
})

router.get('/:id/comments', isMongoId('id'), (req, res, next) => {
  if (req.accepts('html')) {
    res.redirect(`/actions/${req.params.id}`)
  } else {
    Actions
      .get(req.params.id)
      .then(action => res.render(action.comments), next)

    Log.create({
      userId: req.user && req.user._id,
      category: 'Action Comments',
      type: 'all',
      data: {
        actionId: req.params.id
      }
    })
  }
})

router.get('/:id/comments/:commentId', isMongoId('id', 'commentId'), (req, res, next) => {
  if (req.accepts('html')) {
    res.redirect(`/actions/${req.params.id}`)
  } else {
    Actions
      .getComment(req.params.commentId)
      .then(comment => res.render(comment), next)

    Log.create({
      userId: req.user && req.user._id,
      category: 'Action Comments',
      type: 'get',
      data: {
        actionId: req.params.id,
        commentId: req.params.commentId
      }
    })
  }
})

router.delete('/:id/comments/:commentId', isMongoId('id', 'commentId'), isEditor('id'), (req, res, next) => {
  Actions.deleteComment(req.params.commentId).then(() => {
    if (req.accepts('html')) {
      res.redirect(`/actions/${req.params.id}`)
    } else {
      res.redirect(`/actions/${req.params.id}/comments`)
    }
  }, next)

  Log.create({
    userId: req.user._id,
    category: 'Action Comments',
    type: 'delete',
    data: req.params
  })
})

async function postNewActionToForum (action, user) {
  console.log('Posting the new action to forum!')
  Log.create({
    userId: user._id,
    category: 'Forum',
    type: 'postAction',
    data: action
  })
  return nodebb.postEnergyAction(action, user)
}

async function createAction (req, res) {
  var cooperative = await Cooperatives.get(req.body.cooperative)
  const editor = cooperative.editors.find(item => item._id.toString() === req.user._id.toString())

  if (!editor) {
    res.status(401).redirect('/auth')
    return
  }

  var action = await Actions.create(req.body, req.user, cooperative)

  postNewActionToForum(action, req.user).catch(console.log)

  if (!req.accepts('html')) res.status(200).send(action.toJSON())
  else res.redirect(`/cooperatives/${cooperative._id}`)
}

router.post('/', auth.authenticate(), (req, res, next) => {
  req.checkBody('cooperative').isMongoId()
  req.checkBody('date').isDate()

  const err = req.validationErrors()

  if (err) {
    const error = new Error('Some information is missing, please review and try again')
    error.status = 400
    next(error)
  } else {
    createAction(req, res).catch(next)
  }

  Log.create({
    userId: req.user._id,
    category: 'Action',
    type: 'create',
    data: req.body
  })
})

router.put('/:id', isMongoId('id'), isEditor('id'), (req, res, next) => {
  const { body, params: { id } } = req

  Actions.update(id, body).then(() => {
    Actions.get(id).then(action => {
      res.locals.title = __(`ACTION_TYPE_${action.type}`)
      res.render(`/actions/${id}`, action, done => {
        done(null, {
          cooperatives: [ action.cooperative.toJSON() ],
          actions: [ action.toJSON() ]
        })
      })
    }, next)
  }, err => {
    res.status(500).render(`/actions/${id}`, Object.assign({
      error: err.message
    }, body))
  })

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'updateAction',
    data: {
      actionId: id,
      action: body
    }
  })
})

router.get('/:id', isMongoId('id'), (req, res, next) => {
  Actions.get(req.params.id).then(action => {
    res.locals.title = __(`ACTION_TYPE_${action.type}`)
    res.render(`/actions${req.url}`, action, done => {
      done(null, {
        cooperatives: [ action.cooperative.toJSON() ],
        actions: [ action.toJSON() ]
      })
    })
  }, next)

  Log.create({
    userId: req.user && req.user._id,
    category: 'Action',
    type: 'get',
    data: {
      actionId: req.params.id
    }
  })
})

router.get('/:id/edit', isMongoId('id'), isEditor('id'), (req, res, next) => {
  if (!req.accepts('html')) {
    res.redirect(`/actions/${req.params.id}`)
  } else {
    Actions.get(req.params.id).then(action => {
      res.locals.title = action.name
      res.render(`/actions/${req.params.id}/edit`, action, done => {
        done(null, {
          cooperatives: [ action.cooperative.toJSON() ],
          actions: [ action.toJSON() ]
        })
      })
    }, next)

    Log.create({
      userId: req.user._id,
      category: 'Action',
      type: 'edit',
      data: {
        actionId: req.params.id
      }
    })
  }
})

router.delete('/:id', isMongoId('id'), isEditor('id'), (req, res, next) => {
  Actions.get(req.params.id).then(action => {
    Actions.delete(req.params.id).then(() => {
      res.redirect(`/cooperatives/${action.cooperative._id}`)
    }, next)
  }, next)

  Log.create({
    userId: req.user._id,
    category: 'Action',
    type: 'delete',
    data: {
      actionId: req.params.id
    }
  })
})

router.get('/', function (req, res, next) {
  Actions.getAll(req.query.limit).then(actions => {
    res.locals.title = __('Energy actions')
    res.render('/actions', actions, done => {
      done(null, { actions: actions.map(action => action.toJSON()) })
    })
  }, next)

  Log.create({
    userId: req.user && req.user._id,
    category: 'Action',
    type: 'all',
    data: req.body
  })
})

router.get('/search', (req, res, next) => {
  Actions.search(req.query.q).then(actions => res.render(actions), next)

  Log.create({
    userId: req.user && req.user._id,
    category: 'Action',
    type: 'search',
    data: req.query
  })
})

function isEditor (param) {
  return function (req, res, next) {
    auth.authenticate()(req, res, () => {
      Actions.get(req.params[param]).then(action => {
        return Cooperatives.get(action.cooperative._id).then(cooperative => {
          const editor = cooperative.editors.find(editor => {
            return editor._id.toString() === req.user._id.toString()
          })

          if (editor) {
            next()
          } else {
            res.status(401).redirect('/auth')
          }
        })
      }).catch(next)
    })
  }
}

function isMongoId (...params) {
  return (req, res, next) => {
    for (let param of params) {
      req.checkParams(param, `Invalid ${param}`).isMongoId()
    }

    const err = req.validationErrors()
    assert(!err, 404, err.message)

    next()
  }
}
