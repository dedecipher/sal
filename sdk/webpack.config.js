// sdk/webpack.config.js
const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

// ggwave.js 파일 읽기
const ggwaveJsContent = fs.readFileSync(path.resolve(__dirname, 'public/ggwave/ggwave.js'), 'utf-8');

module.exports = {
  entry: './src/index.ts',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "fs": false,
      "path": false
    }
  },
  plugins: [
    // ggwave.wasm 파일 복사
    new CopyPlugin({
      patterns: [
        { from: 'public/ggwave/ggwave.wasm', to: '' },
      ],
    }),
    // ggwave.js 인라인 포함을 위한 설정
    new webpack.BannerPlugin({
      banner: `
// ggwave.js 인라인 포함 
(function(){
  if (typeof window !== "undefined" && !window.ggwave_factory) {
    // wasm 파일 경로 설정
    window.GGWAVE_WASM_URL = new URL("./ggwave.wasm", document.currentScript.src).href;
    
    const ggwaveScript = document.createElement('script');
    ggwaveScript.textContent = ${JSON.stringify(ggwaveJsContent)};
    document.head.appendChild(ggwaveScript);
    console.log("[SAL-SDK] ggwave.js 내장 버전이 로드되었습니다.");
  }
})();`,
      raw: true,
      entryOnly: true,
    }),
  ],
  output: {
    filename: 'sal-sdk.js',
    path: path.resolve(__dirname, 'dist/umd'),
    library: 'salSDK',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  externals: {
    '@solana/web3.js': 'solanaWeb3'
  }
};