const contentHandler = require("../../api/content");
const { adaptLegacyApi } = require("../compat/legacy-api");

exports.handler = adaptLegacyApi(contentHandler);
