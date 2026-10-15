import {handleMcp} from '../lib/mcp.js';
export const onRequest=({request,env})=>handleMcp(request,env);
