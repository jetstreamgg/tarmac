import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single react-query client. Exported from its own leaf module (not
 * from `pages/App`) so router `beforeLoad` guards can prime and read the same
 * cache the React tree uses — importing it from `pages/App` would pull the whole
 * provider graph into the route modules.
 */
export const queryClient = new QueryClient();
