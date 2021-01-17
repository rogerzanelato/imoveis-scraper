const dotenv = require("dotenv");

dotenv.config();

const [latitude, longitude] = (function () {
    const latLongEnv = process.env.ENDERECO_OU_LATLONG_CALCULAR_DISTANCIA || '';
    const [latitudeEnv, longitudeEnv] = latLongEnv.split(',');

    const latitude = parseFloat(latitudeEnv);
    const longitude = parseFloat(longitudeEnv);

    if (isNaN(latitude) || isNaN(longitude)) {
        return [null, null];
    }

    return [latitude, longitude];
})();

module.exports = {
    googleMapsToken: process.env.GOOGLE_MAPS_API_DIRECTIONS_TOKEN,
    dadosCalcularDistancia: process.env.ENDERECO_OU_LATLONG_CALCULAR_DISTANCIA,
    latitude,
    longitude,
    modoPercorrerTrajeto: process.emit.MODO_PERCORRER_TRAJETO
};