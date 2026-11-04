export interface TapeField {key:string;field:string;label:string;type:'text'|'number'|'enum'|'date'|'datetime'|'boolean';operators:readonly string[];choices?:string[];integer?:boolean;consolidatedOnly?:boolean;unconsolidatedOnly?:boolean}
export const OPTION_TAPE_FIELDS: Readonly<Record<string,TapeField>>;
export function optionTapeField(key:unknown): TapeField|null;
export function optionTapeColumnFields(key:string): TapeField[];
export function isOptionTapeTool(tool:string):boolean;
export function optionTapeSort(selection?:{id?:string;key?:string;field?:string;direction:number|string}|null,toolId?:string):{field:string;direction:string};
export function optionTapeFilterExpression(filters?:Array<{id?:string;key?:string;field?:string;operator?:string;operation?:string;value:unknown}>,toolId?:string):Record<string,unknown>|null;
export function optionTapeSessionRange(input?:{startDate?:string|null;endDate?:string|null}):{sessionDate?:string;timeRange?:{startTime:string;endTime:string}};
export function optionTapeCursor(payload:unknown):string[]|null;
export function mergeOptionTapeRows(previous?:Record<string,unknown>[],incoming?:Record<string,unknown>[]):Record<string,unknown>[];
export function optionTapeRequest(toolId:string,controls?:Record<string,unknown>,baseBody?:Record<string,unknown>):Record<string,unknown>;
export function validateOptionTapeRequest(toolId:string,body:unknown):void;
