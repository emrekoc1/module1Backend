const pool = require('../db');


const PortalHaber = pool.define('PortalHaber', {
    header: { type: DataTypes.TEXT },
    description: { type: DataTypes.TEXT },
    photo: { type: DataTypes.TEXT },
    total_like: { type: DataTypes.INTEGER },
    pdf_url: { type: DataTypes.TEXT },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    update_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    departman: { type: DataTypes.INTEGER },
}, {
    tableName: 'portal_haber',
    timestamps: false,
});

module.exports = PortalHaber;