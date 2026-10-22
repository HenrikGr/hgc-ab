
    export type RemoteKeys = 'REMOTE_ALIAS_IDENTIFIER/FeatureButton';
    type PackageType<T> = T extends 'REMOTE_ALIAS_IDENTIFIER/FeatureButton' ? typeof import('REMOTE_ALIAS_IDENTIFIER/FeatureButton') :any;