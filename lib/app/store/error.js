module.exports = function error() {
  return (state, emitter) => {
    state.error = state.error || null;

    emitter.on('error', err => {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error(err.stack);
      }

      state.error = err;

      emitter.emit('render');
    });

    emitter.on(state.events.NAVIGATE, () => {
      state.error = null;
    });

    emitter.on('error:dismiss', () => {
      state.error = null;
      emitter.emit('render');
    });
  };
};
