// src/pages/tweakscript-nonai/NonAI.jsx
import React, { useState, useRef, useEffect } from "react";
import "./nonai.css";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

function NonAI() {
  const [selectedText, setSelectedText] = useState("");
  const [notes, setNotes] = useState(""); // For Notes panel
  const [inputNotes, setInputNotes] = useState(""); // For Input panel
  const [transcript, setTranscript] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(null);
  const [outputs, setOutputs] = useState([]);
  const [showPopup, setShowPopup] = useState(false);

  const videoRef = useRef();
  const pausedDueToSelection = useRef(false);
  const pausedDueToTyping = useRef(false);
  const notesTextareaRef = useRef(null); // Ref for Notes panel
  const inputTextareaRef = useRef(null); // Ref for Input panel
  const shiftHoldTimer = useRef(null);
  const speedSetByShift = useRef(false);
  const scrollPosition = useRef(0); // To store and restore scroll position

  // 🔁 SPACEBAR TOGGLE SPEED LOGIC + NEW SHORTCUTS
  useEffect(() => {
    let shiftHeldStart = null;

    const handleKeyDown = (e) => {
      if (e.code === "Space" && document.activeElement.tagName !== "TEXTAREA") {
        e.preventDefault(); // Prevent scroll/play toggle
        const video = videoRef.current;
        if (video) {
          video.playbackRate = video.playbackRate === 1 ? 2 : 1;
          speedSetByShift.current = false; // Reset flag if spacebar is used
        }
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        if (videoRef.current) {
          if (!videoRef.current.paused && !pausedDueToSelection.current) {
            videoRef.current.pause();
            pausedDueToTyping.current = true;
          } else if (pausedDueToTyping.current) {
            videoRef.current.play();
            pausedDueToTyping.current = false;
          }
        }
        // Ensure textarea stays focused
        if (notesTextareaRef.current) {
          notesTextareaRef.current.focus();
        } else if (inputTextareaRef.current) {
          inputTextareaRef.current.focus();
        }
      } else if (e.key === "Shift") {
        if (!shiftHeldStart) {
          shiftHeldStart = Date.now();
          shiftHoldTimer.current = setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.playbackRate = 2;
              speedSetByShift.current = true; // Mark speed as set by Shift
            }
            shiftHeldStart = null;
          }, 2000); // 2 seconds
        }
      } else if (e.shiftKey && e.key.toLowerCase() === "a" && videoRef.current) {
        e.preventDefault();
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      } else if (e.shiftKey && e.key.toLowerCase() === "d" && videoRef.current) {
        e.preventDefault();
        videoRef.current.currentTime = Math.min(
          videoRef.current.duration || Infinity,
          videoRef.current.currentTime + 10
        );
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "Shift") {
        shiftHeldStart = null;
        clearTimeout(shiftHoldTimer.current);
        if (videoRef.current && speedSetByShift.current) {
          videoRef.current.playbackRate = 1; // Reset to 1x on Shift release
          speedSetByShift.current = false;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      clearTimeout(shiftHoldTimer.current);
    };
  }, []);

  // Sync transcript with video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !transcript.length) return;

    const updateCurrentLine = () => {
      const currentTime = video.currentTime;
      const index = transcript.findIndex(
        (line, i) =>
          line.start !== undefined &&
          currentTime >= line.start &&
          (i === transcript.length - 1 || currentTime < transcript[i + 1]?.start)
      );
      setCurrentLineIndex(index >= 0 ? index : null);
    };

    video.addEventListener("timeupdate", updateCurrentLine);
    return () => video.removeEventListener("timeupdate", updateCurrentLine);
  }, [transcript]);

  // Handle text selection in transcript panel
  const handleMouseUp = () => {
    const selection = window.getSelection();
    const selected = selection.toString();
    if (selected.trim()) {
      setSelectedText(selected);
      // Pause video if playing to allow user to interact
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        pausedDueToSelection.current = true;
      }
    } else {
      setSelectedText("");
    }
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

  // Handle note input change for Notes panel
  const handleNoteChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    const currentChar = newValue[cursorPos - 1];

    // Check if starting a new point (first char after \n\n or at start)
    const isNewPoint =
      cursorPos === 1 ||
      (cursorPos >= 2 && newValue.slice(0, cursorPos - 1).endsWith("\n\n"));

    if (isNewPoint && currentChar && videoRef.current) {
      const timestamp = formatTime(Math.floor(videoRef.current.currentTime));
      const beforeCursor = newValue.slice(0, cursorPos - 1);
      const afterCursor = newValue.slice(cursorPos - 1);
      setNotes(`${beforeCursor}[${timestamp}] ${afterCursor}`);
    } else {
      setNotes(newValue);
    }
    // Restore scroll position after state update
    setTimeout(() => window.scrollTo(0, scrollPosition.current), 0);
  };

  // Handle input change for Input panel
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    const currentChar = newValue[cursorPos - 1];

    // Check if starting a new point (first char after \n\n or at start)
    const isNewPoint =
      cursorPos === 1 ||
      (cursorPos >= 2 && newValue.slice(0, cursorPos - 1).endsWith("\n\n"));

    if (isNewPoint && currentChar && videoRef.current) {
      const timestamp = formatTime(Math.floor(videoRef.current.currentTime));
      const beforeCursor = newValue.slice(0, cursorPos - 1);
      const afterCursor = newValue.slice(cursorPos - 1);
      setInputNotes(`${beforeCursor}[${timestamp}] ${afterCursor}`);
    } else {
      setInputNotes(newValue);
    }
    // Restore scroll position after state update
    setTimeout(() => window.scrollTo(0, scrollPosition.current), 0);
  };

  // Handle Shift + Enter to send input note to LLM
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey && inputNotes.trim()) {
      e.preventDefault();
      const endTime = videoRef.current ? Math.floor(videoRef.current.currentTime) : 0;
      const endTimestamp = formatTime(endTime);
      const fullNote = `${inputNotes}\n[${endTimestamp}]`;
      sendToLLM(fullNote, endTime);
      setInputNotes("");
    }
  };

  // Parse timestamps from note text
  const parseTimestampsFromNote = (text) => {
    const regex = /\[(\d{2}):(\d{2})\]/g;
    let matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      matches.push(min * 60 + sec);
    }
    return matches;
  };

  // Send note and transcript segment to LLM
  const sendToLLM = async (fullNote, endTime) => {
    const timestamps = parseTimestampsFromNote(fullNote);
    if (timestamps.length === 0) return;

    const startTime = Math.min(...timestamps);
    const segment = transcript
      .filter((line) => line.start >= startTime && line.start < endTime)
      .map((line) => line.text)
      .join("\n");

    // const llmPrompt = "ewrite the Rnote in a clear, concise manner, identifying common terms from the notes and the context from the transcript to make it professional third-person. Also append the timestamps too.";

    const llmPrompt = "You are a professional note-taking assistant for video calls, specializing in rewriting quick user notes into structured summaries using context from the transcript.\n\nUser Notes: {notes}\n\nTranscript Segment: {transcript}\n\nInstructions:\n- The user has noted important keywords from the video. Use the transcript segment (which includes timestamps) to add relevant context to these keywords.\n- Create a concise headline that summarizes the noted keywords with added context in third-person format.\n- Follow the headline with 1-4 bullet points, each in third-person, with better sentence formation, focusing on the noted keywords and transcript context.\n- Prepend the headline with the starting timestamp from the notes.\n- Prepend each bullet point with a timestamp from the transcript that best matches the content.\n- Stick strictly to the content in the notes and transcript; do not add, remove, or invent information.\n- Output format exactly as follows:\n\nHeadline: [Starting Timestamp] Summary Headline\n\n- [Timestamp] Bullet point 1\n- [Timestamp] Bullet point 2\n...";

    try {
      const response = await fetch(`${BASE_URL}/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: llmPrompt,
          notes: `Notes: ${fullNote}\nTranscript: ${segment}`,
        }),
      });

      const data = await response.json();
      setOutputs((prev) => [...prev, data.transformed_notes || "No response"]);
    } catch (err) {
      setOutputs((prev) => [...prev, "Error sending to LLM"]);
    }
  };

  // Save and restore scroll position on focus
  useEffect(() => {
    const handleFocus = () => {
      scrollPosition.current = window.scrollY;
    };
    const textareas = [notesTextareaRef, inputTextareaRef];
    textareas.forEach((ref) => {
      if (ref.current) {
        ref.current.addEventListener("focus", handleFocus);
      }
    });
    return () => {
      textareas.forEach((ref) => {
        if (ref.current) {
          ref.current.removeEventListener("focus", handleFocus);
        }
      });
    };
  }, []);

  // Open popup
  const handleOpenPopup = () => {
    setShowPopup(true);
  };

  // Close popup
  const handleClosePopup = () => {
    setShowPopup(false);
  };

  function formatTime(seconds) {
    const min = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${min}:${sec}`;
  }

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
        <button onClick={handleOpenPopup}>See Generated Notes</button>
      </div>

      <div className="main-content">
        <div className="top-section">
          <div className="video-panel">
            <video ref={videoRef} controls width="100%">
              {videoSrc && <source src={videoSrc} type="video/mp4" />}
              Your browser does not support video playback.
            </video>
          </div>

          <div className="notes-container">
            <div className="notes-panel">
              <h3>Notes</h3>
              <textarea
                ref={notesTextareaRef}
                placeholder="Type your notes here (Shift + Tab to pause/resume video, Shift for 2s for 2x speed, Shift + A to rewind 10s, Shift + D to forward 10s)..."
                value={notes}
                onChange={handleNoteChange}
                autoFocus
              />
            </div>

            <div className="input-panel">
              <h3>Input</h3>
              <textarea
                ref={inputTextareaRef}
                placeholder="Type your note here (Shift + Enter to send to AI)..."
                value={inputNotes}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
              />
            </div>
          </div>
        </div>

        <div className="transcript-panel">
          <h3>Transcript</h3>
          <div className="transcript-text">
            {transcript.map((line, index) => (
              <p
                key={index}
                onClick={() => handleTranscriptClick(line.start)}
                className={index === currentLineIndex ? "current-line" : ""}
                style={{ cursor: line.start !== undefined ? "pointer" : "default" }}
                ref={index === currentLineIndex ? (el) => {
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                } : null}
              >
                {line.start !== undefined && (
                  <span className="timestamp">[{formatTime(line.start)}] </span>
                )}
                {line.text}
              </p>
            ))}
          </div>
        </div>
      </div>

      {showPopup && (
        <div className="popup-overlay" onClick={handleClosePopup}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <h3>Generated Notes</h3>
            <div className="popup-output">
              {outputs.map((out, idx) => (
                <p key={idx}>{out}</p>
              ))}
            </div>
            <button onClick={handleClosePopup}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NonAI;