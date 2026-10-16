// Mantém a identidade EAS e os plugins definidos em app.json.
// MapLibre/OpenFreeMap não precisam de chave nem configuração por ambiente.
module.exports = ({ config }) => ({ ...config });
