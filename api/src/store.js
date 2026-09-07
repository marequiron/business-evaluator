'use strict';

/**
 * store.js
 * Persists submissions to Azure Cosmos DB using the @azure/cosmos SDK.
 *
 * Behaviour when storage is NOT configured:
 *  - DEV_NO_STORE=true (or local Functions development env) -> log-and-return,
 *    stored:false (used while scaffolding / before approval).
 *  - anything else -> throw, which the handler surface as 500 so deployments
 *    never silently drop submissions.
 */

function createStore(envOpts) {
  const env = envOpts || process.env;
  const connectionString = env.COSMOS_CONNECTION_STRING;
  const endpoint = env.COSMOS_ENDPOINT;
  const key = env.COSMOS_KEY;
  const databaseId = env.COSMOS_DATABASE || 'business-evaluator';
  const containerId = env.COSMOS_CONTAINER || 'submissions';

  if (connectionString || (endpoint && key)) {
    const { CosmosClient } = require('@azure/cosmos');
    const client = connectionString
      ? new CosmosClient(connectionString)
      : new CosmosClient({ endpoint, key });
    const container = client.database(databaseId).container(containerId);

    return async function storeSubmission(submission) {
      await container.items.create(submission);
      return { stored: true };
    };
  }

  const devNoStore = env.DEV_NO_STORE === 'true'
    || env.AZURE_FUNCTIONS_ENVIRONMENT === 'Development';
  if (devNoStore) {
    return async function storeSubmission(submission) {
      // eslint-disable-next-line no-console
      console.log('[dev] submission not persisted:', submission.submissionId);
      return { stored: false };
    };
  }

  return async function storeSubmission() {
    throw new Error('Storage is not configured. Set COSMOS_CONNECTION_STRING ' +
      '(or COSMOS_ENDPOINT + COSMOS_KEY), or set DEV_NO_STORE=true for local dev.');
  };
}

module.exports = { createStore };