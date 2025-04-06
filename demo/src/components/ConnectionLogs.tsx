import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ConnectionLog } from '../hooks/useSalSdk';

interface ConnectionLogsProps {
  logs: ConnectionLog[];
  onClear: () => void;
}

export default function ConnectionLogs({ logs, onClear }: ConnectionLogsProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Get appropriate text color based on log type
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'info': return 'text-blue-400';
      case 'request': return 'text-green-400';
      case 'response': return 'text-purple-400';
      case 'error': return 'text-red-400';
      default: return 'text-white';
    }
  };

  // Get type label
  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'info': return 'INFO';
      case 'request': return 'REQ';
      case 'response': return 'RES';
      case 'error': return 'ERR';
      default: return '---';
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
      {/* <div className="p-3 bg-gray-800 text-white font-medium border-b border-gray-700 flex justify-between items-center">
        <span>Connection Logs</span>
        <button 
          onClick={onClear}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Clear
        </button>
      </div> */}
      
      {/* Logs container */}
      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 italic">
            No logs yet
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex"
              >
                <div className={`mr-2 ${getTypeColor(log.type)} font-bold`}>
                  [{getTypeLabel(log.type)}]
                </div>
                <div className="text-white break-all flex-1">
                  {log.text}
                </div>
              </motion.div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
} 