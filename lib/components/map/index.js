const html = require('choo/html');
const map = require('./map');

module.exports = function (state, emit) {
  let center;
  const { cooperatives, user, geoip } = state;

  if (user.isAuthenticated) {
    const home = cooperatives.find(item => item._id === user.cooperative);
    center = home && { longitude: home.lng, latitude: home.lat };
  }

  if ((!center || geoip.precission === 'exact') && geoip.longitude) {
    center = {
      longitude: geoip.longitude,
      latitude: geoip.latitude,
      isLoading: geoip.isLoading,
      precission: geoip.precission
    };
  }

  if (typeof window !== 'undefined' && !center) {
    emit('geoip:fetch');
  }

  return html`
    <div class="Map u-hiddenNoScript" id="map-container">
      ${ map(state.cooperatives.slice(), center, emit)  }
    </div>
  `;
};
