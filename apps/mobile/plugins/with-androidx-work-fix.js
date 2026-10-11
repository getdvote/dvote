const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Android build fix: react-native-android-widget uses androidx.work:work-runtime 2.8.1, while an
 * older work-runtime-ktx 2.7.1 also comes in through other libraries. From 2.8 the -ktx classes
 * live in work-runtime itself, so both copies clash ("Duplicate class androidx.work...").
 * Raising work-runtime-ktx to the same version leaves a single copy.
 */
const MARK = '// dvote: androidx.work version fix';

module.exports = function withAndroidxWorkFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK)) {
      cfg.modResults.contents += `
${MARK}
configurations.all {
    resolutionStrategy {
        force 'androidx.work:work-runtime:2.8.1'
        force 'androidx.work:work-runtime-ktx:2.8.1'
    }
}
`;
    }
    return cfg;
  });
};
