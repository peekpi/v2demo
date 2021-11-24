import React, { useState } from 'react';
import logo from './logo.svg';
import './App.css';
import {DemoAccount} from './demo'

function App() {
  const [period, setPeriod] = useState(0)
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" style={{animation: `App-logo-spin infinite ${period}ms linear`}} />
        <DemoAccount rate={(n:number) =>setPeriod(n)}></DemoAccount>
      </header>
      <body>
        <iframe width="90%" height="800" src="https://miro.com/app/live-embed/o9J_lgimEbI=/?moveToViewport=-651,-291,1262,581" frameBorder="0" scrolling="no" allowFullScreen></iframe></body>
    </div>
  );
}

export default App;
