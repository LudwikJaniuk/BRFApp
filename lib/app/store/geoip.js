module.exports = function geoip (ip) {
  return (state, emitter) => {
    state.geoip = {
      ip: ip,
      isLoading: false
    }

    emitter.on('geoip:fetch', () => {
      if (state.geoip.isLoading) return
      state.geoip.isLoading = true

      window.fetch('//api.ipify.org?format=json')
        .then(body => body.json())
        .then(resp => window.fetch(`//freegeoip.net/json/${resp.ip}`))
        .then(body => body.json())
        .then(data => {
          Object.assign(state.geoip, data, {
            isLoading: false,
            precision: 'city'
          })
          emitter.emit('render')
        }, err => {
          state.geoip.isLoading = false
          emitter.emit('error', err)
        })
    })

    emitter.on('geoip:getPosition', () => {
      state.geoip.isLoading = true
      emitter.emit('render')

      navigator.geolocation.getCurrentPosition(position => {
        state.geoip.latitude = position.coords.latitude
        state.geoip.longitude = position.coords.longitude
        state.geoip.precision = 'exact'
        state.geoip.isLoading = false

        emitter.emit('render')
      }, err => emitter.emit('error', err))
    })
  }
}
