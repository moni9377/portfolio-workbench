const app = require('../server');

module.exports = async (req, res) => {
    await app.dbReady;
    return app(req, res);
};
