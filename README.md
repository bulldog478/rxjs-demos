# 监控折线图

> 初学rxjs，本着一个新手的角度完成一个小demo，相信过程中会有很多大家也遇到过的问题，同时整个过程不断发散，讲解一些rxjs的核心知识点和API，希望这篇文章能给学习rxjs的同学们一些启发。

## 需求描述

折线图有12个点（按时间分布），每隔2秒（为了演示方便）刷新出一个点。

## 怎么做

先简单点想，

需要一个集中存储`状态`的地方，这里的状态其实就是图表对应的数据，这个地方每经过一个时间间隔就向服务器请求一次数据，它需要存储最近12个点对应的数据

把这种想法往rxjs上靠。首先我们先写个最基本的可观察对象`fetchData$`

> 新建src/app.ts

```js
import {Observable, Observer} from 'rxjs'

import {Mock} from './mock'

const print = x => console.log('x: ', x)

const intervalEmit$ = Observable.interval(2000)

const fetchData$ = Observable.fromPromise(Mock.fetch())

intervalEmit$.subscribe(print)
fetchData$.subscribe(print)
```
> 新建src/mock.ts

```js
import axios from 'axios'

export class Mock {

    static fetch():Promise<Number> {
        // base : 20
        return axios.get('https://zan.wilddogio.com/age.json')
        .then(res => Number(res.data) + Mock.randomAge(10))
    }

    // random 1 ~ x
    static randomAge(x) {
        return Math.floor(1 + Math.random() * x)
    }
}
```

### 子任务1 - 每两秒发一个rest请求

很简单一个是每两秒produce一个递增值，一个是请求回来一个promiseable值并produce
现在我们做个组合，也就是每隔两秒请求回来一个promiseable值并produce，我们修改app.ts

```js
const intervalEmit$ = Observable.interval(2000)

// 第一种
const app$ = intervalEmit$.switchMap(e => Observable.fromPromise(Mock.fetch()))

// 第二种，将switchMap拆开
const fetchData$ = intervalEmit$.map(e => Observable.fromPromise(Mock.fetch()))
const app$ = fetchData$.switch()

// 第三种，使用defer工厂创建Observable
const deferPromise$ = Observable.defer(function () {
     return Observable.fromPromise(Mock.fetch())
})
const app$ = intervalEmit$.switchMap(e => deferPromise$)

app$.subscribe(print)
```

