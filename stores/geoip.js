module.exports = geoip

function geoip (state, emitter) {
  state.geoip = state.geoip || {}
  state.geoip.isLoading = false

  emitter.on('geoip:getPosition', () => {
    state.geoip.isLoading = true
    emitter.emit('render')

    navigator.geolocation.getCurrentPosition(position => {
      state.geoip.ll = [position.coords.latitude, position.coords.longitude]
      state.geoip.isLoading = false
      emitter.emit('render')
    }, err => emitter.emit('error', err))
  })
}
