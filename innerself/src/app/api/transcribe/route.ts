// ============================================================
// INNER SELF — Transcribe API
// Audio file → OpenAI Whisper → Text
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        console.log(`[Transcribe] Received file: ${file.name} (${file.size} bytes)`);

        // 1. Convert File to Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 2. Save temporarily to disk (OpenAI needs a file path or ReadStream)
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `${uuidv4()}.webm`);
        fs.writeFileSync(tempFilePath, buffer);

        // 3. Send to OpenAI Whisper
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
            language: 'en', // Force English or detect
        });

        // 4. Cleanup
        fs.unlinkSync(tempFilePath);

        /* 
           NOTE: Audio Preservation is OFF to save storage costs.
           If you want to save audio, upload `file` to Supabase Storage here
           and return the public URL.
        */

        console.log('[Transcribe] Success:', transcription.text.substring(0, 50) + '...');

        return NextResponse.json({
            text: transcription.text,
            audio_url: null, // No storage
            duration: 0 // Whisper doesn't return duration, frontend can send it if needed
        });

    } catch (error) {
        console.error('Transcription error:', error);
        return NextResponse.json(
            { error: 'Transcription failed' },
            { status: 500 }
        );
    }
}
