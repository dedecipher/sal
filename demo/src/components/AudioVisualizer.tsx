import React, { useEffect, useRef } from 'react';
import AudioMotionAnalyzer from 'audiomotion-analyzer';

interface AudioVisualizerProps {
  audioContext: AudioContext | null;
  audioSource: MediaStreamAudioSourceNode | null;
}

export default function AudioVisualizer({ audioContext, audioSource }: AudioVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const analyzerRef = useRef<AudioMotionAnalyzer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !audioContext) return;

    // Initialize AudioMotionAnalyzer with improved settings
    const analyzer = new AudioMotionAnalyzer(containerRef.current, {
      audioCtx: audioContext,
      height: 250, // 높이 증가
      width: containerRef.current.clientWidth,
      showScaleY: true,
      showPeaks: true,
      showBgColor: true,
      bgAlpha: 0.3, // 배경 투명도 감소
      gradient: 'prism', // 색상 변경
      lumiBars: true,
      reflexRatio: 0.3, // 반사 효과 증가
      reflexAlpha: 0.4, // 반사 투명도 증가
      reflexBright: 1.2, // 반사 밝기 증가
      reflexFit: true,
      lineWidth: 2.5, // 선 두께 증가
      fillAlpha: 0.9, // 채우기 투명도 증가
      frequencyScale: 'log',
      smoothing: 0.6, // 원활함 감소 (더 반응성 있게)
      spinSpeed: 0,
      showFPS: false,
      useCanvas: true,
      mode: 3, // 3 = 바 그래프 모드
      barSpace: 0.4, // 바 사이 간격 조정
      ledBars: true, // LED 스타일의 바
      ansiBands: false, // ISO/ANSI 주파수 밴드 사용 안 함
      maxFreq: 16000, // 최대 주파수 제한
      minFreq: 20, // 최소 주파수
      channelLayout: 'single', // 단일 채널 레이아웃
      mirror: true, // 미러 효과
      weightingFilter: 'A', // A-weighting 필터
      onCanvasDraw: null,
      onCanvasResize: null
    });

    analyzerRef.current = analyzer;

    // Clean up function
    return () => {
      if (analyzerRef.current) {
        analyzerRef.current.destroy();
        analyzerRef.current = null;
      }
    };
  }, [audioContext]);

  // Connect audio source when available
  useEffect(() => {
    if (!analyzerRef.current || !audioSource) return;
    
    try {
      // 오디오 소스를 AudioMotionAnalyzer에 연결
      audioSource.connect(analyzerRef.current.analyser);
      
      // 시각화 시작
      analyzerRef.current.setOptions({
        mode: 5, // 웨이브폼 모드로 변경 (오디오 전송 시)
        lineWidth: 3,
        fillAlpha: 0.5,
        smoothing: 0.5,
      });
    } catch (error) {
      console.error('Failed to connect audio source to analyzer:', error);
    }
    
    // Return cleanup function
    return () => {
      if (audioSource && analyzerRef.current?.analyser) {
        try {
          audioSource.disconnect(analyzerRef.current.analyser);
        } catch (error) {
          console.error('Failed to disconnect audio source:', error);
        }
      }
    };
  }, [audioSource]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && analyzerRef.current) {
        analyzerRef.current.width = containerRef.current.clientWidth;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="w-full bg-black/90 rounded-xl overflow-hidden shadow-lg border border-gray-700">
      <div className="p-2 bg-gray-800 text-white text-sm font-semibold flex justify-between items-center">
        <span>Audio Visualization</span>
        <div className="flex gap-2">
          <button 
            onClick={() => analyzerRef.current?.setOptions({ mode: 5 })} 
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
          >
            Waveform
          </button>
          <button 
            onClick={() => analyzerRef.current?.setOptions({ mode: 3 })} 
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
          >
            Bars
          </button>
        </div>
      </div>
      <div 
        ref={containerRef} 
        className="w-full h-[250px] bg-black"
      />
    </div>
  );
} 