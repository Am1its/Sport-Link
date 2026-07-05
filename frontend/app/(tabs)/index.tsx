import Constants from 'expo-constants';

// appOwnership === 'expo' in Expo Go; null in dev builds and production.
// Conditional require (not a static import) is required here: HomeScreen.tsx does an
// unconditional `require('react-native-maps')` at its own module scope, so it must only
// ever be loaded when !isExpoGo. A static `import HomeScreen from './map/HomeScreen'`
// would execute regardless of this check and crash Expo Go.
//
// Both map/HomeScreen.tsx and map/ExpoGoMapScreen.tsx use NAMED exports (not default) —
// a default export on a file under app/(tabs)/ makes Expo Router register it as its own
// tab, since it's nested inside this Tabs route group. Reference `.HomeScreen` /
// `.ExpoGoMapScreen` here, not `.default`.
const isExpoGo = Constants.appOwnership === 'expo';

const Screen = isExpoGo
  ? require('./map/ExpoGoMapScreen').ExpoGoMapScreen
  : require('./map/HomeScreen').HomeScreen;

export default Screen;
