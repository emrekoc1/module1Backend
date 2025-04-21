const pool = require('../db');


const PortalHaberLike = pool.define('PortalHaberLike', {
    haber_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER },
    created_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    is_delete: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
    tableName: 'portal_haber_like',
    timestamps: false,
});

module.exports = PortalHaberLike;