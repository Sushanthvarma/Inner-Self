// ============================================================
// INNER SELF — File Upload API Route
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { processDocumentContent } from '@/lib/ai';
import { getServiceSupabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

// POST: Upload and process a document
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

        // Create document record
        await supabase.from('uploaded_documents').insert({
            id: docId,
            file_name: file.name,
            file_type: fileType,
            processing_status: 'processing',
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
                // Extract readable text, strip XML tags
                extractedText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (extractedText.length < 50) {
                    extractedText = `[Document: ${file.name}] Content could not be fully extracted. File size: ${file.size} bytes.`;
                }
            } else if (['jpg', 'jpeg', 'png', 'webp'].includes(fileType)) {
                // For images, convert to base64 and send to Claude vision
                const buffer = Buffer.from(await file.arrayBuffer());
                const base64 = buffer.toString('base64');
                const mediaType = fileType === 'jpg' ? 'image/jpeg' :
                    fileType === 'jpeg' ? 'image/jpeg' :
                        fileType === 'png' ? 'image/png' : 'image/webp';
                extractedText = `[IMAGE:${mediaType}:${base64}]`;
            } else {
                // Try reading as text
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

        // Process with Claude
        const result = await processDocumentContent(extractedText, fileType, file.name);
        const parsed = JSON.parse(result);

        // Update persona summary (merge with existing)
        if (parsed.persona_updates) {
            const { data: existing } = await supabase
                .from('user_persona_summary')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            if (existing) {
                // Update existing persona with new information
                const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
                if (parsed.persona_updates.active_goals) {
                    const existingGoals = (existing.active_goals as unknown[]) || [];
                    updates.active_goals = [...existingGoals, ...parsed.persona_updates.active_goals];
                }
                if (parsed.persona_updates.full_psychological_profile) {
                    updates.full_psychological_profile =
                        (existing.full_psychological_profile || '') + '\n\n[Updated from document: ' + file.name + ']\n' +
                        parsed.persona_updates.full_psychological_profile;
                }
                if (parsed.persona_updates.core_beliefs_operating) {
                    const existingBeliefs = (existing.core_beliefs_operating as string[]) || [];
                    updates.core_beliefs_operating = [...new Set([...existingBeliefs, ...parsed.persona_updates.core_beliefs_operating])];
                }
                if (parsed.persona_updates.recurring_patterns) {
                    const existingPatterns = (existing.recurring_patterns as string[]) || [];
                    updates.recurring_patterns = [...new Set([...existingPatterns, ...parsed.persona_updates.recurring_patterns])];
                }
                await supabase.from('user_persona_summary').update(updates).eq('id', existing.id);
            } else {
                // Create new persona summary
                await supabase.from('user_persona_summary').insert({
                    id: uuidv4(),
                    ...parsed.persona_updates,
                });
            }
        }

        // Save extracted people
        if (parsed.people && parsed.people.length > 0) {
            const now = new Date().toISOString();
            for (const p of parsed.people) {
                const { data: existingPerson } = await supabase
                    .from('people_map')
                    .select('*')
                    .eq('name', p.name)
                    .single();

                if (existingPerson) {
                    await supabase.from('people_map').update({
                        last_mentioned: now,
                        mention_count: (existingPerson.mention_count || 0) + 1,
                    }).eq('id', existingPerson.id);
                } else {
                    await supabase.from('people_map').insert({
                        id: uuidv4(),
                        name: p.name,
                        relationship: p.relationship,
                        first_mentioned: now,
                        last_mentioned: now,
                        mention_count: 1,
                        sentiment_avg: p.sentiment_avg,
                        tags: p.tags || [],
                        sentiment_history: [
                            { date: now, sentiment: p.sentiment_avg, context: `document: ${file.name}` },
                        ],
                    });
                }
            }
        }

        // Save life events
        if (parsed.life_events && parsed.life_events.length > 0) {
            const eventRows = parsed.life_events.map(
                (e: { title: string; description: string; significance: number; category: string; emotions: string[] }) => ({
                    id: uuidv4(),
                    event_date: new Date().toISOString().split('T')[0],
                    title: e.title,
                    description: e.description,
                    significance: e.significance,
                    category: e.category,
                    emotions: e.emotions,
                })
            );
            await supabase.from('life_events_timeline').insert(eventRows);
        }

        // Save insights
        if (parsed.insights && parsed.insights.length > 0) {
            const insightRows = parsed.insights.map((text: string) => ({
                id: uuidv4(),
                insight_text: text,
                type: 'document_upload',
            }));
            await supabase.from('insights').insert(insightRows);
        }

        // Update document record
        await supabase.from('uploaded_documents').update({
            extracted_text: extractedText.substring(0, 10000), // Limit stored text
            processing_status: 'completed',
            insights_generated: {
                people_count: parsed.people?.length || 0,
                events_count: parsed.life_events?.length || 0,
                insights_count: parsed.insights?.length || 0,
            },
        }).eq('id', docId);

        return NextResponse.json({
            success: true,
            docId,
            peopleFound: parsed.people?.length || 0,
            eventsFound: parsed.life_events?.length || 0,
            insightsGenerated: parsed.insights?.length || 0,
        });
    } catch (error) {
        console.error('Upload API error:', error);
        return NextResponse.json(
            { error: 'Failed to process upload' },
            { status: 500 }
        );
    }
}

// GET: List uploaded documents
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
