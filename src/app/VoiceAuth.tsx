"use client";
import React, { useRef, useState } from "react";

function encodeWavPcm16(audioBuffer: Float32Array, sampleRate: number): ArrayBuffer {
  // Convert Float32Array [-1, 1] to Int16 PCM
  const buffer = new ArrayBuffer(audioBuffer.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < audioBuffer.length; i++) {
    let s = Math.max(-1, Math.min(1, audioBuffer[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

export default function VoiceAuth() {
  const [recording, setRecording] = useState(false);
  const [mode, setMode] = useState<'enroll' | 'authenticate'>('enroll');
  const [userId, setUserId] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const handleStart = async () => {
    setResult(null);
    setError(null);
    audioChunks.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.current.push(e.data);
    };
    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
      const arrayBuffer = await audioBlob.arrayBuffer();
      // Decode audio to PCM
      const audioCtx = new window.AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      // Downmix to mono if needed
      const channelData = audioBuffer.numberOfChannels > 1
        ? audioBuffer.getChannelData(0)
        : audioBuffer.getChannelData(0);
      // Encode to 16-bit PCM
      const pcmBuffer = encodeWavPcm16(channelData, audioBuffer.sampleRate);
      // Send to backend
      try {
        const endpoint = mode === 'enroll' ? '/api/voice/enroll' : '/api/voice/authenticate';
        const res = await fetch(`${endpoint}?userId=${encodeURIComponent(userId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: pcmBuffer,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Unknown error');
        } else {
          setResult(JSON.stringify(data));
        }
      } catch (err: any) {
        setError(err.message || 'Network error');
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const handleStop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="max-w-md mx-auto p-4 border rounded shadow flex flex-col gap-4">
      <h2 className="text-lg font-bold">Voice Authentication Demo</h2>
      <div className="flex gap-2">
        <label>
          <input
            type="radio"
            checked={mode === 'enroll'}
            onChange={() => setMode('enroll')}
          />
          Sign Up (Enroll)
        </label>
        <label>
          <input
            type="radio"
            checked={mode === 'authenticate'}
            onChange={() => setMode('authenticate')}
          />
          Sign In (Authenticate)
        </label>
      </div>
      <input
        className="border p-2 rounded"
        type="text"
        placeholder="User ID"
        value={userId}
        onChange={e => setUserId(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleStart}
          disabled={recording || !userId}
        >
          Start Recording
        </button>
        <button
          className="bg-gray-400 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={handleStop}
          disabled={!recording}
        >
          Stop Recording
        </button>
      </div>
      {result && <div className="bg-green-100 p-2 rounded">Result: {result}</div>}
      {error && <div className="bg-red-100 p-2 rounded">Error: {error}</div>}
      <p className="text-xs text-gray-500">Audio is recorded at 16kHz mono and sent as raw PCM to the backend.</p>
    </div>
  );
} 