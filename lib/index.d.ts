import { Context, Schema } from 'koishi';
export declare const reusable = false;
export declare const filter = false;
export declare const name = "nyan-fork";
export declare const inject: {
    required: string[];
};
export declare const usage = "\n---\n";
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
    filterMode: 'blacklist' | 'whitelist';
    blacklist?: Array<{
        type: 'userId' | 'channelId' | 'guildId' | 'platform';
        value: string;
        reason?: string;
    }>;
    whitelist?: Array<{
        type: 'userId' | 'channelId' | 'guildId' | 'platform';
        value: string;
        reason?: string;
    }>;
    logBlocked: boolean;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
