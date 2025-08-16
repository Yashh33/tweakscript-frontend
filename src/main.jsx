// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/home/Home';
import App from './pages/tweakscript-ai/App';
import NonAI from './pages/tweakscript-nonai/NonAI';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tweakscript-ai" element={<App />} />
        <Route path="/tweakscript-nonai" element={<NonAI />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);