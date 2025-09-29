module.exports = {
	apps: [
		{
			name: 'golden-memories',
			script: 'server.js',
			env: {
				NODE_ENV: 'production',
				PORT: process.env.PORT || 3000,
				HOST: process.env.HOST || '0.0.0.0',
				SESSION_SECRET: process.env.SESSION_SECRET || 'change-me',
				COOKIE_SECURE: process.env.COOKIE_SECURE || 'false',
				DATABASE_URL: process.env.DATABASE_URL || '',
				AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
				AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
				AWS_REGION: process.env.AWS_REGION || '',
				S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || ''
			}
		}
	]
};

