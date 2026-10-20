import { runNode } from '../server/vercelNodeHandler.ts';
export default (req: { method?: string; body?: unknown }, res: { status: (code: number) => { json: (body: unknown) => void } }) => runNode('complaint', req, res);
