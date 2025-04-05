const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './app.js',
  output: {
    path: path.resolve(__dirname),
    filename: 'bundle.js'
  },
  resolve: {
    extensions: ['.js', '.ts'],
    fallback: {
      "buffer": require.resolve("buffer/")
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.DefinePlugin({
      // 빈 process 객체 생성
      'process': '{}',
      'process.env': JSON.stringify({}),
      'process.browser': true,
      'process.version': JSON.stringify(''),
      'process.nextTick': '(function (cb) { setTimeout(cb, 0) })'
    }),
  ],
  module: {
    rules: [
      {
        test: /\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-typescript']
          }
        }
      }
    ]
  },
  devtool: 'source-map'
}; 