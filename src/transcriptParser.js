// File: frontend/src/transcriptParser.js

function parseTimestamp(timeString) {
  const match = timeString.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;
  const [, min, sec, hr] = match.map(Number);
  return (hr || 0) * 3600 + (min || 0) * 60 + (sec || 0);
}

export function parseTranscriptFile(rawText, fileName) {
  if (fileName.endsWith(".json")) {
    try {
      const parsed = JSON.parse(rawText);
      return parsed.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text
      }));
    } catch (e) {
      alert("Invalid JSON format.");
      return [];
    }
  }

  if (fileName.endsWith(".srt")) {
    const segments = rawText.split("\n\n");
    return segments.map(seg => {
      const lines = seg.trim().split("\n");
      if (lines.length >= 3) {
        const [index, timeLine, ...textLines] = lines;
        const [startStr, endStr] = timeLine.split(" --> ");
        return {
          start: parseTimestamp(startStr),
          end: parseTimestamp(endStr),
          text: textLines.join(" ")
        };
      }
      return null;
    }).filter(Boolean);
  }

  // Fallback: generic plain text formats with timestamps like [mm:ss], (mm:ss), mm:ss)
  const lines = rawText.split("\n");
  const parsedLines = [];

  for (let line of lines) {
    const match = line.match(/[\[\(]?(\d{1,2}:\d{2})[\]\)]?/);
    if (match) {
      const start = parseTimestamp(match[1]);
      const text = line.replace(match[0], "").trim();
      parsedLines.push({
        start,
        end: start + 4,
        text
      });
    }
  }

  return parsedLines;
}
