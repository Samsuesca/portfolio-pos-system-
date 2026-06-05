import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;

const isConfigured =
  !!WEB_CLIENT_ID &&
  (Platform.OS === 'ios' ? !!IOS_CLIENT_ID : !!ANDROID_CLIENT_ID);

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    isConfigured
      ? {
          clientId: WEB_CLIENT_ID,
          iosClientId: IOS_CLIENT_ID,
          androidClientId: ANDROID_CLIENT_ID,
        }
      : { clientId: 'placeholder' }
  );

  return {
    request: isConfigured ? request : null,
    response: isConfigured ? response : null,
    promptAsync,
    isConfigured,
  };
}
