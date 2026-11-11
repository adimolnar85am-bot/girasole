const assetsHandler = require("../../api/assets");
const { adaptLegacyApi } = require("../compat/legacy-api");

exports.handler = adaptLegacyApi(assetsHandler);
