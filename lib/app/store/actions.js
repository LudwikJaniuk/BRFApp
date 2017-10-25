const INIT = { credentials: 'include', headers: { accept: 'application/json' }};

module.exports = function actions() {
  return (state, emitter) => {
    state.actions = state.actions || [];

    emitter.on('actions:add', data => {
      if (Array.isArray(data)) {
        state.actions.push(...data);
      } else {
        state.actions.push(data);
      }

      emitter.emit('render');
    });

    emitter.on('actions:fetch', id => {
      if (Array.isArray(id)) {
        Promise.all(id.map(fetchAction)).then(results => {
          emitter.emit('actions:add', results);
        });
      } else {
        fetchAction(id).then(body => emitter.emit('actions:add', body));
      }
    });

    /**
     * Fetch action by id
     * @param  {String} id Unique id for action to fetch
     * @return {Promise}   Resolves to actions data
     */

    function fetchAction(id) {
      return fetch(`/actions/${ id }`, INIT).then(response => {
        return response.json().then(body => {
          if (!response.ok) { return Promise.reject(body); }
          return body;
        });
      }, err => emitter.emit('error', err));
    }
  };
};
