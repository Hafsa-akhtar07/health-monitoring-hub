import React, { createContext, useContext } from 'react';

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export default SocketContext;
