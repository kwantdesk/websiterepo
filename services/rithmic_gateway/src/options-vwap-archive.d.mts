export function optionsVwapQuery(url:URL,now?:number):{symbol:string;from:string;to:string};
export class OptionsVwapArchiveReader {constructor(options:{dir:string;now?:()=>number;maxRecords?:number});read(query:{symbol:string;from:string;to:string}):Promise<unknown>;}
