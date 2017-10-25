const INIT = { credentials: 'include', headers: { accept: 'application/json' }};

module.exports = function user() {
  return (state, emitter) => {
    state.user = state.user || {};

    emitter.on('user:boarded', () => {
      if (state.user.isAuthenticated) {
        fetch(`/users/${ state.user._id }`, Object.assign({
          method: 'PUT',
          body: JSON.stringify({ hasBoarded: true })
        }, INIT, {
          headers: Object.assign({
            'Content-Type': 'application/json'
          }, INIT.headers)
        })).then(response => response.json().then(user => {
          if (!response.ok) { Promise.reject(user); }
          state.user = user;
          emitter.emit('render');
        }).catch(err => {
          state.error = err.message;
          emitter.emit('render');
        }));
      } else {
        state.user.hasBoarded = true;
        document.cookie = 'hasBoarded=true';
        emitter.emit('render');
      }
    });
  };
};
