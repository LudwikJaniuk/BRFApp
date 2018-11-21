const moment = require('moment')
const html = require('choo/html')
const nanoraf = require('nanoraf')
const hash = require('object-hash')
const Component = require('choo/component')
const { __ } = require('../../lib/locale')
const { chevron } = require('../icons')
const ChartFilter = require('./filter')
const Highchart = require('./highchart')
const { className, getPerformance, vw } = require('../base')

const SELECTED_COOPERATIVE = /cooperative:(\w+)/

module.exports = class Chart extends Component {
  constructor (id, state, emit) {
    super(id)
    this.id = id
    this.cache = state.cache
    this.state = state
    this.emit = emit
    this.isLoading = false

    this.local = {
      inEdit: typeof window !== 'undefined' && vw() >= 800,
      hasChanged: false,
      page: 0
    }
  }

  update (header, center, cooperative, actions) {
    if (this.version !== this.state.consumptions.clock) return true
    if (this.isLoading !== this.state.consumptions.isLoading) return true
    if (!moment(center).isSame(this.center)) return true
    if (cooperative._id !== this.cooperative) return true
    if (actions.length !== this.actions.length) return true
    return actions.reduce((shouldUpdate, action, index) => {
      return shouldUpdate || action._id === this.actions[index]
    }, false)
  }

  load () {
    const onresize = nanoraf(() => {
      if (this.local.hasChanged) return
      const inEdit = vw() >= 800
      if (this.local.inEdit !== inEdit) {
        this.local.inEdit = inEdit
        this.rerender()
      }
    })

    window.addEventListener('resize', onresize)
    this.unload = () => {
      this.local.page = 0
      window.removeEventListener('resize', onresize)
    }
  }

  setState (props) {
    if (props.page) {
      this.emit('track', {
        event_name: 'paginate',
        event_category: 'chart',
        event_label: 'paginate',
        value: props.page,
        energy_type: this.state.consumptions.type,
        cooperative_compare: this.state.consumptions.compare,
        energy_granularity: this.state.consumptions.granularity,
        energy_normalized: this.state.consumptions.normalized
      })
    }

    if (props.inEdit) this.local.hasChanged = true

    Object.assign(this.local, props)
    this.rerender()
  }

  createElement (header, center, cooperative, actions) {
    this.center = center
    this.cooperative = cooperative._id
    this.actions = actions.map(action => action._id)
    this.version = this.state.consumptions.clock

    if (typeof window === 'undefined') {
      return empty(html`
        <div>
          <div class="Chart-loading u-hiddenNoScript">${__('Fetching data')}</div>
          <div class="u-hiddenHasScript">
            ${__('There would be a pretty chart here, had you enabled JavaScript')}
          </div>
        </div>
      `)
    }

    const { page, inEdit } = this.local
    const { granularity, items, normalized, type, compare } = this.state.consumptions

    /**
     * Capture filter changes and forward as event
     */

    const onfilter = (type, value) => {
      if (type === 'granularity') this.local.page = 0
      this.emit(`consumptions:${type}`, value)
    }

    /**
     * Figure out where (when) to center the graph
     */

    const now = moment(center).add(5, granularity)
    const offset = Math.ceil(now.diff(Date.now(), granularity, true))
    if (offset > 0) now.subtract(offset, granularity)
    now.add(page, granularity)

    /**
     * Lookup cached data
     */

    const series = []
    const queries = getQueries(now, cooperative, this.state).reduce((missing, query) => {
      const cached = items[hash(query)]

      if (cached) {
        series.push({ name: query.name, values: cached })
        return missing
      }

      return missing.concat([query])
    }, [])

    /**
     * Fetch any data that might be missing and render loading state
     */

    this.isLoading = false
    if (queries.length && !this.state.error) {
      this.isLoading = true
      this.emit('consumptions:fetch', queries)
    }

    /**
     * Compose Monthly values into years
     */

    if (granularity === 'year') {
      series.forEach(set => { set.values = composeYears(set.values) })
    }

    const hasLater = moment(now).isBefore(Date.now(), granularity)

    /**
     * Trim off comparative serie to match primary in length
     */

    if (series.length === 2 && !hasLater) {
      const length = series[0].values.reduceRight((count, {value}) => {
        return value || count ? count + 1 : 0
      }, 0)
      series[1].values.splice(length)
    }

    return html`
      <div class="${className('Chart', { 'is-loading': this.isLoading })}">
        <div class="Chart-header">
          <div class="Chart-title">
            ${header()}
          </div>
          <div class="Chart-filter">
            <!-- Toggle form/summary view -->
            ${inEdit ? this.cache(ChartFilter, this.id + '-chart-form').render(cooperative, onfilter) : html`
              <div class="Chart-summary">
                <button class="Button Button--round Button--inverse u-marginLs u-floatRight" onclick=${() => this.setState({inEdit: true})}>
                  ${__('Edit')}
                </button>

                <!-- Compiled summary of current filter settings -->
                <strong>${__('Showing')}: </strong>
                ${__('Energy use').toLowerCase() + ' '}
                <em>${normalized ? ` (${__('normalized')})` : ''}</em>
                ${__('for') + ' '}
                <em>${getType(cooperative, type).toLowerCase() + ' '}</em>
                ${__('per') + ' '}
                <em>${__(granularity) + ' '}</em>
                ${compare ? html`
                  <span>
                    ${__('compared with') + ' '}
                    <em>${compare === 'prev_year'
                      ? __('Previous year').toLowerCase()
                      : this.state.cooperatives.find(item => item._id === compare).name
                    }</em>
                  </span>
                ` : null}
              </div>
            `}
          </div>
        </div>
        <div class="Chart-graph">
          <span class="Chart-legend">
            ${getType(cooperative, type)} (kWh/m<sup>2</sup>)
          </span>

          <!-- Cached container element -->
          ${this.cache(Highchart, this.id + '-highchart').render(granularity, formatActions(actions, series, granularity), series, this.isLoading)}

          <!-- Paginate buttons -->
          <button class="Chart-paginate Chart-paginate--left" onclick=${() => this.setState({page: page - 1})}>
            ${chevron('left')} <span class="Chart-pageLabel">${__('Show earlier')}</span>
          </button>
          <button class="Chart-paginate Chart-paginate--right" onclick=${() => this.setState({page: page + 1})} disabled=${!hasLater}>
            <span class="u-floatRight">
              <span class="Chart-pageLabel">${__('Show more recent')}</span> ${chevron('right')}
            </span>
          </button>
        </div>
      </div>
    `

    /**
     * Simple no fuzz loading state
     */

    function empty (content) {
      return html`
        <div class="Chart">
          <div class="Chart-header">
            <div class="Chart-title">
              ${header()}
            </div>
          </div>
          <div class="Chart-graph u-flex u-flexJustifyCenter u-flexAlignItemsCenter u-paddingVl">
            ${content}
          </div>
        </div>
      `
    }
  }
}

