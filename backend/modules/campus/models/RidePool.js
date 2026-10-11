const { DataTypes } = require('sequelize');

let RidePool;

const initRidePoolModel = (sequelize) => {
  if (!sequelize) return null;

  RidePool = sequelize.define('CampusRidePool', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    creatorName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    origin: {
      type: DataTypes.STRING,
      defaultValue: 'Campus Gate 1',
    },
    destination: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    departureTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    availableSeats: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
    },
    totalSeats: {
      type: DataTypes.INTEGER,
      defaultValue: 4,
    },
    farePerSeat: {
      type: DataTypes.INTEGER,
      defaultValue: 50,
    },
    vehicleType: {
      type: DataTypes.STRING(20),
      defaultValue: 'Car', // 'Car' | 'Auto' | 'Bike'
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'open', // 'open' | 'full' | 'departed' | 'cancelled'
    },
    passengers: {
      type: DataTypes.TEXT,
      defaultValue: '[]',
      get() {
        const val = this.getDataValue('passengers');
        try { return val ? JSON.parse(val) : []; } catch { return []; }
      },
      set(val) {
        this.setDataValue('passengers', JSON.stringify(val || []));
      }
    }
  }, { timestamps: true });

  return RidePool;
};

module.exports = {
  initRidePoolModel,
  getRidePoolModel: () => RidePool,
};
