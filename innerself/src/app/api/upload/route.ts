
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

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
            processing_status: 'pending_analysis', // New status indicating ready for AI
        });

        let extractedText = '';

        try {
            if (fileType === 'txt') {
                extractedText = await file.text();
            } else if (fileType === 'pdf') {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require('pdf-parse');
                const buffer = Buffer.from(await file.arrayBuffer());
                const pdfData = await pdfParse(buffer);
                extractedText = pdfData.text;
            } else if (fileType === 'docx' || fileType === 'doc') {
                // Basic text extraction from docx (XML-based)
                const buffer = Buffer.from(await file.arrayBuffer());
                const text = buffer.toString('utf-8');
                extractedText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (extractedText.length < 50) {
                    extractedText = `[Document: ${file.name}] Content could not be fully extracted. File size: ${file.size} bytes.`;
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
        } catch (extractError) {
            console.error('Text extraction error:', extractError);
            await supabase.from('uploaded_documents').update({
                processing_status: 'failed',
            }).eq('id', docId);
            return NextResponse.json({
                error: 'Failed to extract text from file',
            }, { status: 422 });
        }

        // Update DB with extracted text
        await supabase.from('uploaded_documents').update({
            extracted_text: extractedText.substring(0, 50000), // Limit increased for images
            processing_status: 'ready_for_ai', // Ready for step 2
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
