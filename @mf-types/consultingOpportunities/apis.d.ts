
    export type RemoteKeys = 'consultingOpportunities/FeatureButton';
    type PackageType<T> = T extends 'consultingOpportunities/FeatureButton' ? typeof import('consultingOpportunities/FeatureButton') :any;