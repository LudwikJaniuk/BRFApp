const express = require('express')
const auth = require('../middleware/auth')
const Cooperatives = require('../models/cooperatives')
const Log = require('../models/logs')
const assert = require('../assert')
const { __ } = require('../locale')

const router = module.exports = express.Router()

router.get('/', (req, res) => {
  // All traffic to cooperatives root are redirected to site root
  res.redirect('/')
})

router.post('/', auth.authenticate(), (req, res, next) => {
  const { body } = req

  Cooperatives.create(body, req.user).then(cooperative => {
    res.locals.title = cooperative.name
    res.render(`/cooperatives/${cooperative._id}`, cooperative, done => {
      done(null, { cooperatives: [ cooperative.toJSON() ] })
    })
  }, next)

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'create',
    data: body
  })
})

router.get('/:id', isMongoId('id'), (req, res, next) => {
  const { params: { id } } = req

  Cooperatives.get(id).then(cooperative => {
    res.locals.title = cooperative.name
    res.render(`/cooperatives${req.url}`, cooperative, done => {
      done(null, {
        cooperatives: [ cooperative.toJSON() ],
        actions: cooperative.actions.map(action => action.toJSON())
      })
    })
  }, err => {
    next(err)
  })

  Log.create({
    userId: req.user && req.user._id,
    category: 'Cooperative',
    type: 'get',
    data: {
      cooperativeId: id
    }
  })
})

router.get('/:id/add-action', isMongoId('id'), isEditor('id'), (req, res, next) => {
  if (!req.accepts('html')) {
    res.status(406).end()
  } else {
    Cooperatives.get(req.params.id).then(cooperative => {
      res.locals.title = __('Add energy action')
      res.render(`/cooperatives/${cooperative._id}/add-action`, {
        cooperatives: [ cooperative.toJSON() ]
      })
    }, next)
  }

  Log.create({
    userId: req.user._id,
    category: 'Action',
    type: 'add',
    data: {
      cooperativeId: req.params.id
    }
  })
})

router.put('/:id', isMongoId('id'), isEditor('id'), (req, res, next) => {
  const { body, params: { id } } = req

  Cooperatives.update(id, body, req.user).then(cooperative => {
    if (cooperative.needUpdate) {
      res.status(400)

      if (req.accepts('html')) {
        res.redirect(`/cooperatives/${id}/edit`)
      } else {
        res.render({
          error: {
            status: 400,
            message: 'Some information is missing, please review and try again'
          }
        })
      }
    } else {
      res.locals.title = cooperative.name
      res.render(`/cooperatives/${id}`, cooperative, done => {
        done(null, {
          error: !cooperative.needUpdate ? null : {
            status: 417,
            message: 'Some information is missing, please '
          },
          cooperatives: [ cooperative.toJSON() ],
          actions: cooperative.actions.map(action => action.toJSON())
        })
      })
    }
  }, next)

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'update',
    data: body
  })
})

router.get('/:id/edit', isMongoId('id'), isEditor('id'), (req, res, next) => {
  if (!req.accepts('html')) {
    res.status(406).end()
  } else {
    Cooperatives.get(req.params.id).then(cooperative => {
      req.prismic.api.getSingle('registration').then(doc => {
        if (cooperative.hasRegistered) {
          res.locals.title = `${__('Edit')} ${cooperative.name}`
        } else {
          res.locals.title = __('Add cooperative')
        }
        res.locals.content.registration = doc
        res.render(`/cooperatives/${req.params.id}/edit`, {
          cooperatives: [ cooperative.toJSON() ]
        })
      }, next)
    }, next)
  }
})

router.get('/:id/consumption', isMongoId('id'), (req, res, next) => {
  const { params: { id }, query } = req
  const options = Object.assign({
    normalized: query.type === 'heat'
  }, query)

  if (typeof options.normalized === 'string') {
    options.normalized = options.normalized === 'true'
  }

  options.types = options.types.split(',')

  if (req.accepts('html')) {
    res.redirect(`/cooperatives/${id}`)
  } else {
    Cooperatives
      .getConsumption(id, options)
      .then(consumption => res.render(consumption), next)

    Log.create({
      userId: req.user && req.user._id,
      category: 'Cooperative',
      type: 'getConsumption',
      data: {
        cooperativeId: id,
        query: query
      }
    })
  }
})

function isEditor (param) {
  return function (req, res, next) {
    auth.authenticate()(req, res, () => {
      Cooperatives.get(req.params[param]).then(cooperative => {
        const editor = cooperative.editors.find(editor => {
          return editor._id.toString() === req.user._id.toString()
        })

        if (editor) {
          next()
        } else {
          res.status(401).redirect('/auth')
        }
      }, next)
    })
  }
}

function isMongoId (...params) {
  return (req, res, next) => {
    for (let param of params) {
      req.checkParams(param, `Invalid cooperative ${param}`).isMongoId()
    }

    const err = req.validationErrors()
    assert(!err, 404, err.message)

    next()
  }
}
