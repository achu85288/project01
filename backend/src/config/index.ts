// Using named exports
export const dbConfig = {
    host: 'localhost',
    port: 5432,
    name: 'myapp_db'
};

// Using default export
const appConfig = {
    port: 3000,
    env: process.env.NODE_ENV || 'development'
};

export default appConfig;