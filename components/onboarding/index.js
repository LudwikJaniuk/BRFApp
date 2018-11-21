const html = require('choo/html')
const Component = require('choo/component')
const asElement = require('prismic-element')
const { asText, Elements } = require('prismic-richtext')
const resolve = require('../../lib/resolve')
const { __ } = require('../../lib/locale')

const SPEED_FACTOR = 1000

module.exports = class Onboarding extends Component {
  constructor (id, state, emit) {
    super(id)
    this.page = 0
    this.isLoading = false
    this.state = state
    this.emit = emit
  }

  load (element) {
    const reel = element.querySelector('.js-reel')

    let timeout
    const onscroll = event => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => this.align(), 200)
    }

    reel.addEventListener('scroll', onscroll)

    this.unload = () => {
      reel.removeEventListener('scroll', onscroll)
    }
  }

  update (callback) {
    this.callback = callback
    this.align()
    return false
  }

  align () {
    let currentTime = 0
    const reel = this.element.querySelector('.js-reel')
    const { scrollLeft, offsetWidth } = reel
    const offset = offsetWidth * this.page

    if (scrollLeft !== offset) {
      // Modulate between 300ms and 800ms animation
      const time = Math.max(0.3, Math.min(Math.abs(scrollLeft - offset) / SPEED_FACTOR, 0.8))

      const tick = () => {
        currentTime += 1 / 60

        const progress = currentTime / time
        const factor = easeInOut(progress)

        // As long as progress is greater than 1, keep animating.
        if (progress < 1) {
          window.requestAnimationFrame(tick)
          reel.scrollLeft = scrollLeft + ((offset - scrollLeft) * factor)
        } else {
          reel.scrollLeft = offset
          this.rerender()
        }
      }

      tick()
    }
  }

  createElement (callback) {
    this.callback = callback
    const { emit } = this
    const doc = this.state.content.onboarding
    const cards = doc.data.cards
    const onclick = page => event => {
      if (page >= cards.length) {
        callback()
      } else {
        this.page = page
        this.align()
      }

      event.preventDefault()
    }

    return html`
      <div class="Onboarding">
        <div class="Onboarding-reel js-reel">
          ${cards.map((card, index) => {
            return html`
              <article class="Onboarding-card" id="${this.name}-${index}">
                ${card.image.url ? html`
                  <div class="Onboarding-container">
                    <img class="Onboarding-image" src="${card.image.url}" />
                  </div>
                ` : null}
                <h2 class="Display Display--4">
                  ${asText(card.title)}
                </h2>
                <div class="Type">
                  ${asElement(card.body, resolve, serialize)}
                </div>
              </article>
            `
          })}
        </div>

        <ol class="Onboarding-pagination">
          ${cards.map((card, index) => html`
            <li>
              <a href="#${this.name}-${index}" class="Onboarding-page ${this.page === index ? 'is-active' : ''}" onclick=${onclick(index)}>
                ${asText(card.title)}
              </a>
            </li>
          `)}
        </ol>

        ${typeof window === 'undefined' || this.page === (cards.length - 1) ? html`
          <form action="${this.state.href}" method="GET">
            <button type="submit" name="hasBoarded" value="true" class="Button u-block u-sizeFull" onclick=${onclick(this.page + 1)}>
              ${__('Close')}
            </button>
          </form>
        ` : html`
          <a href="#${this.name}-${this.page + 1}" class="Button u-block u-sizeFull" onclick=${onclick(this.page + 1)}>
            ${__('Next')}
          </a>
        `}
      </div>
    `

    function serialize (type, element, content, children) {
      if (type !== Elements.hyperlink) return null
      const isDocument = element.data.link_type === 'Document'
      const href = isDocument ? resolve(element.data.url) : element.data.url
      const attrs = {
        onclick: onnavigate,
        href: href.replace(process.env.BRFENERGI_SERVICE_URL, '')
      }

      if (element.data.target && element.data.target === '_blank') {
        attrs.target = '_blank'
        attrs.rel = 'noopener noreferrer'
      }

      return html`<a ${attrs}>${children}</a>`

      function onnavigate (event) {
        callback().then(() => emit('pushState', attrs.href))
        event.preventDefault()
      }
    }
  }
}

function easeInOut (progress) {
  return (-0.5 * (Math.cos(Math.PI * progress) - 1))
}
