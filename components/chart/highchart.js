const html = require('choo/html')
const nanoraf = require('nanoraf')
const merge = require('lodash.merge')
const Component = require('choo/component')
const capitalize = require('lodash.capitalize')
const moment = require('moment')
const defaults = require('./defaults')
const { __ } = require('../../lib/locale')
const { format, className, vw } = require('../base')

module.exports = class Highchart extends Component {
  constructor (id) {
    super(id)
    this.isInitialized = false
    this.hasLoaded = false
    this.args = []
  }

  update (granularity, actions, data, isLoading) {
    if (this.chart) {
      if (isLoading) {
        this.chart.showLoading()
      } else {
        this.chart.hideLoading()
      }

      if (!isLoading && shouldUpdate(arguments, this.args)) {
        this.chart.update(Object.assign({},
          defaults,
          getConfig(granularity),
          { series: compose(actions, data) }
        ))
      }
    }

    this.args = [...arguments]

    return false
  }

  load () {
    if (this.hasLoaded) return this.init(...this.args)
    this.hasLoaded = true

    Promise.all([
      import('highcharts'),
      import('highcharts/modules/no-data-to-display')
    ]).then(([ Highcharts, noData ]) => {
      // Initialize the no data plugin with Highcharts
      noData(Highcharts)
      this.Highcharts = Highcharts
      this.init(...this.args)
    })
  }

  init (granularity, actions, data, isLoading) {
    this.isInitialized = true

    // Remove loader from chart container
    this.element.innerHTML = ''

    const config = merge({
      lang: {
        noData: __('No data'),
        loading: __('Fetching data')
      },
      legend: {
        x: vw() * 0.02 - 8
      },
      tooltip: {
        // Position tooltip relative to chart width
        positioner: (width, height, point) => {
          // Align to right when there's no room
          if ((width + point.plotX) > this.chart.plotWidth) {
            // Apply right align modifier as soon as the element is in the DOM
            window.requestAnimationFrame(() => {
              const tooltip = this.element.querySelector('.js-tooltip')
              tooltip.classList.add('Chart-tooltip--alignRight')
            })

            return { x: point.plotX - width + 24, y: point.plotY - 5 }
          }

          return { x: point.plotX - 4, y: point.plotY - 5 }
        }
      }
    }, defaults, getConfig(granularity), { series: compose(actions, data) })

    this.chart = this.Highcharts.chart(this.element, config, chart => {
      chart.container.style.removeProperty('overflow')
      chart.reflow()
    })

    if (isLoading) {
      this.chart.showLoading()
    }

    const onresize = nanoraf(() => {
      this.chart.update({legend: {x: vw() * 0.02 - 8}})
    })

    window.addEventListener('resize', onresize)
    this.unload = function () {
      this.chart.destroy()
      window.removeEventListener('resize', onresize)
    }
  }

  createElement () {
    this.args = [...arguments]

    return html`
      <div class="u-flexGrow1 u-sizeFull u-flex u-flexAlignItemsCenter">
        <!-- Insert intermediary loader while waiting for Highcharts -->
        <div class="Chart-loading">${__('Fetching data')}</div>
      </div>
    `
  }
}

/**
 * Create Highcharts options based on type of data
 * @param  {String} granularity Chart granularity setting
 * @return {Object}             Highcharts compatible options
 */

function getConfig (granularity) {
  return {
    tooltip: {
      formatter: formatters[granularity]
    },
    xAxis: {
      labels: {
        formatter: labels[granularity]
      }
    }
  }
}

/**
 * Compare arguments to determine whether to update the chart
 * @param {any} args New arguments
 * @param {any} prev Previous arguments
 * @returns {boolean}
 */

function shouldUpdate (args, prev) {
  const [granularity, actions, data, isLoading] = args
  const [prevGranularity, prevActions, prevData, wasLoading] = prev

  // Check wether data is done loading
  if (!isLoading && wasLoading) {
    return true
  }

  // Compare granularity
  if (granularity !== prevGranularity) {
    return true
  }

  // Compare number of actions
  if (actions.length !== prevActions.length) {
    return true
  }

  // Compare number of data series
  if (data.length !== prevData.length) {
    return true
  }

  // Compare data series
  return data.reduce((result, serie, serieIndex) => {
    const diff = serie.values.length !== prevData[serieIndex].values.length
    return result || diff || serie.values.reduce((diff, value, index) => {
      return diff || value !== prevData[serieIndex].values[index]
    }, false)
  }, false)
}

/**
 * Adapt xAxis labels to granularity
 */

const labels = {
  month () {
    return moment(this.value).format('MMM YYYY')
  },
  year () {
    return moment(this.value).format('YYYY')
  }
}

