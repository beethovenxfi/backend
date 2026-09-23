import { YbAprConfig } from '../../token-yields';

export interface AprHandlerConfigs {
    ybAprHandler?: YbAprConfig;
    maBeetsAprHandler?: MaBeetsAprConfig;
}

export interface MaBeetsAprConfig {
    beetsAddress: string;
}
