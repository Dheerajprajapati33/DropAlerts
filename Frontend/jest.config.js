module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-firebase|@react-native-async-storage|@react-navigation|react-redux|@reduxjs/toolkit|immer|reselect|axios|react-native-safe-area-context|react-native-svg|react-native-qrcode-svg|lucide-react-native)/)',
  ],
};
