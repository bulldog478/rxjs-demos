var path = require('path')
module.exports = {
    context: __dirname + "/src",
    entry: './app.ts',
    output: {
        filename: '[name].bundle.js',
        path: __dirname + '/dist',
        publicPath: '/dist'
    },
    module: {
        rules: [{
            test: /\.ts$/,
            use: 'awesome-typescript-loader'
        }]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },

    devtool: 'source-map',

    devServer: {
        contentBase: __dirname,
        port: 9001,
        publicPath: '/dist',
        filename: '[name].bundle.js',
        watchContentBase: true,
        watchOptions: {
            aggregateTimeout: 300,
            poll: 1000
        }
    }
}