// src/pages/tweakscript-ai/App.jsx
import React, { useState, useRef, useEffect } from "react";
import "./app.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

function App() {
  const [selectedText, setSelectedText] = useState("");
  const [notes, setNotes] = useState([]);
  const [editingNote, setEditingNote] = useState({ index: null });
  const [editedText, setEditedText] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [transformedNotes, setTransformedNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const videoRef = useRef();
  const pausedDueToSelection = useRef(false);

  // 🔁 SPACEBAR TOGGLE SPEED LOGIC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        const video = videoRef.current;
        if (video && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
          e.preventDefault(); // Prevent scroll/play toggle
          video.playbackRate = video.playbackRate === 1 ? 2 : 1;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle text selection in transcript panel
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selected = selection.toString();
    if (selected.trim()) {
      setSelectedText(selected);
      // Pause video if playing to allow user to click "Send to AI"
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        pausedDueToSelection.current = true;
      }
    } else {
      setSelectedText("");
    }
  };

  const handleSendToAI = async () => {
    if (!selectedText.trim()) return;

    const timestampMatch = selectedText.match(/\[(\d{1,2}:\d{2})\]/);
    const timestamp = timestampMatch ? timestampMatch[0] : "[00:00]";

    try {
      const res = await fetch(`${BASE_URL}/tag-transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_text: selectedText,
          timestamp
        })
      });

      const data = await res.json();
      const transformed = data.transformed_text || selectedText;

      setNotes((prev) => [...prev, transformed]);
    } catch (err) {
      setNotes((prev) => [...prev, selectedText + " (Error transforming)"]);
    }

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

  // Handle clicks in transcript panel
  const handleTranscriptClick = (startTime) => {
    // Resume video if paused due to text selection
    if (pausedDueToSelection.current && videoRef.current?.paused) {
      videoRef.current.play();
      pausedDueToSelection.current = false;
      return;
    }

    // Jump to timestamp and play if a timestamped line is clicked
    if (videoRef.current && startTime !== undefined) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  };

  const handleTransform = async () => {
    const compiledNotes = notes.join("\n\n");

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/transform`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          notes: compiledNotes
        })
      });

      const data = await response.json();
      setTransformedNotes(data.transformed_notes || "No response.");
    } catch (err) {
      setTransformedNotes("Failed to fetch transformed notes.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="upload-bar">
        <label>
          <input type="file" accept="video/mp4" onChange={handleVideoUpload} />
          Upload Video
        </label>
        <label>
          <input type="file" accept=".json,.txt" onChange={handleTranscriptUpload} />
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
                <p key={index} onClick={() => handleTranscriptClick(line.start)} style={{ cursor: line.start !== undefined ? "pointer" : "default" }}>
                  {line.start !== undefined && (
                    <span className="timestamp">[{formatTime(line.start)}] </span>
                  )}
                  {line.text}
                </p>
              ))}
            </div>
          </div>

          <div className="sticky-popup vertical-buttons">
            <button onClick={handleSendToAI} disabled={!selectedText}>
              Send to AI
            </button>
          </div>
        </div>
      </div>

      <div className="notes-panel">
        <h3>Notes</h3>
        <ul>
          {notes.map((text, idx) => (
            <li key={idx} onClick={() => {
              setEditingNote({ index: idx });
              setEditedText(text);
            }}>
              {editingNote.index === idx ? (
                <input
                  type="text"
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  onBlur={() => {
                    setNotes((prev) => {
                      const updated = [...prev];
                      updated[idx] = editedText;
                      return updated;
                    });
                    setEditingNote({ index: null });
                    setEditedText("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setNotes((prev) => {
                        const updated = [...prev];
                        updated[idx] = editedText;
                        return updated;
                      });
                      setEditingNote({ index: null });
                      setEditedText("");
                    }
                  }}
                  autoFocus
                />
              ) : (
                text
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="transform-section">
        <div className="prompt-panel">
          <textarea
            placeholder="Enter transformation prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button onClick={handleTransform} disabled={loading || !prompt.trim()}>
            {loading ? "Transforming..." : "Transform Notes"}
          </button>
        </div>

        <div className="transformed-notes">
          <h3>Transformed Notes</h3>
          <div className="transformed-content">
            {transformedNotes.split("\n").map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        </div>
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