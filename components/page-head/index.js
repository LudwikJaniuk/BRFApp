const html = require('choo/html')
const pick = require('lodash.pick')
const Component = require('choo/component')
const asElement = require('prismic-element')
const { asText } = require('prismic-richtext')
const logo = require('./logo')
const menu = require('../menu')
const modal = require('../modal')
const { __ } = require('../../lib/locale')
const { follow } = require('../base')
const resolve = require('../../lib/resolve')
const { loader, chevron } = require('../icons')

module.exports = class PageHead extends Component {
  constructor (id, state, emit) {
    super(id)
    this.state = state
    this.emit = emit
    this.href = null
    this.modal = null
    this.isExpanded = false
    this.allowRender = true // Forum notifications are dynamic, so rerender might be needed.
  }

  update () {
    if (this.modal) {
      modal.render(this.modal(), () => {
        this.modal = null
      })
    }

    /**
     * Close menu drop down on navigate
     */

    if (this.state.href !== this.href) {
      this.isExpanded = false
      return true
    }

    return this.allowRender
  }

  createElement () {
    this.href = this.state.href
    this.allowRender = true // For forum notifications

    const user = this.state.user
    const toggle = open => event => {
      this.isExpanded = open
      this.rerender()
      event.preventDefault()
    }

    const signin = () => {
      const doc = this.state.content['sign-in']

      if (!doc) {
        this.emit('content:fetch', 'sign-in')
        return popup()
      }

      return popup({
        title: asText(doc.data.title),
        body: asElement(doc.data.body),
        links: [{
          href: resolve('/auth/sign-up'),
          text: __('Create an account'),
          secondary: true,
          onclick: event => {
            this.modal = signup
            modal.render(this.modal(), () => {
              this.modal = null
            })
            event.preventDefault()
          }
        }, {
          href: resolve('/auth/metry'),
          onclick: follow,
          text: __('Sign in with Metry')
        }]
      })
    }

    const signup = () => {
      const doc = this.state.content.registration

      if (!doc) {
        this.emit('content:fetch', 'registration')
        return popup()
      }

      return popup({
        title: asText(doc.data.disclaimer_title),
        body: asElement(doc.data.disclaimer_body),
        links: [{
          href: resolve('/auth/metry/sign-up'),
          onclick: follow,
          text: __('Create an account')
        }]
      })
    }

    const pages = {
      home: state => state.user && ({
        href: resolve(`/cooperatives/${state.user.cooperative}`),
        title: state.cooperatives.find(props => {
          return props._id === state.user.cooperative
        }).name
      }),
      about: () => ({
        href: resolve('/about-the-project'),
        title: __('About Brf Energi')
      }),
      faq: () => ({
        href: resolve('/how-it-works'),
        title: __('How it works')
      }),
      auth: (state, emit) => ({
        href: resolve(state.user ? '/auth/signout' : '/auth'),
        title: state.user ? __('Sign out') : __('Sign in'),
        onclick: event => {
          if (state.user) {
            window.location.assign(resolve('/auth/signout'))
          } else {
            this.isExpanded = false
            this.modal = signin

            modal.render(this.modal(), () => {
              this.modal = null
            })
          }

          event.preventDefault()
        }
      }),
      tracking: (state, emit) => {
        if (!state.user) return null
        if (!state.user.isAdmin) return null
        const next = state.tracking.enabled ? 'off' : 'on'
        return {
          href: `/tracking${next}?referrer=${encodeURIComponent(state.href)}`,
          title: __(`${state.tracking.enabled ? 'Disable' : 'Enable'} tracking`),
          onclick: (event) => {
            emit('track:toggle', !state.tracking.enabled)
            this.isExpanded = false
            this.rerender()
            event.preventDefault()
          }
        }
      },
      forum: (state) => {
        let numNotifs = state.notificationsAmount
        var notificationString = (state.user && numNotifs > 0)
          ? ' (' + numNotifs + ')'
          : ''
        return {
          href: process.env.FORUM_URL + (state.user
            ? '/auth/brf?brfauth=' + state.user.forumAuthenticationToken
            : '/authmetryifneeded'),
          title: __('Forum') + notificationString
        }
      }
    }

    var visiblePageNames = ['home', 'about', 'faq', 'auth', 'tracking']
    var mediumHorizontalPageNames = ['faq', 'about']
    if (this.state.betatest) {
      [visiblePageNames, mediumHorizontalPageNames].forEach(ns => ns.splice(0, 0, 'forum'))
    }
    var mediumDropdownPageNames = ['home', 'auth', 'tracking']

    return html`
      <div class="PageHead">
        <a href=${resolve('/')} class="PageHead-title">
          ${logo()} Brf Energi
        </a>
        <nav class="PageHead-navigation">

          <!-- Small viewport: drop down menu list -->
          <div id="page-menu-sm" class="PageHead-menu u-md-hidden u-lg-hidden ${this.isExpanded ? 'is-open' : ''}">
            ${menu(Object.values(pick(pages, visiblePageNames)).map(page => page(this.state, this.emit)).filter(Boolean))}
          </div>

          <!-- Medium & large viewport: drop down menu list -->
          ${user ? html`
            <div id="page-menu-lg" class="PageHead-menu u-hidden u-md-block u-lg-block ${this.isExpanded ? 'is-open' : ''}">
              ${menu(Object.values(pick(pages, mediumDropdownPageNames)).map(page => page(this.state, this.emit)).filter(Boolean))}
            </div>
          ` : null}

          <!-- Medium & large viewport: horizontal menu list -->
          <ul class="u-hidden u-md-block u-lg-block">
            <!-- 'forum' can also be added to show a link to the forum -->
            ${Object.values(pick(pages, mediumHorizontalPageNames)).map(page => {
              const props = page(this.state, this.emit)
              return html`
                <li class="PageHead-item">
                  <a href=${props.href} class="PageHead-link">${props.title}</a>
                </li>
              `
            })}
          </ul>

          <!-- Small viewport: open drop down menu -->
          <a href="#page-menu-sm" onclick=${toggle(true)} class="PageHead-trigger PageHead-trigger--small PageHead-link">
            ${__('Menu')} ${chevron('down')}
          </a>

          <!-- Medium & large viewport: open drop down menu -->
          ${user
            // Render user menu anchor link
            ? html`
              <a href="#page-menu-lg" onclick=${toggle(true)} class="PageHead-trigger PageHead-trigger--large PageHead-link">
                ${__('Menu')} ${chevron('down')}
              </a>
            `
            // Render sign in link
            : (function (props) {
              return html`
                <a href=${props.href} class="PageHead-link PageHead-trigger PageHead-trigger--large" onclick=${props.onclick}>
                  ${props.title}
                </a>
              `
            }(pages.auth(this.state, this.emit)))
          }

          <!-- All viewports: close drop down menu -->
          <a href="#page-head" onclick=${toggle(false)} class="PageHead-untrigger PageHead-link" hidden data-title-small=${__('Close') + ' '} data-title-large=${(user ? __('Menu') : __('Close')) + ' '}>
            ${chevron('up')}
          </a>
        </nav>
      </div>
    `
  }
}

function popup (props) {
  if (props) {
    return html`
      <div class="u-flex u-flexCol u-sizeFullV">
        <div class="u-flexGrow1 u-paddingVl u-paddingHm">
          <h1 class="Display Display--2 u-textCenter">
            ${props.title}
          </h1>
          <div class="Type">
            ${props.body}
          </div>
        </div>
        <div class="u-flexShrink0 u-flex">
          ${props.links.map(link => html`
            <a href="${link.href}" onclick=${link.onclick || null} class="Button ${link.secondary ? 'Button--secondary' : ''} u-flexGrow1">
              ${link.text}
            </a>
          `)}
        </div>
      </div>
    `
  } else {
    return html`
      <div class="u-paddingVl u-textCenter u-colorSky">
        ${loader()}
      </div>
    `
  }
}
