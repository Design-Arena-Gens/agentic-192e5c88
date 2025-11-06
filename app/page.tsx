'use client';

import { useState, useRef } from 'react';

interface VideoFrame {
  timestamp: number;
  dataUrl: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setResult(null);
    }
  };

  const extractAudioFromVideo = async (videoFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      video.src = URL.createObjectURL(videoFile);
      video.muted = false;
      video.crossOrigin = 'anonymous';

      video.onloadedmetadata = async () => {
        try {
          // Use MediaElementAudioSourceNode from the main AudioContext
          const source = audioContext.createMediaElementSource(video);
          const destination = audioContext.createMediaStreamDestination();
          source.connect(destination);

          const mediaRecorder = new MediaRecorder(destination.stream);
          const audioChunks: Blob[] = [];

          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          };

          mediaRecorder.start();
          await video.play();

          video.onended = () => {
            mediaRecorder.stop();
          };

          // Fallback: stop recording after video duration
          setTimeout(() => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              video.pause();
            }
          }, video.duration * 1000 + 1000);
        } catch (err) {
          reject(err);
        }
      };

      video.onerror = reject;
    });
  };


  const extractFramesFromVideo = async (videoFile: File): Promise<VideoFrame[]> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current || document.createElement('video');
      const canvas = canvasRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }

      video.src = URL.createObjectURL(videoFile);
      video.crossOrigin = 'anonymous';

      const frames: VideoFrame[] = [];
      const captureInterval = 5; // Capture every 5 seconds

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        let currentTime = 0;

        const captureFrame = () => {
          if (currentTime >= video.duration) {
            URL.revokeObjectURL(video.src);
            resolve(frames);
            return;
          }

          video.currentTime = currentTime;
        };

        video.onseeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');

          frames.push({
            timestamp: Math.floor(currentTime),
            dataUrl,
          });

          currentTime += captureInterval;
          captureFrame();
        };

        captureFrame();
      };

      video.onerror = reject;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setProcessing(true);
    setProgress('Processing video locally...');
    setError('');

    try {
      setProgress('Extracting audio from video...');
      const audioDataUrl = await extractAudioFromVideo(file);

      setProgress('Extracting frames from video...');
      const frames = await extractFramesFromVideo(file);

      setProgress('Sending to server for AI processing...');

      const response = await fetch('/api/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioDataUrl,
          frames,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to process video: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'progress') {
                setProgress(data.message);
              } else if (data.type === 'complete') {
                setResult(data.data);
                setProgress('Complete!');
              } else if (data.type === 'error') {
                setError(data.message);
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const downloadDocument = async () => {
    if (!result) return;

    try {
      const response = await fetch('/api/generate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result),
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'transcription.html';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to generate document');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Video Transcription Agent
          </h1>
          <p className="text-gray-600 mb-8">
            Upload a video to extract slides and transcribe audio
          </p>

          <form onSubmit={handleSubmit} className="mb-8">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-upload"
                disabled={processing}
              />
              <label
                htmlFor="video-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <svg
                  className="w-16 h-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-lg text-gray-600">
                  {file ? file.name : 'Click to upload video'}
                </span>
                <span className="text-sm text-gray-400 mt-2">
                  MP4, MOV, AVI, or any video format
                </span>
              </label>
            </div>

            {file && (
              <button
                type="submit"
                disabled={processing}
                className="mt-6 w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Processing...' : 'Process Video'}
              </button>
            )}
          </form>

          {progress && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">{progress}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Results</h2>
                <button
                  onClick={downloadDocument}
                  className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Download Document
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">
                  Transcription
                </h3>
                <div className="prose max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {result.transcription}
                  </p>
                </div>
              </div>

              {result.slides && result.slides.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 text-gray-800">
                    Extracted Slides ({result.slides.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {result.slides.map((slide: any, idx: number) => (
                      <div key={idx} className="border rounded-lg overflow-hidden bg-white">
                        <img
                          src={slide.image}
                          alt={`Slide ${idx + 1}`}
                          className="w-full h-auto"
                        />
                        <div className="p-2 text-sm text-gray-600">
                          Slide {idx + 1} - {slide.timestamp}s
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden elements for video processing */}
      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </main>
  );
}
