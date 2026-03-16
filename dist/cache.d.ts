export declare function getErrorMessage(error: unknown): string;
export declare function shouldHandleDependencies(version: string, platform?: NodeJS.Platform): boolean;
export declare function handleDependencies(extensions: string, version: string, platform?: NodeJS.Platform): Promise<void>;
export declare function run(): Promise<void>;
export declare function main(runAction?: () => Promise<void>): Promise<void>;
export declare function isMainModule(argv1?: string | undefined, moduleUrl?: string): boolean;
export declare function bootstrap(argv1?: string | undefined, moduleUrl?: string, runAction?: () => Promise<void>): Promise<void>;
