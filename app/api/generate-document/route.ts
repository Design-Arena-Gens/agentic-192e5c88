import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { transcription, slides } = data;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Transcription Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f9fafb;
    }
    .container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1 {
      color: #1f2937;
      border-bottom: 3px solid #4f46e5;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    h2 {
      color: #374151;
      margin-top: 40px;
      margin-bottom: 20px;
    }
    .transcription {
      background: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #4f46e5;
      white-space: pre-wrap;
      line-height: 1.8;
    }
    .slides {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 30px;
      margin-top: 30px;
    }
    .slide {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .slide img {
      width: 100%;
      height: auto;
      display: block;
    }
    .slide-info {
      padding: 15px;
      background: #f9fafb;
      font-size: 14px;
      color: #6b7280;
    }
    .timestamp {
      font-weight: 600;
      color: #4f46e5;
    }
    @media print {
      body {
        background: white;
      }
      .slide {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Video Transcription Report</h1>
    <p style="color: #6b7280; font-size: 14px;">Generated on ${new Date().toLocaleString()}</p>

    <h2>Transcription</h2>
    <div class="transcription">${transcription}</div>

    ${slides && slides.length > 0 ? `
      <h2>Extracted Slides (${slides.length})</h2>
      <div class="slides">
        ${slides.map((slide: any, idx: number) => `
          <div class="slide">
            <img src="${slide.image}" alt="Slide ${idx + 1}" />
            <div class="slide-info">
              <strong>Slide ${idx + 1}</strong> -
              <span class="timestamp">Timestamp: ${slide.timestamp}s</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : '<p style="color: #6b7280;">No slides detected in this video.</p>'}
  </div>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': 'attachment; filename="transcription.html"',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to generate document' },
      { status: 500 }
    );
  }
}
