import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface VideoFrame {
  timestamp: number;
  dataUrl: string;
}

async function transcribeAudio(audioDataUrl: string): Promise<string> {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Convert data URL to buffer
    const base64Audio = audioDataUrl.split(',')[1];
    const audioBuffer = Buffer.from(base64Audio, 'base64');

    // Create a file-like object for OpenAI
    const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mp3' });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text',
    });

    return transcription as string;
  } catch (error: any) {
    console.error('Transcription error:', error);
    return `[Transcription unavailable: ${error.message}]`;
  }
}

async function analyzeFrame(frameDataUrl: string): Promise<boolean> {
  try {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Is this a presentation slide or content-rich frame? Answer with just YES or NO.',
            },
            {
              type: 'image_url',
              image_url: {
                url: frameDataUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 10,
    });

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
    return answer === 'YES';
  } catch (error) {
    console.error('Frame analysis error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body = await request.json();
        const { audioDataUrl, frames } = body;

        if (!audioDataUrl || !frames) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Missing audio or frames data' })}\n\n`));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: 'Transcribing audio...' })}\n\n`));
        const transcription = await transcribeAudio(audioDataUrl);

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: 'Analyzing frames for slides...' })}\n\n`));

        const slides = [];

        for (let i = 0; i < Math.min(frames.length, 20); i++) {
          const frame = frames[i];
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', message: `Analyzing frame ${i + 1}/${Math.min(frames.length, 20)}...` })}\n\n`));

          const isSlide = await analyzeFrame(frame.dataUrl);

          if (isSlide) {
            slides.push({
              image: frame.dataUrl,
              timestamp: frame.timestamp,
            });
          }
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          data: {
            transcription,
            slides,
          }
        })}\n\n`));

      } catch (error: any) {
        console.error('Processing error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error.message || 'Processing failed'
        })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
