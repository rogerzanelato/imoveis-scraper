const path = require('path');
const fetch = require('node-fetch');
const { googleMapsToken, dadosCalcularDistancia, latitude, longitude } = require("./config");
const { error, warn, success, messageWithColor, Colors } = require("./lib/console-colorhelper");
const apiGoogleMaps = require("./lib/api-google-maps");
const CsvWriter = require("./lib/csv-writer");
const fs = require('fs').promises;
const { chunk, getDistanceFromLatLonInKm } = require('./lib/helpers');

if (process.argv.length < 3) {
    console.log('Utilização: node ' + process.argv[1] + ' <lista-de-links.txt>');
    process.exit(1);
}

if (dadosCalcularDistancia && googleMapsToken) {
    console.log(warn("Dados para calculo de distância e Token do Google Cloud foram informados. Distância será calculada através da API do Google Maps."));
}

if (dadosCalcularDistancia && !googleMapsToken && latitude && longitude) {
    console.warn(warn("Latitude e longitude foram informados. A distância será calculada utilizando a forma de Haversine."));
}

if (dadosCalcularDistancia && !googleMapsToken && (!latitude || !longitude)) {
    console.warn(warn("Dados para calculo de distância foram informados, mas não há Token para consultar API do Google Maps e o formato fornecido não corresponde à latitude e longitude. A distância não será calculada."));
}

const serviceCsv = new CsvWriter({
    fileName: path.join(__dirname, "imoveis_sub100.csv"),
    columnDelimiter: "|",
    lineDelimiter: "\n",
    columns: [
        {header: "Edifício", name: "condo_name", default: ''},
        {header: "Andar", name: "floor", default: ''},
        {header: "Apartamento", name: "apartment", default: ''},
        {header: "Endereço", name: "address_complete", default: ''},
        {header: "Bairro", name: "address_neighborhood", default: ''},
        {header: "Área Privativa", name: "private_area", default: ''},
        {header: "Quartos", name: "dorms", default: ''},
        {header: "Banheiros", name: "bwc", default: ''},
        {header: "Suítes", name: "suites", default: ''},
        {header: "Sacada", name: "sacada", default: ''},
        {header: "Aluguel", name: "total", default: ''},
        {header: "Condomínio", name: "condo_value", default: ''},
        {header: "Total", name: "total_value", default: ''},
        {header: "IPTU", name: "iptu_value", default: ''},
        {header: "Garagem", name: "parking_spaces", default: ''},
        {header: "Distância Referência", name: "distancia_origem", default: ''},
        {header: "Tempo Trajeto", name: "tempo_trajeto", default: ''},
        {header: "Link", name: "link", default: ''}
    ]
});

const filename = process.argv[2];

/**
 * Método principal, declarado como função assíncrona
 * pra poder usar os awaits
 */
(async function() {
    console.time(messageWithColor("Tempo total", Colors.BgGreen, Colors.FgBlack));

    const chunkSize = 30;
    const linksFile = (await fs.readFile(filename)).toString().split('\n');

    const linksChunks = chunk(linksFile, chunkSize);
    console.log(warn(`${linksFile.length} links. Consultas serão efetuadas em blocos de ${chunkSize}`));

    for (let indice = 0; indice < linksChunks.length; indice++) {
        try {
            console.time(success("Tempo gasto"));
            console.log(success(`Iniciando consulta (${indice + 1}/${linksChunks.length})`));
    
            const links = linksChunks[indice];
    
            console.log(`Buscando informações API sub100..`);
            const dadosImoveis = await Promise.all(links.map(buscarInformacoesImovelSub100));
    
            console.log(`Extraindo informações..`);
            const objetosExportarCsv = await Promise.all(dadosImoveis.map(mapearParaObjetoCsv));
    
            console.log(`Gravando resultado em CSV...`);
            await Promise.all(objetosExportarCsv.map((csvObject) => serviceCsv.write(csvObject)));
    
            console.timeEnd(success("Tempo gasto"));
            console.log("\n" + "-".repeat(100) + "\n");
        } catch(e) {
            console.error(error('Falhou: '), e);
            return;
        }
    }

    serviceCsv.close();
    console.timeEnd(messageWithColor("Tempo total", Colors.BgGreen, Colors.FgBlack));
})();

function buscarInformacoesImovelSub100(url) {
    const options = {
        method: 'GET',
        headers: {
            'accept': 'application/json',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'origin': 'https://sub100.com.br',
            'pragma': 'no-cache',
            'referer': 'https://sub100.com.br/'
        },
        redirect: 'follow'
    }

    return fetch(url, options).then((res) => res.json())
}

async function mapearParaObjetoCsv(dadosImovel) {
    const info = {
        condo_name: dadosImovel.condo && dadosImovel.condo.name,
        floor: dadosImovel.floor,
        apartment: dadosImovel.apartment,
        address_complete: dadosImovel.address && dadosImovel.address.complete,
        address_neighborhood: dadosImovel.address && dadosImovel.address.neighborhood,
        private_area: dadosImovel.private_area,
        dorms: dadosImovel.dorms,
        bwc: dadosImovel.bwc,
        suites: dadosImovel.suites,
        total: dadosImovel.total,
        condo_value: dadosImovel.condo_value,
        total_value: dadosImovel.total_value,
        iptu_value: dadosImovel.iptu_value,
        parking_spaces: dadosImovel.parking_spaces,
    }

    // Retorna que o apartamento possuí Sacada, caso a palavra exista na descrição do imóvel (abordagem ingênua, mas obtem resultados ok)
    info.sacada = dadosImovel.description.indexOf("sacada") > -1 ? "Sim" : "Não";

    if (dadosCalcularDistancia && googleMapsToken && info.address_complete) {
        const dadosTrajeto = await apiGoogleMaps.getDadosTrajetoMaisCurto(info.address_complete);
        if (dadosTrajeto) {
            info.distancia_origem = dadosTrajeto.distance.text;
            info.tempo_trajeto = dadosTrajeto.duration.text;
        }
    }

    if (dadosCalcularDistancia && !googleMapsToken && latitude && longitude && dadosImovel.latitude && dadosImovel.longitude) {
        const distancia = getDistanceFromLatLonInKm(latitude, longitude, dadosImovel.latitude, dadosImovel.longitude);
        info.distancia_origem = distancia.toFixed(3).replace('.', ',');
    }

    info.link = `https://sub100.com.br/imoveis/${dadosImovel.reference}`;

    return info;
}