/**
 * Format type depending on whether consumption includes households' electricity
 */

function getType (cooperative, type) {
  const { incHouseholdElectricity } = cooperative
  const addSuffix = type === 'electricity' && incHouseholdElectricity
  return addSuffix ? __('Total elec (incl. households)') : __(type)
}

/**
 * Compile queries for fetching consumption data
 */

function getQueries (now, cooperative, state) {
  const { granularity, type, compare, normalized } = state.consumptions

  const queries = []
  queries.push(Object.assign({
    name: compare === 'prev_year' ? __('Current year') : cooperative.name,
    types: [ type ],
    normalized: normalized,
    cooperative: cooperative._id
  }, getPeriod(granularity, now)))

  if (granularity === 'month' && compare === 'prev_year') {
    const from = moment(queries[0].from).subtract(1, 'month')
    const period = getPeriod(granularity, from)

    queries.push(Object.assign({
      name: __('Previous year'),
      types: [ type ],
      normalized: normalized,
      cooperative: cooperative._id
    }, period))
  }

  if (SELECTED_COOPERATIVE.test(compare)) {
    const id = compare.match(SELECTED_COOPERATIVE)[1]
    const other = state.cooperatives.find(item => item._id === id)
    let name = other.name
    const performances = {
      primary: getPerformance(cooperative),
      other: getPerformance(other)
    }

    // Ensure that primary serie is labeled by name and not 'Current year'
    queries[0].name = cooperative.name

    if (type === 'electricity') {
      if (performances.other) {
        if (performances.other.incHouseholdElectricity) {
          name = __('%s (incl. households)', name)
        } else if (performances.other.isGuesstimate) {
          name = __('%s (estimate)', name)
        }
      }

      if (performances.primary) {
        if (performances.primary.incHouseholdElectricity) {
          queries[0].name = __('%s (incl. households)', queries[0].name)
        } else if (performances.primary.isGuesstimate) {
          queries[0].name = __('%s (estimate)', queries[0].name)
        }
      }
    }

    // Have other cooperative inherit period from primary serie
    queries.push(Object.assign({}, queries[0], {
      cooperative: id,
      name: name
    }))
  }

  return queries
}

/**
 * Compile actions for data set period
 */

function formatActions (actions, series, granularity) {
  if (!series.length || !series[0].values.length) { return [] }

  const points = []
  const values = series[0].values

  // Filter out only those who are within the given time span
  const min = moment(values[0].date).startOf(granularity)
  let max = moment(values[values.length - 1].date).endOf(granularity)
  if (granularity === 'year' && (new Date()).getFullYear() - 1 !== max.year()) {
    // Filter out actions out of bounds unless the most resent year is included
    max = max.startOf(granularity)
  }

  actions.forEach((action, index) => {
    if (!moment(action.date).isBetween(min, max)) return

    // Find closest data point to latch on to
    const date = moment(action.date)
    const point = values.find(point => date.isSame(point.date, granularity))

    if (action.merge) {
      // Actions may merge with an associated series point, let's do that
      point.hasAction = true
    } else {
      // Or they'll be added to a seperate serie
      points.push({
        name: index + 1,
        date: action.date,
        value: point.value
      })
    }
  })

  return points
}

/**
 * Calculate yearly consumption by summing up months
 */

function composeYears (data) {
  return data.reduce((years, point) => {
    // Get last year in list
    const year = years[years.length - 1]

    if (year && (year.date.getFullYear() === point.date.getFullYear())) {
      year.value = point.value ? year.value + point.value : year.value
    } else {
      years.push({
        date: moment(point.date).startOf('year').toDate(),
        value: point.value
      })
    }

    return years
  }, [])
}

/**
 * Calculate from and to based on granularity
 */

function getPeriod (granularity, now = Date.now()) {
  switch (granularity) {
    case 'month': return {
      from: moment(now).subtract(11, 'months').startOf('month').toDate(),
      to: moment(now).endOf('month').toDate()
    }
    case 'year': return {
      from: moment(now).subtract(6, 'years').startOf('year').toDate(),
      to: moment(now).subtract(1, 'year').endOf('year').toDate()
    }
    default: throw (new Error(`Granularity "${granularity}" not supported`))
  }
}
