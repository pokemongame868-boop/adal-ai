import { run } from '../server/vercelHandler.ts';
export default (req: Request) => run('feedback', req);
