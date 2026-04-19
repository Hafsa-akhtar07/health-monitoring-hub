 //  import React from 'react';
   //import ReactDOM from 'react-dom/client';
   //import './index.css';
   //import App from './App';

   //const root = ReactDOM.createRoot(document.getElementById('root'));
   //root.render(
     //<React.StrictMode>
      // <App />
     //</React.StrictMode>
   //);
   
   // src/index.js or src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import NavigationWrapper from './components/NavigationWrapper';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <NavigationWrapper />
  </React.StrictMode>
);