const html = require('choo/html');
const pick = require('lodash.pick');
const component = require('fun-component');
const menu = require('../menu');
const modal = require('../modal');
const logo = require('./logo');
const { loader, chevron } = require('../icons');
const { follow } = require('../utils');
const resolve = require('../../resolve');
const { __ } = require('../../locale');

module.exports = component({
  name: 'page-head',
  href: null,
  hasModal: false,
  isExpanded: false,
  allowRender: false,

  update(element, [ state ]) {

    /**
     * Close menu drop down on navigate
     */

    if (state.href !== this.href) {
      this.isExpanded = false;
      return true;
    }

    return this.allowRender;
  },

  render(state, emit) {
    this.href = state.href;
    this.allowRender = false;

    const { user } = state;
    const toggle = open => event => {
      this.isExpanded = open;
      this.render(state, emit);
      event.preventDefault();
    };

    const pages = {
      home: state => state.user.isAuthenticated && ({
        href: resolve(`/cooperatives/${ state.user.cooperative }`),
        title: state.cooperatives.find(props => {
          return props._id === state.user.cooperative;
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
        href: resolve(state.user.isAuthenticated ? '/auth/signout' : '/auth'),
        title: state.user.isAuthenticated ? __('Sign out') : __('Sign in'),
        onclick: event => {
          if (state.user.isAuthenticated) {
            window.location.assign(resolve('/auth/signout'));
          } else {
            this.hasModal = true;
            this.isExpanded = false;
            this.render(state, emit);

            if (!state.content['sign-in']) {
              this.allowRender = true;
              emit('content:fetch', 'sign-in');
            }
          }

          event.preventDefault();
        }
      })
    };

    return html`
      <div class="PageHead">
        <a href=${ resolve('/') } class="PageHead-title">
          ${ logo() } Brf Energi
        </a>
        <nav class="PageHead-navigation">

          <!-- Small viewport: drop down menu list -->
          <div id="page-menu-sm" class="PageHead-menu u-md-hidden u-lg-hidden ${ this.isExpanded ? 'is-open' : '' }">
            ${ menu(Object.values(pages).map(page => page(state, emit)).filter(Boolean)) }
          </div>

          <!-- Medium & large viewport: drop down menu list -->
          ${ user.isAuthenticated ? html`
            <div id="page-menu-lg" class="PageHead-menu u-hidden u-md-block u-lg-block ${ this.isExpanded ? 'is-open' : '' }">
              ${ menu(Object.values(pick(pages, 'home', 'auth')).map(page => page(state, emit)).filter(Boolean)) }
            </div>
          ` : null }

          <!-- Medium & large viewport: horizontal menu list -->
          <ul class="u-hidden u-md-block u-lg-block">
            ${ Object.values(pick(pages, 'faq', 'about')).map(page => {
              const props = page(state, emit);
              return html`
                <li class="PageHead-item">
                  <a href=${ props.href } class="PageHead-link">${ props.title }</a>
                </li>
              `;
            }) }
          </ul>

          <!-- Small viewport: open drop down menu -->
          <a href="#page-menu-sm" onclick=${ toggle(true) } class="PageHead-trigger PageHead-trigger--small PageHead-link">
            ${ __('Menu') } ${ chevron('down') }
          </a>

          <!-- Medium & large viewport: open drop down menu -->
          ${ user.isAuthenticated ?
            // Render user menu anchor link
            html`
              <a href="#page-menu-lg" onclick=${ toggle(true) } class="PageHead-trigger PageHead-trigger--large PageHead-link">
                ${ __('Menu') } ${ chevron('down') }
              </a>
            ` :
            // Render sign in link
            (function () {
              const props = pages.auth(state, emit);
              return html`
                <a href=${ props.href } class="PageHead-link PageHead-trigger PageHead-trigger--large" onclick=${ props.onclick }>
                  ${ props.title }
                </a>
              `;
            }())
          }

          <!-- All viewports: close drop down menu -->
          <a href="#page-head" onclick=${ toggle(false) } class="PageHead-untrigger PageHead-link" hidden data-title-small=${ __('Close') + ' ' } data-title-large=${ (user.isAuthenticated ? __('Menu') : __('Close')) + ' ' }>
            ${ chevron('up') }
          </a>
        </nav>

        ${ this.hasModal ? modal(signin(state.content['sign-in']), () => {
          this.hasModal = false;
          this.render(state, emit);
        }) : null }
      </div>
    `;
  }
});

function signin(doc) {
  if (doc) {
    return html`
      <div class="u-flex u-flexCol u-flexJustifyBetween u-sizeFullV">
        <div class="u-flexShrink0 u-marginVl u-marginHm">
          <h1 class="Display Display--2 u-textCenter">
            ${ doc.getStructuredText('sign-in.title').asText() }
          </h1>
          <div class="Type">
            ${ doc.getStructuredText('sign-in.body').asElement() }
          </div>
        </div>
        <div class="u-flex">
          <a href="${ resolve('/auth/metry') }" onclick=${ follow } class="Button u-flexGrow1">
            ${ __('Sign in with Metry') }
          </a>
        </div>
      </div>
    `;
  } else {
    return html`
      <div class="u-marginVl u-textCenter u-colorSky">
        ${ loader() }
      </div>
    `;
  }
}
