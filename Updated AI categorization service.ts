import { GoogleGenAI, Type } from '@google/genai';
import { client } from '../persistence/ElasticsearchService'; // Re-use ES client
import { triggerWebhooks } from '../integration/WebhookService'; // <-- NEW IMPORT
import { EmailDocument } from '../types/EmailDocument'; // <-- Assuming this type is available

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const CATEGORY_LABELS = ["Interested", "Meeting Booked", "Not Interested", "Spam", "Out of Office"];

/**
 * Categorizes an email using the Gemini API and updates Elasticsearch.
 * Triggers webhooks if the category is 'Interested'.
 */
export async function categorizeEmail(email: EmailDocument) {
    const systemInstruction = "You are an expert email classifier. Analyze the provided email text and categorize it into one of the following labels. Only return the JSON object.";
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            category: {
                type: Type.STRING,
                description: "The assigned category for the email.",
                enum: CATEGORY_LABELS
            }
        },
        required: ["category"]
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: email.body, // Pass the email body for analysis
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        const aiCategory = result.category;

        // 1. Update Elasticsearch with the new category
        await client.update({
            index: 'emails',
            id: email.id,
            doc: { aiCategory }
        });

        console.log(`Email ${email.id} categorized as: ${aiCategory}`);

        // 2. Trigger Integration (Phase 4 Logic)
        if (aiCategory === 'Interested') {
            console.log('Category is Interested, initiating webhooks...');
            await triggerWebhooks({ ...email, aiCategory }); // Pass the full email object
        }

    } catch (error) {
        console.error(`AI Categorization failed for email ${email.id}. Implement exponential backoff retry here.`, error);
    }
}
