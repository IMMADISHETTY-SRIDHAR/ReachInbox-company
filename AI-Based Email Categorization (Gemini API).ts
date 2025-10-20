import { GoogleGenAI, Type } from '@google/genai';
import { client } from '../persistence/ElasticsearchService'; // Re-use ES client

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const CATEGORY_LABELS = ["Interested", "Meeting Booked", "Not Interested", "Spam", "Out of Office"];

// 3.1 LLM Categorization Service
export async function categorizeEmail(emailId: string, emailBody: string) {
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
            contents: emailBody,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        const aiCategory = result.category;

        // 3.2 Update Elasticsearch
        await client.update({
            index: 'emails',
            id: emailId,
            doc: { aiCategory }
        });

        // 4. Trigger Integration if Interested
        if (aiCategory === 'Interested') {
            // await triggerWebhooks(emailId); // Phase 4 call
        }

    } catch (error) {
        console.error(`AI Categorization failed for email ${emailId}. Implementing backoff...`, error);
        // Implement exponential backoff retry logic here (Phase 3 Error Handling)
    }
}
