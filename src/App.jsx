import React, { useState, useRef } from "react";
import "./App.css";

const categories = [
  "Open Point",
  "Pain Point",
  "Requirement Point",
  "Client Current Process"
];

function App() {
  const [selectedText, setSelectedText] = useState("");
  const [notes, setNotes] = useState({});
  const [transcript, setTranscript] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);

  const videoRef = useRef();
  const pausedDueToSelection = useRef(false);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selected = selection.toString();
    if (selected.trim()) {
      setSelectedText(selected);

      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        pausedDueToSelection.current = true;
      }
    } else {
      setSelectedText("");
    }
  };

  const handleCategoryClick = (category) => {
    if (!selectedText.trim()) return;
    setNotes((prev) => ({
      ...prev,
      [category]: [...(prev[category] || []), selectedText]
    }));
    setSelectedText("");
    window.getSelection().removeAllRanges();
  };

  const parseFlexibleTimestamp = (line) => {
    const regex = /\[(\d{1,2}):(\d{2})\]|\((\d{1,2}):(\d{2})\)/;
    const match = line.match(regex);
    if (match) {
      const min = parseInt(match[1] || match[3]);
      const sec = parseInt(match[2] || match[4]);
      const time = min * 60 + sec;
      const text = line.replace(regex, "").trim();
      return { start: time, text };
    }
    return { text: line.trim() };
  };

  const handleTranscriptUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    const isJson = file.name.endsWith(".json");
    const isTxt = file.name.endsWith(".txt");

    reader.onload = (event) => {
      const content = event.target.result;
      try {
        if (isJson) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (parsed[0]?.text && typeof parsed[0]?.start === "number") {
              setTranscript(parsed);
            } else {
              setTranscript(parsed.map((line) => parseFlexibleTimestamp(line)));
            }
          } else {
            alert("JSON format should be an array.");
          }
        } else if (isTxt) {
          const lines = content.split("\n").filter((line) => line.trim() !== "");
          setTranscript(lines.map((line) => parseFlexibleTimestamp(line)));
        } else {
          alert("Unsupported file type. Please upload .json or .txt");
        }
      } catch (err) {
        alert("Error parsing file: " + err.message);
      }
    };

    reader.readAsText(file);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setVideoSrc(url);
  };

  const handleTranscriptClick = (startTime) => {
    if (pausedDueToSelection.current && videoRef.current?.paused) {
      videoRef.current.play();
      pausedDueToSelection.current = false;
      return;
    }

    if (videoRef.current && startTime !== undefined) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  };

  return (
    <div className="app-container">
      <div className="upload-bar">
        <label>
          <input
            type="file"
            accept="video/mp4"
            onChange={handleVideoUpload}
            style={{ marginRight: "10px" }}
          />
          Upload Video
        </label>
        <label>
          <input
            type="file"
            accept=".json,.txt"
            onChange={handleTranscriptUpload}
          />
          Upload Transcript
        </label>
      </div>

      <div className="top-section">
        <div className="video-panel">
          <video ref={videoRef} controls width="100%">
            {videoSrc && <source src={videoSrc} type="video/mp4" />}
            Your browser does not support video playback.
          </video>
        </div>

        <div className="transcript-container">
          <div className="transcript-panel" onMouseUp={handleMouseUp}>
            <h3>Transcript</h3>
            <div className="transcript-text">
              {transcript.map((line, index) => (
                <p
                  key={index}
                  onClick={() => handleTranscriptClick(line.start)}
                  style={{
                    cursor:
                      line.start !== undefined ? "pointer" : "default"
                  }}
                >
                  {line.start !== undefined && (
                    <span className="timestamp">
                      [{formatTime(line.start)}]{" "}
                    </span>
                  )}
                  {line.text}
                </p>
              ))}
            </div>
          </div>

          <div className="sticky-popup vertical-buttons">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                disabled={!selectedText}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="notes-panel">
        <h3>Notes</h3>
        {categories.map((cat) => (
          <div key={cat} className="notes-category">
            <h4>{cat}</h4>
            <ul>
              {(notes[cat] || []).map((text, idx) => (
                <li key={idx}>{text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${min}:${sec}`;
}

export default App;
