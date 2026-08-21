const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * react-native-start-io-sdk pins its Android dependency on a floating version
 * (`com.startapp:inapp-sdk:5.+`), which resolves to whatever StartApp
 * publishes latest at build time. 5.3.2 bumped its minCompileSdk to 37, ahead
 * of what this project (and the current Android Gradle Plugin) targets,
 * breaking the build. Force the last version without that requirement
 * (5.3.1) for every subproject, so the floating range can't drift forward
 * again on its own.
 */
const STARTAPP_SDK_VERSION = '5.3.1';

const FORCE_BLOCK = `
subprojects {
  configurations.all {
    resolutionStrategy {
      force 'com.startapp:inapp-sdk:${STARTAPP_SDK_VERSION}'
    }
  }
}
`;

module.exports = function withStartAppSdkFix(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withStartAppSdkFix expects a Groovy android/build.gradle');
    }
    if (!config.modResults.contents.includes(`com.startapp:inapp-sdk:${STARTAPP_SDK_VERSION}`)) {
      config.modResults.contents += FORCE_BLOCK;
    }
    return config;
  });
};
