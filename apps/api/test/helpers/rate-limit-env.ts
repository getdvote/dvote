// Turns flood protection on with small limits for rate-limit.e2e-spec. Imported before AppModule:
// ConfigModule reads the environment when the app module is first imported.
process.env.RATE_LIMIT_ENABLED = 'true';
process.env.RATE_LIMIT_USER_PER_MIN = '5';
process.env.RATE_LIMIT_IP_PER_MIN = '40';
