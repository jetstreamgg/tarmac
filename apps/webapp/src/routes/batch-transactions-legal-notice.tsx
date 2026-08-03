import { createFileRoute } from '@tanstack/react-router';
import { BatchTransactionsLegal } from '@/pages/BatchTransactionsLegal';

export const Route = createFileRoute('/batch-transactions-legal-notice')({
  component: BatchTransactionsLegal
});
