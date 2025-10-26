// Vercel serverless function: /api/chat.js
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

const SYSTEM_PROMPT = `You are Felix Silverpaw, the CEO of Catnip Capital, a venture investment firm. You're a cat with a sophisticated, witty, and slightly shady personality.

Character traits:
- You're charming but subtly untrustworthy - you drop red flags while maintaining plausible deniability
- You speak eloquently but occasionally reference cat behaviors (napping 18 hours, knocking things off desks, etc.) as if they're normal business practices
- You've "seen it all" in the VC world and are cynically amused by everything
- You casually mention previous investments that clearly failed but spin them as "learning experiences"
- You love buzzwords like "disruption," "paradigm shift," "10x returns" but use them ironically
- You're sarcastic and give backhanded compliments
- You occasionally purr or make cat puns, but subtly
- You treat investor meetings like hunting - you're the predator sizing up prey
- You're skeptical of everything but pretend to be interested

Keep responses relatively concise (2-4 sentences usually), witty, and always stay in character. You're here to be entertained, not necessarily helpful.`;

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Invalid messages format' });
        }

        // Call Anthropic API
        const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: messages
            })
        });

        if (!anthropicResponse.ok) {
            const error = await anthropicResponse.text();
            console.error('Anthropic API error:', error);
            throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
        }

        const anthropicData = await anthropicResponse.json();
        const assistantMessage = anthropicData.content[0].text;

        // Generate voice with ElevenLabs
        let audioUrl = null;
        
        if (ELEVENLABS_API_KEY && ELEVENLABS_VOICE_ID) {
            try {
                const elevenLabsResponse = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
                    {
                        method: 'POST',
                        headers: {
                            'Accept': 'audio/mpeg',
                            'Content-Type': 'application/json',
                            'xi-api-key': ELEVENLABS_API_KEY
                        },
                        body: JSON.stringify({
                            text: assistantMessage,
                            model_id: 'eleven_monolingual_v1',
                            voice_settings: {
                                stability: 0.5,
                                similarity_boost: 0.75
                            }
                        })
                    }
                );

                if (elevenLabsResponse.ok) {
                    const audioBuffer = await elevenLabsResponse.arrayBuffer();
                    const base64Audio = Buffer.from(audioBuffer).toString('base64');
                    audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
                }
            } catch (voiceError) {
                console.error('ElevenLabs error:', voiceError);
                // Continue without voice if it fails
            }
        }

        return res.status(200).json({
            message: assistantMessage,
            audioUrl: audioUrl
        });

    } catch (error) {
        console.error('Error in chat handler:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}