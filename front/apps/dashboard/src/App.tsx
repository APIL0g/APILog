/**
 * Sample dashboard shell used while the analytics UI is under development.
 * 遺꾩꽍 UI瑜?媛쒕컻?섎뒗 ?숈븞 ?ъ슜???섑뵆 ??쒕낫???몄엯?덈떎.
 */

import { useState } from "react";

import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";

import "./App.css";

function App() {
  // Track a simple interaction counter to demonstrate reactivity.
  // 諛섏쓳???숈옉??蹂댁뿬二쇨린 ?꾪븳 媛꾨떒???곹샇?묒슜 移댁슫?곕? 異붿쟻?⑸땲??
  const [count, setCount] = useState(0);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button type="button" onClick={() => setCount((value) => value + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;

