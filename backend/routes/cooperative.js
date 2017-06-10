const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const Users = require('../models/users');
const Cooperatives = require('../models/cooperatives');
const Log = require('../models').logs;
const { __ } = require('../locale');

router.post('/', auth.authenticate(), (req, res) => {
  const { body } = req;

  Cooperatives.create(body, req.user, (err, cooperative) => {
    if (err) {
      res.status(500).render(
        `/cooperatives${ req.url }`,
        Object.assign({ err: err.message }, body)
      );
    } else {
      res.locals.title = cooperative.name;
      res.render(`/cooperatives/${ cooperative._id }`, cooperative, done => {
        done(null, { cooperatives: [ cooperative.toJSON() ]});
      });
    }
  });

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'create',
    data: body
  });
});

router.get('/consumption/:type/:granularity', (req, res) => {
  const { params: { type, granularity }, query: { from, to }} = req;

  if (req.accepts('html')) {
    res.redirect('/cooperatives');
  } else {
    Cooperatives.getAvgConsumption(type, granularity, from, to, (err, data) => {
      if (err) {
        res.status(400).render('/error', { err: err.message });
      } else {
        res.json(data);
      }
    });

    Log.create({
      userId: req.user && req.user._id,
      category: 'Cooperative',
      type: 'geAvgConsumption',
      data: {
        params: req.params
      }
    });
  }
});

router.get('/:id', isMongoId('id'), (req, res) => {
  const { params: { id }} = req;

  Cooperatives.get(id, (err, cooperative) => {
    if (err) {
      res.status(404).render('/404', { err: err.message });
    } else {
      res.locals.title = cooperative.name;
      res.render(`/cooperatives${ req.url }`, cooperative, done => {
        done(null, {
          cooperatives: [ cooperative.toJSON() ],
          actions: cooperative.actions.map(action => action.toJSON())
        });
      });
    }
  });

  Log.create({
    userId: req.user && req.user._id,
    category: 'Cooperative',
    type: 'get',
    data: {
      cooperativeId: id
    }
  });
});

router.get('/:id/add-action', isMongoId('id'), auth.authenticate(), (req, res) => {
  if (!req.accepts('html')) {
    res.status(406).end();
  } else {
    Cooperatives.get(req.params.id, (err, cooperative) => {
      if (err) {
        res.status(500).render('/error', { err: err.message });
      } else {
        res.locals.title = __('Add action');
        res.render(`/cooperatives/${ cooperative._id }/add-action`, {
          cooperatives: [ cooperative.toJSON() ]
        });
      }
    });
  }

  Log.create({
    userId: req.user._id,
    category: 'Action',
    type: 'add',
    data: {
      cooperativeId: req.params.id
    }
  });
});

router.get('/', (req, res) => {
  Cooperatives.all((err, cooperatives) => {
    if (err) {
      res.status(500).render('/error', { err: err.message });
    } else {
      res.render('/cooperatives', cooperatives, done => {
        done(null, {
          cooperatives: cooperatives.map(cooperative => cooperative.toJSON())
        });
      });
    }
  });

  Log.create({
    userId: req.user && req.user._id,
    category: 'Cooperative',
    type: 'get'
  });
});

router.put('/:id', auth.authenticate(), isMongoId('id'), (req, res) => {
  const { body, params: { id }} = req;

  Cooperatives.update(id, body, (err, cooperative) => {
    if (err) {
      res.status(500).render(`/cooperatives/${ id }`, Object.assign({
        err: err.message
      }, body));
    } else {
      res.locals.title = cooperative.name;
      req.render(`/cooperatives/${ id }`, {
        cooperatives: [ cooperative.toJSON() ],
        actions: cooperative.actions.map(action => action.toJSON())
      });
    }
  });

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'update',
    data: body
  });
});

router.post('/:id/editor', auth.authenticate(), isMongoId('id'), (req, res) => {
  Cooperatives.addEditor(req.params.id, req.user, err => {
    if (err) {
      res.status(500).render('/error', { err: err.message });
    } else {
      res.redirect(`/cooperatives/${ req.params.id }`);
    }
  });

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'addEditor',
    data: {
      cooperativeId: req.params.id,
      editor: req.body
    }
  });
});

router.delete('/:id/editor/:editorId', auth.authenticate(), isMongoId('id', 'editorId'), (req, res) => {
  Users.get(req.params.editorId, (err, user) => {
    Cooperatives.deleteEditor(req.params.id, user, err => {
      if (err) {
        res.status(500).render('/error', { err: err.message });
      } else {
        res.redirect(`/cooperatives/${ req.params.id }`);
      }
    });
  });

  Log.create({
    userId: req.user._id,
    category: 'Cooperative',
    type: 'deleteEditor',
    data: {
      cooperativeId: req.params.id,
      coopEditorId: req.params.coopEditorId
    }
  });
});

router.get('/:id/consumption', isMongoId('id'), (req, res) => {
  const { params: { id }, query } = req;
  const options = Object.assign({ normalized: true }, query);

  options.types = options.types.split(',');

  if (req.accepts('html')) {
    res.redirect(`/cooperatives/${ id }`);
  } else {
    Cooperatives.getConsumption(id, options, (err, consumption) => {
      if (err) {
        res.status(404).render('/404', { err: err.message });
      } else {
        res.render(consumption);

        Log.create({
          userId: req.user && req.user._id,
          category: 'Cooperative',
          type: 'getConsumption',
          data: {
            cooperativeId: id,
            query: query
          }
        });
      }
    });
  }
});

module.exports = router;

function isMongoId(...params) {
  return (req, res, next) => {
    for (let param of params) {
      req.checkParams(param, `Invalid cooperative ${ param }`).isMongoId();
    }

    const err = req.validationErrors();

    if (err) {
      res.status(404).render('/404', err);
    } else {
      next();
    }
  };
}
