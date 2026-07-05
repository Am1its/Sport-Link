import Constants from 'expo-constants';

// appOwnership === 'expo' in Expo Go; null in dev builds and production.
// Only load react-native-maps when we know the native module is available.
const isExpoGo = Constants.appOwnership === 'expo';

export default isExpoGo
  ? require('./map/ExpoGoMapScreen').default
  : require('./map/HomeScreen').default;
