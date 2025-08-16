import React, { useState, useRef, useEffect } from "react";
import "./nonai.css";

function NonAI() {
  const [selectedText, setSelectedText] = useState("");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [videoSrc, setVideoSrc] = useState(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(null);

  const videoRef = useRef();
  const pausedDueToSelection = useRef(false);
  const pausedDueToTyping = useRef(false);
  const textareaRef = useRef(null);
  const shiftHoldTimer = useRef(null);
  const speedSetByShift = useRef(false);

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
        if (textareaRef.current) {
          textareaRef.current.focus();
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

  // Handle note input change to add timestamp for new points
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
      </div>

      <div className="top-section">
        <div className="video-panel">
          <video ref={videoRef} controls width="100%">
            {videoSrc && <source src={videoSrc} type="video/mp4" />}
            Your browser does not support video playback.
          </video>
        </div>

        <div className="notes-panel">
          <h3>Notes</h3>
          <textarea
            ref={textareaRef}
            placeholder="Type your notes here (Shift + Tab to pause/resume video, Shift for 2s for 2x speed, Shift + A to rewind 10s, Shift + D to forward 10s)..."
            value={notes}
            onChange={handleNoteChange}
            autoFocus
          />
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
  );
}

export default NonAI;