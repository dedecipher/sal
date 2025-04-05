import React, { useState } from 'react';

interface HostConnectFormProps {
  onConnect: (hostName: string, phoneNumber: string) => void;
  isConnecting: boolean;
  error: string | null;
}

const HostConnectForm: React.FC<HostConnectFormProps> = ({ 
  onConnect, 
  isConnecting, 
  error 
}) => {
  const [hostName, setHostName] = useState<string>('demohost');
  const [phoneNumber, setPhoneNumber] = useState<string>('+12345678901');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hostName.trim()) {
      onConnect(hostName.trim(), phoneNumber.trim());
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <h2 className="text-lg font-semibold mb-4">Connect to Host</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" htmlFor="hostName">
            Host Name
          </label>
          <input
            id="hostName"
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter host name"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" htmlFor="phoneNumber">
            Phone Number
          </label>
          <input
            id="phoneNumber"
            type="text"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+12345678901"
          />
          <p className="text-xs text-gray-400 mt-1">
            Demo purposes - typically provided by the host
          </p>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-900/30 border border-red-700 rounded-md">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isConnecting || !hostName.trim()}
          className={`w-full py-2 px-4 rounded-md font-medium ${
            isConnecting || !hostName.trim()
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  );
};

export default HostConnectForm; 