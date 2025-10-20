import { ImapFlow } from 'imapflow';
import { EmailDocument } from '../types/EmailDocument';
import { indexEmail } from '../persistence/ElasticsearchService';

// Time (in ms) to break IDLE and re-issue the command to prevent timeouts (~29 mins)
const IDLE_WATCHDOG_INTERVAL = 29 * 60 * 1000; 

export class ImapSyncService {
    private client: ImapFlow;
    private accountId: string;

    constructor(config: any, accountId: string) {
        this.client = new ImapFlow(config);
        this.accountId = accountId;
    }

    public async startSync() {
        await this.client.connect();
        
        // 1. Initial Sync (History) - Fetch last 30 days
        await this.initialSync();
        
        // 2. Start Real-Time IDLE Listener
        await this.startIdle();
        
        console.log(`IMAP connection established for ${this.accountId}`);
    }

    private async initialSync() {
        // Example: Select INBOX and fetch headers for last 30 days
        let lock = await this.client.get // Use lock = await this.client.get
        try {
            await this.client.mailboxOpen('INBOX');
            
            // Search criteria: 'SINCE' 30 days ago
            const messages = await this.client.fetch('1:*', { // Fetch message sequence numbers
                uid: true, 
                envelope: true, // Metadata only
                bodystructure: true 
            }, {
                // Here you would add search criteria like 'SINCE 1-Feb-2024'
            });

            for await (const msg of messages) {
                // In a real app, you would fetch bodies lazily. 
                // For initial sync, we are just indexing metadata.
                const emailDoc: Partial<EmailDocument> = {
                    id: String(msg.uid),
                    accountId: this.accountId,
                    subject: msg.envelope.subject,
                    date: msg.envelope.date,
                    // ... other metadata
                };
                // indexEmail(emailDoc as EmailDocument); 
            }
        } finally {
            // lock.release();
        }
    }

    private async startIdle() {
        let currentLock: any = await this.client.get);
        try {
            await this.client.mailboxOpen('INBOX');

            // Set up listener for new messages
            this.client.on('mail', async () => {
                const search = await this.client.search({ seen: false }); // Find unseen
                
                // Fetch full data for the new message(s)
                for await (const msg of this.client.fetch(search, { 
                    uid: true, 
                    envelope: true, 
                    body: true 
                })) {
                    // Process message, extract plaintext body, and index
                    const emailDoc: EmailDocument = { 
                        // ... mapping logic
                        body: 'Extracted plaintext content...'
                    };
                    await indexEmail(emailDoc); // Phase 2
                    // Mark as seen immediately after processing
                    await this.client.messageFlagsAdd(msg.uid, ['\\Seen']);
                }
            });

            // Start IDLE loop with watchdog
            while (this.client.state === 'selected') {
                const idlePromise = new Promise<void>(resolve => {
                    const timer = setTimeout(() => {
                        // Watchdog timer fires: break IDLE and restart
                        this.client.customCommand('DONE'); 
                        resolve();
                    }, IDLE_WATCHDOG_INTERVAL);

                    // Re-resolve and clear timer if the server sends updates
                    this.client.on('idle-done', () => {
                        clearTimeout(timer);
                        resolve();
                    });
                });
                
                await this.client.idle();
                await idlePromise;
                console.log(`IDLE watchdog triggered for ${this.accountId}, restarting IDLE...`);
            }
        } catch (error) {
            console.error(`IMAP IDLE error for ${this.accountId}:`, error);
            // Implement Reconnect logic here
        } finally {
            // currentLock.release();
        }
    }
}