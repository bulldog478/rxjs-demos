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