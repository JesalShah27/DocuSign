module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Modify the module rules
      webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
        if (rule.oneOf) {
          rule.oneOf = rule.oneOf.map(oneOfRule => {
            if (oneOfRule.type === 'asset/resource' && oneOfRule.test && oneOfRule.test.toString().includes('svg')) {
              return {
                ...oneOfRule,
                exclude: /node_modules/
              };
            }
            return oneOfRule;
          });
        }
        return rule;
      });

      return webpackConfig;
    },
  },
};