/**
 * Shared tooltips throw off the `positioner`, so we include all
 * series points for given index in main serie's tooltip
 */

const formatters = {
  month () {
    // Get point index and a list of all series
    const { point: { index, hasAction }, series: { chart: { series } } } = this
    const sets = series.slice(0, 2).filter(serie => serie.visible && serie.data.length)

    // Figure out if the two series are aligned to pick a proper title
    const leadYear = series[0].data[0].name.getFullYear()
    const trailYear = series.length > 1 && series[1].data[0].name.getFullYear()
    const isAligned = leadYear === trailYear

    return `
      <span class="${className('Chart-tooltip js-tooltip', { 'Chart-tooltip--hasAction': hasAction })}">
        <strong>${capitalize(moment(this.x).format('MMMM'))}</strong>
        ${sets.reduce((str, serie) => `
          ${str}
          <span class="Chart-tipRow">
            <strong class="Chart-label">${isAligned ? serie.name : moment(serie.data[index].name).format('YYYY')}</strong>
            <span class="Chart-value">
              ${serie.data[index].isNull ? `–` : `
                <span class="Chart-value">${format(serie.data[index].y)} kWh/m<sup>2</sup></span>
              `}
            </span>
          </span>
        `, '')}
      </span>
    `
  },
  year () {
    // Get point index and a list of all series
    const { point: { index, hasAction }, series: { chart: { series } } } = this
    const sets = series.slice(0, 2).filter(serie => serie.visible && serie.data.length)

    return `
      <span class="${className('Chart-tooltip js-tooltip', { 'Chart-tooltip--hasAction': hasAction })}">
        <strong>${capitalize(moment(this.x).format('YYYY'))}</strong>
        ${sets.reduce((str, serie) => `
          ${str}
          <span class="Chart-tipRow">
            <strong class="Chart-label">${serie.name}</strong>
            <span class="Chart-value">${format(serie.data[index].y)} kWh/m<sup>2</sup></span>
          </span>
        `, '')}
      </span>
    `
  }
}

/**
 * Compose Highcharts formated series from list of actions and datasets
 * @param  {Array} actions List of actions
 * @param  {Array} data    List of datasets
 * @return {Array}         Highcharts compatible series data
 */

function compose (actions, data) {
  let series = []
  const extremes = []

  /**
   * Only populate the series if primary data set has data
   */

  if (data.length && data[0].values.length) {
    series = data.filter(set => set.values.length).map(set => {
      let highIndex, lowIndex

      /**
      * Find lowest value in the dataset and store it and it's index
      */

      const low = set.values.reduce((low, props, index) => {
        if (props.value > low) { return low }
        lowIndex = index
        return props.value
      })

      /**
      * Find highest value in the dataset and store it and it's index
      */

      const high = set.values.reduce((high, props, index) => {
        if (props.value < high) { return high }
        highIndex = index
        return props.value
      })

      /**
      * Store extremes so that we can lookup collision in the next iteration
      */

      extremes.push(
        { index: lowIndex, value: low },
        { index: highIndex, value: high }
      )

      return {
        name: set.name,
        showInLegend: true,
        pointStart: (new Date(set.values[0].date)).getTime(),
        pointInterval: moment(set.values[1].date).diff(set.values[0].date),
        data: set.values.map((props, index) => {
          // Determine whether this point in an extreme
          const isExtreme = (high === props.value || low === props.value)

          // Lookup possible conflict in list of extremes
          const conflict = extremes.find(extreme => index === extreme.index)

          const point = {
            dataLabels: {
              enabled: isExtreme,
              // Adjust label position so as not to overlap with other labels
              y: (conflict && (conflict.value < props.value)) ? -7 : 6,
              verticalAlign: (conflict && (conflict.value < props.value)) ? 'bottom' : 'top'
            },
            // Set the actual date as name
            name: props.date,
            // All series align to main serie xAxis
            x: (new Date(data[0].values[index].date)).getTime(),
            y: props.value
          }

          if (props.hasAction) {
            point.hasAction = true
            point.marker = {
              fillColor: '#FEC73D',
              lineColor: '#FEC73D',
              radius: 5
            }
          }

          return point
        })
      }
    })
  }

  /**
   * Populate comparative series with empty data if no data was provided
   */

  while (series.length < 2) {
    series.push({ showInLegend: false, data: [] })
  }

  /**
   * Add on actions to list of series
   */

  series.push({
    data: actions.map(action => ({
      name: action.name,
      x: (new Date(action.date)).getTime(),
      y: action.value
    }))
  })

  return series
}
