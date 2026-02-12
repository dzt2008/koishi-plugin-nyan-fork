import { Context, Schema } from 'koishi';
export declare const name = "nyan-fork";
export interface Config {
    noises: Array<{
        enabled: boolean;
        word: string;
    }>;
    transformLastLineOnly: boolean;
    appendIfNoTrailing: string;
    trailing: Array<{
        target: string;
        replacement: string;
    }>;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
