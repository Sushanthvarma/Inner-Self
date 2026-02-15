// ============================================================
// INNER SELF — Transcribe API Route
// Audio blob → Supabase Storage → OpenAI Whisper → transcript
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!_openai) {
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    }
    return _openai;
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File | null;

        if (!audioFile) {
            return NextResponse.json(
                { error: 'No audio file provided' },
                { status: 400 }
            );
        }

        const supabase = getServiceSupabase();
        const fileId = uuidv4();
        const ext = audioFile.type.includes('webm') ? 'webm'
            : audioFile.type.includes('mp4') ? 'mp4'
                : audioFile.type.includes('ogg') ? 'ogg'
                    : 'webm';

        console.log(`[Transcribe] Processing audio: ${(audioFile.size / 1024).toFixed(1)}KB, type: ${audioFile.type}`);

        // Note: User requested NO audio preservation. Skipping Supabase Storage upload.

        // Step 2: Transcribe with Whisper API
        console.log('[Transcribe] Sending to Whisper API...');
        const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
        const whisperFile = new File([audioBuffer], `recording.${ext}`, {
            type: audioFile.type || 'audio/webm',
        });

        const transcription = await getOpenAI().audio.transcriptions.create({
            model: 'whisper-1',
            file: whisperFile,
            language: 'en', // English with Hinglish recognition
            response_format: 'verbose_json',
        });

        const transcript = transcription.text?.trim() || '';
        const durationSec = Math.round(transcription.duration || 0);

        console.log(`[Transcribe] Done. Duration: ${durationSec}s, Text: "${transcript.substring(0, 80)}..."`);

        if (!transcript) {
            return NextResponse.json(
                { error: 'Whisper returned empty transcript' },
                { status: 400 }
            );
        }

        return NextResponse.json({
            transcript,
            audio_url: null, // Explicitly null as we are not saving it
            audio_duration_sec: durationSec,
        });
    } catch (error) {
        console.error('[Transcribe] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Transcription failed' },
            { status: 500 }
        );
    }
}
