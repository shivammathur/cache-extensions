export declare const SCRIPT_PATH: string;
export type ScriptCall = {
    command: 'bash';
    args: [string, string, ...string[]];
};
export declare function getOutput(output: string): Promise<string>;
export declare function filterExtensions(extension_csv: string): string;
export declare function scriptCall(fn: string, ...args: string[]): ScriptCall;
