import { EmailDocument } from '../types/EmailDocument';

// Note: Replace these environment variables with your actual Slack and Webhook.site URLs
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || 'https://webhook.site/2b1a3a1d-2c30-4471-94e2-3130719f99ce';

/**
 * Sends notifications and triggers external automation for 'Interested' leads.
 * @param email The EmailDocument object categorized as 'Interested'.
 */
export async function triggerWebhooks(email: EmailDocument): Promise<void> {
    const emailSummary = {
        subject: email.subject,
        from: email.from,
        accountId: email.accountId,
        date: new Date(email.date).toISOString(),
    };

    // --- 1. Slack Notification ---
    const slackPayload = {
        text: `:zap: NEW INTERESTED LEAD! :zap:`,
        blocks: [
            {
                type: "header",
                text: { type: "plain_text", text: `:rocket: New Interested Lead Captured` }
            },
            {
                type: "section",
                fields: [
                    { type: "mrkdwn", text: `*Subject:*\n${email.subject}` },
                    { type: "mrkdwn", text: `*From:*\n${email.from}` },
                    { type: "mrkdwn", text: `*Account:*\n${email.accountId}` },
                    { type: "mrkdwn", text: `*Category:*\n:green_heart: ${email.aiCategory}` },
                ]
            },
            {
                type: "context",
                elements: [
                    { type: "plain_text", text: `Email ID: ${email.id}` }
                ]
            }
        ]
    };

    try {
        const slackResponse = await fetch("https://webhook.site/2b1a3a1d-2c30-4471-94e2-3130719f99ce", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(slackPayload)
        });
        if (!slackResponse.ok) {
            console.error(`Failed to send Slack notification. Status: ${slackResponse.status}`);
        } else {
            console.log(`Slack notification sent for email: ${email.id}`);
        }
    } catch (error) {
        console.error(`Error sending Slack webhook:`, error);
    }

    // --- 2. Generic Webhook Trigger (for external automation like a CRM) ---
    const genericPayload = {
        event: 'InterestedLead',
        data: emailSummary,
        fullBodySnippet: email.body.substring(0, 250) + '...',
    };

    try {
        const genericResponse = await fetch("https://webhook.site/2b1a3a1d-2c30-4471-94e2-3130719f99ce", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(genericPayload)
        });
        if (!genericResponse.ok) {
            console.error(`Failed to trigger generic webhook. Status: ${genericResponse.status}`);
        } else {
            console.log(`Generic webhook triggered for email: ${email.id}`);
        }
    } catch (error) {
        console.error(`Error sending generic webhook:`, error);
    }
}
