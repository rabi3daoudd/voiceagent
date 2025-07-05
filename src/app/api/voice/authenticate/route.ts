import { NextRequest, NextResponse } from 'next/server';
import { Eagle } from '@picovoice/eagle-node';
import { head } from '@vercel/blob';

// Helper to buffer the request body (audio file)
async function getAudioBuffer(req: NextRequest): Promise<Buffer> {
  const arrayBuffer = await req.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(req: NextRequest) {
  try {
    // Get userId from query or body (for demo, use query)
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Get audio buffer
    const audioBuffer = await getAudioBuffer(req);
    // Convert buffer to Int16Array (assuming 16-bit PCM LE)
    const audioData = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);

    // Fetch stored profile from Vercel Blob
    const blobKey = `voice-profiles/${userId}.eagle`;
    let profileBuffer: Buffer;
    try {
      const meta = await head(blobKey);
      const res = await fetch(meta.downloadUrl);
      if (!res.ok) throw new Error('Failed to fetch profile blob');
      const arrayBuffer = await res.arrayBuffer();
      profileBuffer = Buffer.from(arrayBuffer);
    } catch (e) {
      return NextResponse.json({ error: 'Voice profile not found for user' }, { status: 404 });
    }

    // Initialize Eagle
    const accessKey = process.env.PICOVOICE_ACCESS_KEY;
    if (!accessKey) {
      return NextResponse.json({ error: 'Missing Picovoice access key' }, { status: 500 });
    }
    const eagle = new Eagle(accessKey, new Uint8Array(profileBuffer));

    // Process audio in chunks and collect scores
    let scores: number[] = [];
    let offset = 0;
    while (offset < audioData.length) {
      const chunk = audioData.subarray(offset, offset + eagle.frameLength);
      if (chunk.length < eagle.frameLength) break;
      const score = eagle.process(chunk);
      scores.push(score[0]); // Eagle returns an array, but we have one profile
      offset += eagle.frameLength;
    }
    eagle.release();

    // Calculate average similarity score
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    // You can set a threshold for authentication (e.g., > 0.7)
    const threshold = 0.7;
    const authenticated = avgScore > threshold;

    return NextResponse.json({ authenticated, avgScore });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
} 