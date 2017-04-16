import { Observable, Observer } from 'rxjs'

import { Mock } from './mock'

import LineChart from './lineChart'

const print = x => console.log('x: ', x)

const lineAge = new LineChart(document.getElementById('showAge') as HTMLDivElement)

lineAge.setOptions({
        title: {
            left: 'center',
            text: '动态数据(年龄)'
        },
        xAxis: {
            type: 'time',
            splitLine: {
                show: false
            }
        },
        yAxis: {
            type: 'value',
            boundaryGap: [0, '100%'],
            splitLine: {
                show: false
            }
        },
        series: [{
            type: 'line',
            data: []
        }]
    })

lineAge.showLoading()

const now = new Date().getTime()
const span = 2 * 1000
const bufferSize = 12

let counter = 0

const intervalEmit$ = Observable.interval(span)


const fetch$ = intervalEmit$.switchMap(e => Observable.fromPromise(Mock.fetch()))

const app$ = fetch$.bufferCount(bufferSize, 1).map(
    buffer => {
        counter === 0 && lineAge.hideLoading()
        const points =  buffer.map((b, index) => {
            const point = []
            point[0] = now + index * span + span * counter
            point[1] = b
            return point
        })
        counter++
        return points
    }
).do(data => {
    debugger;
    lineAge.setOptions({
        series: [{
            data
        }]
    })
})

app$.subscribe()
