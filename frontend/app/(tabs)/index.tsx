import Constants from 'expo-constants';

// appOwnership === 'expo' in Expo Go; null in dev builds and production.
// Conditional require (not a static import) is required here: HomeScreen.tsx does an
// unconditional `require('react-native-maps')` at its own module scope, so it must only
// ever be loaded when !isExpoGo. A static `import HomeScreen from '../../components/map/HomeScreen'`
// would execute regardless of this check and crash Expo Go.
//
// These files live in components/map/, NOT under app/ — expo-router (57.x) pushes every
// file under app/ into the route tree regardless of default-vs-named exports (a missing
// default export only gets a console.warn, it's not excluded), so a directory of helper
// files nested under app/(tabs)/ gets hoisted as sibling tabs of this Tabs group. Being
// outside app/ entirely is the only exclusion that's actually guaranteed.
const isExpoGo = Constants.appOwnership === 'expo';

const Screen = isExpoGo
  ? require('../../components/map/ExpoGoMapScreen').ExpoGoMapScreen
  : require('../../components/map/HomeScreen').HomeScreen;

export default Screen;
