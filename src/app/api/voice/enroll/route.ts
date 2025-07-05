import { NextRequest, NextResponse } from 'next/server';
import { EagleProfiler, EagleProfilerEnrollFeedback } from '@picovoice/eagle-node';
import { put } from '@vercel/blob';

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

    // Initialize EagleProfiler
    const accessKey = process.env.PICOVOICE_ACCESS_KEY;
    if (!accessKey) {
      return NextResponse.json({ error: 'Missing Picovoice access key' }, { status: 500 });
    }
    const eagleProfiler = new EagleProfiler(accessKey);

    // Enroll: feed audio in chunks until 100% (for demo, use all at once)
    let percentage = 0;
    let offset = 0;
    while (percentage < 100 && offset < audioData.length) {
      const chunk = audioData.subarray(offset, offset + eagleProfiler.minEnrollSamples);
      const result = await eagleProfiler.enroll(chunk);
      if (result.feedback !== EagleProfilerEnrollFeedback.NONE) {
        return NextResponse.json({ error: `Bad audio: ${EagleProfilerEnrollFeedback[result.feedback]}` }, { status: 400 });
      }
      percentage = result.percentage;
      offset += eagleProfiler.minEnrollSamples;
    }
    if (percentage < 100) {
      return NextResponse.json({ error: 'Not enough audio for enrollment' }, { status: 400 });
    }

    // Export profile
    const speakerProfile = eagleProfiler.export();
    eagleProfiler.release();

    // Store profile in Vercel Blob
    const blobKey = `voice-profiles/${userId}.eagle`; // e.g., voice-profiles/123.eagle
    await put(blobKey, Buffer.from(speakerProfile), { access: 'public' });

    return NextResponse.json({ success: true, message: 'Voice profile enrolled and stored.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
} 