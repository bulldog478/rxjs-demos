import echarts = require('echarts')
export default class LineChart {
    private echart: echarts.ECharts

    constructor(el: HTMLDivElement) {
        this.echart = echarts.init(el)
    }

    setOptions(options) {
        this.echart.setOption(options)
    }

    showLoading() {
        this.echart.showLoading()
    }
    hideLoading() {
        this.echart.hideLoading()
    }
}
