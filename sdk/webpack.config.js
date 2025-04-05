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
        { from: 'public/ggwave/ggwave.js', to: '' },
      ],
    }),
    // ggwave.js 인라인 포함을 위한 설정
    new webpack.BannerPlugin({
      banner: `
    // ggwave 모듈 초기화
    (function(){
      if (typeof window !== "undefined" && !window.ggwave_factory) {
        // WASM 파일 위치 설정 - Next.js 호환성 추가
        // 직접 경로 지정 (URL 객체 사용하지 않음)
        const wasmPath = "/_next/static/chunks/ggwave.wasm";
        window.GGWAVE_WASM_URL = wasmPath;
        
        // 모듈이 로드될때까지 대기
        window.GGWAVE_READY = new Promise((resolve, reject) => {
          // ggwave.js 로드 - 직접 경로 지정
          const script = document.createElement('script');
          script.src = "/_next/static/chunks/ggwave.js";
          script.async = true;
          
          script.onload = () => {
            if (window.ggwave_factory) {
              console.log("[SAL-SDK] ggwave.js가 로드되었습니다.");
              resolve();
            } else {
              console.error("[SAL-SDK] ggwave_factory를 찾을 수 없습니다.");
              reject(new Error("ggwave_factory를 찾을 수 없습니다"));
            }
          };
          
          script.onerror = (err) => {
            console.error("[SAL-SDK] ggwave.js 로드 실패:", err);
            reject(new Error("ggwave.js 로드 실패"));
          };
          
          document.head.appendChild(script);
        });
      }
    })();`,
      raw: true,
      entryOnly: true,
    }),
  ],
  output: {
    filename: 'sal-sdk.js',
    path: path.resolve(__dirname, 'dist/umd'),
    library: 'SAL',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  // Solana Web3.js를 외부 의존성에서 제거하고 번들에 포함시킵니다
  externals: {}
};