import Constants from 'expo-constants';

// appOwnership === 'expo' in Expo Go; null in dev builds and production.
// Conditional require (not a static import) is required here: HomeScreen.tsx does an
// unconditional `require('react-native-maps')` at its own module scope, so it must only
// ever be loaded when !isExpoGo. A static `import HomeScreen from './map/HomeScreen'`
// would execute regardless of this check and crash Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

const Screen = isExpoGo
  ? require('./map/ExpoGoMapScreen').default
  : require('./map/HomeScreen').default;

export default Screen;