先说第三种，它相对单纯:），我们先看下`defer`的[定义](http://reactivex.io/rxjs/class/es6/Observable.js~Observable.html#static-method-defer)，Creates an Observable that, on subscribe, calls an Observable factory to make an Observable for each new Observer. 意思也比较好理解，defer接受一个产生observable的函数，当defer所创建的observable被订阅时就通过该函数创建一个observable对象。

第一种和第二种放在一块说，map就不用说了，就是将一个observable经过一个`函数`转换形成另一个observable，和Array.prototyp.map很像，但是你可以把它理解成一个时间点上的值或者对一个值的一对一变换。重点说下switch，同样我们先看下[定义](http://reactivex.io/rxjs/class/es6/Observable.js~Observable.html#instance-method-switch)，Converts a higher-order Observable into a first-order Observable by subscribing to only the most recently emitted of those inner Observables. 解释一下，通过订阅的方式将一个高阶observable转换为一个低阶observable，同时仅产生一个低阶最近产生的值。


首先要先清楚什么叫高阶，
```js
var fn = function(a, b) {return a + b}
```

通过typeof fn可以看到fn的类型是`function`，继续
```js
var fn1 = fn(1,2)
```

通过typeof fn1可以看到fn1的类型是`number`，OK，它已经不是函数了，那么如何让fn1继续是函数呢，我们改写一下

```js
var fn = function(a) {return function(b) {return a + b}}
```

如果这次你还想得到1+2=3，那么你需要fn(1)(2)才能得到，也就是说我们想得到最终的结果调用了一次以上的函数，好的这就叫做高阶，超过一次就是高阶，这和数学里的高阶导数类似的。好了我们回到switch的主题。

```js
var ob$ // 一个可观察对象
var higher$ = ob$.实例operator(静态operator)
```

这里有一个`实例operator`，它就是一个转换器，它将一个源observable作为一个模版转变为另外一个observable，而且源observable是不被改变的，而`静态operator`就像一个observable制造器一样，一启动（subscribe）就开始生产。因此

> var higher$ = ob$.实例operator(静态operator)

这里得到的higher$就是一个`高阶observable`了，因为当你订阅它时，它不像静态operator产生数据，而是产生observable，所以就像你执行fn(1)产生的是一个新的函数而不是值一样。下面是个小栗子，可以看到打印出的是observable。

```js
var print = x=>console.log('x: ', x)
var clicks = Rx.Observable.fromEvent(document, 'click');
var higherOrder = clicks.map((ev) => Rx.Observable.interval(1000));
higherOrder.subscribe(print)
// x:  IntervalObservable {_isScalar: false, period: 1000, scheduler: AsyncScheduler}
```

因此我们需要switch将high$转换成低阶observable，

> var lower$ = higher$.switch()

这样当我们订阅lower$的时候，将会得到`静态operator`所产生的值，看官方栗子，

```js
var print = x=>console.log('x: ', x)
var clicks = Rx.Observable.fromEvent(document, 'click');
var higherOrder = clicks.map((ev) => Rx.Observable.interval(1000));
var lowerOrder = higherOrder.switch()
lowerOrder.subscribe(print)
//== 第一次点击 ==
// x: 0
// x: 1
//== 第二次点击 ==
// x: 0
```

可以看到，现在打印出的是值了，而且当我们再次点击时，__Rx.Observable.interval(1000)__被重新执行了，这也正是Flattens an Observable-of-Observables by dropping the previous inner Observable once a new one appears.的含义，当外层observable产生值时，它会触发丢弃最近一次被订阅的内层observable。我们知道promise对象一旦创建，它处于pending状态，最终变为onFulfille或者onRejected状态，因此它是不能被取消的。而通过rxjs可以达到目的，看一个栗子。我们用express做一个restFul服务器，

app.js
```js
var express = require('express');
var app = express()

app.use(express.static('blog'));

app.get('/delay', function(req, res) {
  setTimeout(function(){
    res.send('hello world')
  },3000)
  
})

var server = app.listen(3000, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('app listening at http://%s:%s', host, port)
})
```

当服务器接收到http://localhost:3000/delay请求时，延迟三秒发送响应。再看客户端代码

最近被取消.html
```html
<script>
window.onload = function () {
            var print = x=>console.log('x: ', x)
            var ajax$ = Rx.Observable.fromPromise($.ajax('/delay'))

            var click$ = Rx.Observable.fromEvent(document, 'click')
            var higher$ = click$.map(e=>Rx.Observable.fromPromise($.ajax('/delay')))

            var app$ = higher$.switch()

            app$.subscribe(print)   //当我在三秒内疯狂点击5次，其实只返回一次数据，也就是说前四次被unsubscribe了    
        }
</script>
```

此时我在页面疯狂点击五次（三秒之内），你会看到发出了五次请求，但是最终缺只打印出一条hello world，是的前四次都被unsubscribe
了也就是官网中多说的drop，这就达到了撤销promise的效果。

我们继续，现在我们实现了每两秒发送一个请求，接下来我们实现数据的存储

### 子任务2 - 数据reply

首先我们要先存储够24个点，之后每来一个点丢弃一个最旧的点。我们小时候都听过磁带，录音机有倒带的功能（不是周杰伦给蔡依林写的那首），因此磁带存储了整个过程，你可以回退到之前播放的任意一个时间点重新播放，其实我们的一次次请求就像在播放磁带，我们想获取到之前点的最好办法就是可以存储它们，磁带也有存储大小，那么我们也不可能无限存储，所以我们就暂存最近24次记录。下面rxjs的倒带replay登场。

在rxjs的api文档中搜索replay可以看到两个东东`ReplaySubject`和`publishReplay`，前者是一个Subject类，后者是一个Observable实例operator，他们之间有没有什么关联，我们还是先来看看他俩该怎么用吧，先说和Observable更关系更紧密的publishReplay。

public publishReplay(bufferSize: *, windowTime: *, scheduler: *): ConnectableObservable<T> -- 这是publicReplay的函数签名，连个例子都没有，或许不常用，或许一般都用ReplaySubject？不管怎么样我们还是要秉持刨根问底的态度。既然没有任何栗子那我们就点开source看下源码
```js
export function publishReplay(bufferSize = Number.POSITIVE_INFINITY, windowTime = Number.POSITIVE_INFINITY, scheduler) {
    return multicast.call(this, new ReplaySubject(bufferSize, windowTime, scheduler));
}
```

原来publishReplay的三个参数都是为ReplaySubject实例化服务的，那么对于参数我们先按下不谈，看看这个`multicast`，这个this代表Observable实例，那么在我们看看这个operator之前，我们先说下`单播`和`多播`，这对我们理解该operator很有帮助。

虽然到目前为止我们还没有讲Subject，但是先白话一下单播Observable和多播Subject，单播很高冷（cold）很专注（独立），她从不主动联系别人，只有在别人关注她后，才会和这个人侃侃而谈。再来一个人关注她，和她交流中感受不到还有别人的存在。而Subject就很热情(hot)喜欢分享（不独立）。不论何时关注她，她都乐于将经验与人分享。下面看两个小栗子。

Obserable单播
```js
const printA = (val) => console.log('observerA :' + val)
const printB = (val) => console.log('observerB :' + val)

var clicks = Rx.Observable.fromEvent(document, 'click');
var ones = clicks.mapTo(1);
var seed = 0;
var count = ones.scan((acc, one) => acc + one, seed);
count.subscribe(printA);

setTimeout(function() {
    console.log('another subscribe.')
    ones.scan((acc, one) => acc + one, seed).subscribe(printB)  
}, 3000)
```

![](http://i4.buimg.com/567571/9becf65558edf094.png)

从图中可以看到，3秒以后observerB依然从1开始打印，同时也可以看出只有别人订阅她的时候，她才会和别人沟通。

![](http://i4.buimg.com/567571/9becf65558edf094.png)

从这个图可以更直观的看出，当我们订阅蓝色scan转换后的observable和红色scan转换后的observable时，其实走的是两个独立的分支，每次订阅也都是通过fromEvent创建了一个新的observable，其实observable就是一个函数，当收到订阅时，就执行函数，在函数中通过订阅者留下的通知方式通知到订阅者。再来看Subject多播。

Subject多播
```js
var subject = new Rx.Subject()
subject.subscribe(printA)

setTimeout(function() {
    console.log('another subscribe.')
    subject.subscribe(printB)
}, 3000)

Rx.Observable.fromEvent(document, 'click').mapTo(1).scan((acc, one) => acc + one, 0)
.do(num => subject.next(num))
.subscribe()
```

![](http://i1.piimg.com/567571/29af9542896e7426.png)

从图中看到虽然observerB3秒后姗姗来到，但是依然分享到了observerA的努力成果，从3开始打印。同时看到subject是主动告知订阅者，so hot~

![](http://i2.muimg.com/567571/375a12d4ed5c108a.png)

可以看出Subject和Observable的区别，三秒后的订阅并没有创建一个新的分支，也就是没有新的observable实例以及后续的一些列变换。

这里我们简单讲解了Observable的冷、单播和独立性以及Subject的热、多播和共享性。那么我们回来，继续说multicast，接受一个Subject实例作为参数，我们有理由相信，这个operator是observable实例通过subject实例被赋予了多播的特性。我们看一个multicast的小栗子。

```js
var clickAddOne$ = Rx.Observable.fromEvent(document, 'click').mapTo(1).scan((acc, one) => acc + one, 0)

var subject = new Rx.Subject

subject.subscribe(printA)
setTimeout(function() {
    console.log('another subscribe.')
    subject.subscribe(printB)
}, 3000)

var app$ = clickAddOne$.multicast(subject)

app$.subscribe()
```

这段代码运行起来除了another subscribe.，不论你如何点击都不会打印其他信息。看来这个app$不是单纯的observable实例，我们看下rxjs官网对于multicast的描述：

![](http://i1.piimg.com/567571/708524cd309e77e1.png)

意思大概是，返回值是一个`ConnectableObservable实例`，该实例可以产生数据共享给潜在的订阅者（即Subject实例上的订阅者），我们修改一下代码。

```js
// app$.subscribe()
app$.connect()
```

![](http://i1.piimg.com/567571/29af9542896e7426.png)

从图中我们看到了和上面Subject多播一致的结果。这里我们看到了一个陌生的方法`connect`，`ConnectableObservable`继承自`Observable`，同时具有一个`connect`方法和一个`refCount`方法。connect方法决定何时订阅生效，同时返回一个方法以决定何时取消所有订阅。

```js
var clickAddOne$ = Rx.Observable.fromEvent(document, 'click').mapTo(1).scan((acc, one) => acc + one, 0).do(x=>console.log('do: ' + x))

var subject = new Rx.Subject

subject.subscribe(printA)
setTimeout(function() {
    console.log('another subscribe.')
    subject.subscribe(printB)
}, 3000)

var app$ = clickAddOne$.multicast(subject)

var connector = app$.connect()

setTimeout(function() {
    connector.unsubscribe()
}, 6000)
```

6秒过后，点击不会产生任何打印信息。这里显示调用connect和返回实例上的unsubscribe显得太命令式了，这里我们还可以使用refCount使得这个过程的关注点放在observer的订阅和取消上。改写下上面的例子

```js
var clickAddOne$ = Rx.Observable.fromEvent(document, 'click').mapTo(1).scan((acc, one) => acc + one, 0).do(x=>console.log('do: ' + x))

var subject = new Rx.Subject

var app$ = clickAddOne$.multicast(subject).refCount()

app$.subscribe(printA)
setTimeout(function() {
    console.log('another subscribe.')
    app$.subscribe(printB)
}, 3000)
```

![](http://i1.piimg.com/567571/29af9542896e7426.png)

这更加Observable，同时我们也达到了Observable多播化的目的，破费！

兜了一大圈回到publishReplay，再看下面的源码就更清楚了许多

```js
export function publishReplay(bufferSize = Number.POSITIVE_INFINITY, windowTime = Number.POSITIVE_INFINITY, scheduler) {
    return multicast.call(this, new ReplaySubject(bufferSize, windowTime, scheduler));
}
```

publishReplay本身就是observable.multicast(new ReplaySubject)的语法糖，那么我们就来看下ReplaySubject是个啥。先上一个小栗子

```js
const printA = (val) => console.log('observerA :' + val)
const printB = (val) => console.log('observerB :' + val)
var subject = new Rx.ReplaySubject(3);
subject.subscribe({
    next: (v) => console.log('observerA: ' + v)
});
subject.next(1);
subject.next(2);
subject.next(3);
subject.next(4);
subject.subscribe({
    next: (v) => console.log('observerB: ' + v)
});

subject.next(5);

subject.subscribe({
    next: (v) => console.log('observerC: ' + v)
});
```

![](http://i4.buimg.com/567571/0f8e1b243350520f.png)

可以看出后两次subscribe，就打印出了`前三次`可观察对象产生的值，这有点像Observable订阅，但又不会创建新的Observable实例，这种带有重新发送以前数据的能力就是ReplaySubject了，因此下面两端代码是所实现的功能是一样的

```js
var app$ = Rx.Observable.interval(1000).multicast(new Rx.ReplaySubject(3)).refCount()
app$.subscribe(printA)
setTimeout(function () {
    app$.subscribe(printB)
}, 3000)
```

```js
var app$ = Rx.Observable.interval(1000).publishReplay(3).refCount()
app$.subscribe(printA)
setTimeout(function () {
    app$.subscribe(printB)
}, 3000)
```

![](http://i2.muimg.com/567571/b085c3c3b73553a9.png)

### 子任务2 - replay 24个请求数据

经过一个个引申我们掌握了不少rxjs的核心知识点和api使用，那么回到demo上，我们已经完成了每两秒完成一次rest请求，下面我们先完成这样一个任务，当我们缓存到第23个点时，后面每新增一个点打印`update画图`。联系之前的内容，首先我们要有一个buffersize为24的ReplaySubject实例。每次订阅都会产生之前24个值，但是这里会有个问题**需要通过订阅来获取旧的值**，订阅完以后其实这个订阅就没有意义了，Replay功能的基础其实就是buffer能力，但Subject提供的这种Replay能力却是cold、lazy的，我们更希望这种replay能力可以更hot，当到达一个bufferSize，就自动把这个bufferSize的数据produce出来，这有点像interval，经过一个时间间隔就produce一个数据，那么有没有类似intervalBuffer这种的静态operator呢：），我们先来搜搜和buffer有关的API。

![](http://i4.buimg.com/567571/1abca9f39849ff09.png)

一看这个bufferCount好像挺适合我们的，估计是buffer了count个数据后，就会产生count个buffer数据。还是看个小栗子

```js
var source$ = Rx.Observable.interval(1000)
var buffer$ = source$.bufferCount(10)
buffer$.subscribe(x => console.log(x))
```

![](http://i1.piimg.com/567571/4cd0740685874167.png)

从图中可以看到每隔10秒打印出了一组长度为10的数字，这显然不是我们想要的，我们希望每秒打印出一组数字，且丢弃最旧的一个数字，看下bufferCount的函数签名，

public bufferCount(bufferSize: number, startBufferEvery: number): Observable<T[]>

bufferCount还接受第二个参数，该参数代表了代表了计算bufferSize的起始位置，第一次达到bufferSize就produce，而从第二次起bufferSize从上一次buffer数据的startBufferEvery开始计算，也就是说当第一次produce后，bufferCount为bufferSize-startBufferEvery，也就是还需要缓存startBufferEvery个才会produce下一个buffer。改造下上一个栗子。

```js
var source$ = Rx.Observable.interval(1000)
var buffer$ = source$.bufferCount(10, 1)
buffer$.subscribe(x => console.log(x))
```

![](http://i1.piimg.com/567571/0123f0610232e4b9.png)

可以看到达到了我们预期。现在我们完成子任务2，这里为了演示方便缓存5个点。

```js
const print = x => console.log('x: ', x)
const intervalEmit$ = Observable.interval(2000)
const fetch$ = intervalEmit$.switchMap(e => Observable.fromPromise(Mock.fetch()))
const app$ = fetch$.bufferCount(5, 1).do('update画图')
app$.subscribe(print)
```

![](http://i1.piimg.com/567571/fffb88c5a68dd65b.png)

OK!

### 子任务3 - 画图

下面我们完成画图功能。

```js
const line = new LineChart(document.getElementById('showAge') as HTMLDivElement)
line.setOptions({
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

line.showLoading()

const now = new Date().getTime()
const span = 2 * 1000
const bufferSize = 12

let counter = 0

const intervalEmit$ = Observable.interval(span)

const fetch$ = intervalEmit$.switchMap(e => Observable.fromPromise(Mock.fetch()))

const app$ = fetch$.bufferCount(bufferSize, 1).map(
    buffer => {
        counter === 0 && line.hideLoading()
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
    line.setOptions({
        series: [{
            data
        }]
    })
})
app$.subscribe()
```

效果如下

![](http://i2.muimg.com/567571/d0c152e1b3ee3768.gif)

## 最后

一个简单的实时监控折线图的demo就完成了，由于本人也是初学rxjs，一些知识点难免会有疏漏，但也尽量做到不误导，相信大家还是会有些收获的。







