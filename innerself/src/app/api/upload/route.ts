
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST: Upload and extract text (NO AI PROCESSING HERE)
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const supabase = getServiceSupabase();
        const docId = uuidv4();
        const fileType = file.name.split('.').pop()?.toLowerCase() || 'unknown';

        // Create document record (Pending Analysis)
        await supabase.from('uploaded_documents').insert({
            id: docId,
            file_name: file.name,
            file_type: fileType,
            processing_status: 'pending', // Compatible with existing check constraint
        });

        let extractedText = '';

        try {
            if (fileType === 'txt') {
                extractedText = await file.text();
            } else if (fileType === 'pdf') {
                const buffer = Buffer.from(await file.arrayBuffer());
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    const pdfParse = require('pdf-parse');
                    const pdfData = await pdfParse(buffer);
                    extractedText = pdfData.text || '';
                    // If PDF is scanned/image-based, text will be empty
                    if (!extractedText.trim() || extractedText.trim().length < 20) {
                        // Convert to base64 for vision AI processing
                        const base64 = buffer.toString('base64');
                        extractedText = `[IMAGE:application/pdf:${base64}]`;
                        console.log(`[Upload] PDF "${file.name}" has no extractable text, falling back to vision processing`);
                    }
                } catch (pdfError: any) {
                    console.error('pdf-parse failed, falling back to vision:', pdfError.message);
                    // Fallback: send as image for vision AI to read
                    const base64 = buffer.toString('base64');
                    extractedText = `[IMAGE:application/pdf:${base64}]`;
                }
            } else if (fileType === 'docx' || fileType === 'doc') {
                // Robust text extraction from docx using mammoth
                const buffer = Buffer.from(await file.arrayBuffer());
                const result = await mammoth.extractRawText({ buffer });
                extractedText = result.value.trim();

                if (result.messages.length > 0) {
                    console.log('Mammoth messages:', result.messages);
                }

                if (!extractedText || extractedText.length < 50) {
                    // Fallback check: if mammoth returns nothing, maybe it's an image-heavy doc?
                    // But usually it returns text.
                    if (!extractedText) {
                        extractedText = `[Document: ${file.name}] Content could not be extracted (Empty).`;
                    }
                }
            } else if (['jpg', 'jpeg', 'png', 'webp'].includes(fileType)) {
                // For images, we store the base64 to send to vision model later
                const buffer = Buffer.from(await file.arrayBuffer());
                const base64 = buffer.toString('base64');
                const mediaType = fileType === 'jpg' ? 'image/jpeg' :
                    fileType === 'jpeg' ? 'image/jpeg' :
                        fileType === 'png' ? 'image/png' : 'image/webp';
                extractedText = `[IMAGE:${mediaType}:${base64}]`;
            } else {
                extractedText = await file.text();
            }
        } catch (extractError: any) {
            console.error('Text extraction error:', extractError);
            // Try one more fallback: read as raw text
            try {
                extractedText = await file.text();
                if (!extractedText || extractedText.length < 10) throw new Error('Empty fallback');
                console.log(`[Upload] Fallback text extraction succeeded for ${file.name}`);
            } catch {
                await supabase.from('uploaded_documents').update({
                    processing_status: 'failed',
                }).eq('id', docId);
                return NextResponse.json({
                    error: `Failed to extract text from ${fileType.toUpperCase()} file: ${extractError.message || 'Unknown error'}. Try uploading as an image (JPG/PNG) instead.`,
                }, { status: 422 });
            }
        }

        // Update DB with extracted text
        // For binary data (images/PDFs as base64), allow up to 10MB; for text, 50K chars
        const isBinaryData = extractedText.startsWith('[IMAGE:');
        const maxLen = isBinaryData ? 10_000_000 : 50_000;
        await supabase.from('uploaded_documents').update({
            extracted_text: extractedText.substring(0, maxLen),
            processing_status: 'pending', // Ready for step 2
        }).eq('id', docId);

        return NextResponse.json({
            success: true,
            docId,
            requiresProcessing: true, // Signal to frontend to call /api/process-document
        });

    } catch (error: any) {
        console.error('Upload extract error:', error);
        return NextResponse.json(
            { error: 'Failed to upload/extract file' },
            { status: 500 }
        );
    }
}

// GET: List uploaded documents (unchanged)
export async function GET() {
    try {
        const supabase = getServiceSupabase();
        const { data, error } = await supabase
            .from('uploaded_documents')
            .select('id, file_name, file_type, processing_status, insights_generated, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ documents: data || [] });
    } catch (error) {
        console.error('Upload list error:', error);
        return NextResponse.json({ documents: [] });
    }
}
