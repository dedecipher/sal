const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './audio-app.js',
  output: {
    path: path.resolve(__dirname),
    filename: 'audio-bundle.js'
  },
  resolve: {
    extensions: ['.js', '.ts'],
    fallback: {
      "buffer": require.resolve("buffer/"),
      "crypto": false,
      "stream": false,
      "path": false,
      "fs": false
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
    // ggwave.wasm 파일 복사
    new CopyPlugin({
      patterns: [
        { from: '../sdk/public/ggwave/ggwave.wasm', to: 'public/ggwave' }
      ],
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
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource'
      }
    ]
  },
  devtool: 'source-map'
}; 