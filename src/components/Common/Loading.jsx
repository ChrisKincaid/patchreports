import React from 'react';
import { Loader } from 'lucide-react';

function Loading() {
  return (
    <div className="loading-container">
      <Loader className="loading-spinner" size={48} />
      <p>Loading...</p>
    </div>
  );
}

export default Loading;
