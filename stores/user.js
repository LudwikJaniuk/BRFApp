const INIT = {
  credentials: 'include',
  headers: { accept: 'application/json' }
}

module.exports = user

function user (state, emitter) {
  state.user = state.user || null
  state.notificationsAmount = -1

  var rerender = () => emitter.emit('render')

  emitter.on('DOMContentLoaded', function () {
    if (state.user) {
      let init = {
        headers: {
          brfauth: state.user.forumAuthenticationToken,
          'Accept': 'application/json',
          'Cache-Control': 'no-store'
        }
      }

      window.fetch(process.env.FORUM_URL + '/api/unread', init)
        .then(resp => resp.json())
        .then(json => {
          state.notificationsAmount = json.topicCount
          rerender()
        })
    }
  })

  emitter.prependListener('navigate', function () {
    if (!state.hasBoarded) emitter.emit('user:boarded')
  })

  emitter.on('user:boarded', () => {
    if (state.user) {
      window.fetch(
        `/users/${state.user._id}`,
        Object.assign(
          {
            method: 'PUT',
            body: JSON.stringify({ hasBoarded: true })
          },
          INIT,
          {
            headers: Object.assign({ 'Content-Type': 'application/json' }, INIT.headers)
          }
        )
      ).then(response => response.json().then(user => {
        if (!response.ok) { return Promise.reject(user) }
        state.hasBoarded = true
        state.user = user
      }).catch(err => {
        state.error = err.message
      })).then(rerender)
    } else {
      state.hasBoarded = true
      const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2)
      document.cookie = `HAS_BOARDED=true; expires=${expires}; path=/`
      rerender()
    }
  })
}
