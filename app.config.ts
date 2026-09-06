import type { ConfigContext, ExpoConfig } from 'expo/config';

const localGoogleServicesJson = './google-services.json';
const localGoogleServiceInfoPlist = './GoogleService-Info.plist';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST ?? localGoogleServiceInfoPlist,
  },
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? localGoogleServicesJson,
  },
});
