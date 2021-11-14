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
    </div>
  );
}

export default App;
