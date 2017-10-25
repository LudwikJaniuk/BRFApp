const geoip = require('./geoip');
const chart = require('./chart');
const content = require('./content');
const error = require('./error');
const user = require('./user');
const actions = require('./actions');
const cooperatives = require('./cooperatives');
const consumptions = require('./consumptions');
const tracking = require('./tracking');

module.exports = function () {
  return function (state, emitter) {
    emitter.on(state.events.PUSHSTATE, onnavigate);
    emitter.on(state.events.REPLACESTATE, onnavigate);

    /**
     * Initialize all state models with their respective initial state
     */

    [
      geoip(),
      chart(),
      content(),
      error(),
      user(),
      actions(),
      cooperatives(),
      consumptions(),
      tracking()
    ].forEach(model => model(state, emitter));

    function onnavigate() {
      // Scroll to top on navigate
      if (!location.hash) {
        document.body.scrollIntoView(true);
      }
    }
  };
};
