import { Client } from '@elastic/elasticsearch';
import { EmailDocument } from '../types/EmailDocument';

const client = new Client({ node: 'http://localhost:9200' });
const INDEX_NAME = 'emails';

// 2.1 Define Mapping and Create Index
export async function setupElasticsearch() {
    const exists = await client.indices.exists({ index: INDEX_NAME });
    if (exists.body) return;

    await client.indices.create({
        index: INDEX_NAME,
        mappings: {
            properties: {
                subject: { type: 'text' },
                body: { type: 'text' },
                accountId: { type: 'keyword' },
                folder: { type: 'keyword' },
                date: { type: 'date' },
                aiCategory: { type: 'keyword' }
            }
        }
    });
    console.log(`Elasticsearch index '${INDEX_NAME}' created.`);
}

// 2.1 Indexing Logic
export async function indexEmail(email: EmailDocument) {
    await client.index({
        index: INDEX_NAME,
        id: email.id,
        document: email,
    });
    // Trigger AI categorization (Phase 3) after indexing
    // await categorizeEmail(email.id, email.body); 
}

// 2.2 Search and Filtering Implementation
export async function searchEmails(query: string, accountId?: string, folder?: string, page: number = 1, size: number = 20) {
    const filters = [];
    if (accountId) filters.push({ term: { accountId } });
    if (folder) filters.push({ term: { folder } });
    
    // Multi-match for full-text search across subject and body
    const searchClause = query 
        ? [{ multi_match: { query, fields: ['subject', 'body'] } }] 
        : [{ match_all: {} }];

    const { body } = await client.search({
        index: INDEX_NAME,
        from: (page - 1) * size,
        size: size,
        body: {
            query: {
                bool: {
                    must: searchClause,
                    filter: filters // Fast filtering on keyword fields
                }
            },
            sort: [{ date: { order: 'desc' } }]
        }
    });

    return body.hits.hits.map((hit: any) => hit._source);
}