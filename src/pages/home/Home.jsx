// src/pages/home/Home.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './home.css';

function Home() {
  return (
    <div className="home-container">
      <h1>Welcome to Tweakscript</h1>
      <div className="button-container">
        <Link to="/tweakscript-ai">
          <button className="home-button">Tweakscript + AI</button>
        </Link>
        <Link to="/tweakscript-nonai">
          <button className="home-button">Tweakscript + NonAI</button>
        </Link>
      </div>
    </div>
  );
}

export default Home;