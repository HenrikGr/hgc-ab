
    export type RemoteKeys = 'remoteApp/FeatureButton';
    type PackageType<T> = T extends 'remoteApp/FeatureButton' ? typeof import('remoteApp/FeatureButton') :any;