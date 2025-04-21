const pool = require('../db');

const PortalHaberUserRead = pool.define('PortalHaberUserRead', {
    haber_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER },
}, {
    tableName: 'portal_haber_user_read',
    timestamps: false,
});

module.exports = PortalHaberUserRead;